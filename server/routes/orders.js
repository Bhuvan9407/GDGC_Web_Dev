const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../auth');

/**
 * POST /api/orders
 * Customer purchases an available painting.
 * CRITICAL REQUIREMENT: Atomic conditional update inside MySQL transaction to prevent duplicate purchases.
 */
router.post('/', requireRole('customer'), async (req, res) => {
  const { paintingId } = req.body;
  const customerId = req.session.user.id;

  if (!paintingId) {
    return res.status(400).json({ error: 'Painting ID is required.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Verify painting exists
    const [paintings] = await conn.query(
      'SELECT id, title, price, status FROM paintings WHERE id = ?',
      [paintingId]
    );

    if (paintings.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Painting not found.' });
    }

    const painting = paintings[0];

    // 2. Perform atomic conditional update: only update if currently 'available'
    const [updateResult] = await conn.query(
      "UPDATE paintings SET status = 'sold' WHERE id = ? AND status = 'available'",
      [paintingId]
    );

    // If affectedRows is 0, the painting was already sold (even concurrently)
    if (updateResult.affectedRows === 0) {
      await conn.rollback();
      return res.status(409).json({
        error: 'This painting has already been sold. Please choose another painting.'
      });
    }

    // 3. Create the order record
    const orderId = `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await conn.query(
      `INSERT INTO orders (id, customer_id, painting_id, price, status)
       VALUES (?, ?, ?, ?, 'placed')`,
      [orderId, customerId, paintingId, painting.price]
    );

    await conn.commit();

    return res.status(201).json({
      message: 'Order placed successfully!',
      order: {
        id: orderId,
        customerId,
        paintingId,
        paintingTitle: painting.title,
        price: painting.price,
        status: 'placed'
      }
    });
  } catch (error) {
    await conn.rollback();
    console.error('Error creating order:', error);
    return res.status(500).json({ error: 'An unexpected error occurred while placing the order.' });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/orders
 * Customers see only their own orders. Studio sees all customer orders.
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = req.session.user;

    if (user.role === 'customer') {
      const [rows] = await pool.query(
        `SELECT o.id, o.customer_id, o.painting_id, o.price, o.status, o.created_at, o.updated_at,
                p.title AS painting_title, p.artist AS painting_artist, p.image_url AS painting_image_url
         FROM orders o
         JOIN paintings p ON o.painting_id = p.id
         WHERE o.customer_id = ?
         ORDER BY o.created_at DESC`,
        [user.id]
      );
      return res.status(200).json(rows);
    } else if (user.role === 'studio') {
      const [rows] = await pool.query(
        `SELECT o.id, o.customer_id, o.painting_id, o.price, o.status, o.created_at, o.updated_at,
                p.title AS painting_title, p.artist AS painting_artist, p.image_url AS painting_image_url,
                u.name AS customer_name, u.email AS customer_email
         FROM orders o
         JOIN paintings p ON o.painting_id = p.id
         JOIN users u ON o.customer_id = u.id
         ORDER BY o.created_at DESC`
      );
      return res.status(200).json(rows);
    } else {
      return res.status(403).json({ error: 'Unauthorized role.' });
    }
  } catch (error) {
    console.error('Error fetching orders:', error);
    return res.status(500).json({ error: 'Failed to retrieve orders.' });
  }
});

/**
 * PATCH /api/orders/:id/cancel
 * Customers cancel their own placed order.
 * Reverts order status to 'cancelled' and painting status to 'available' in one transaction.
 */
router.patch('/:id/cancel', requireRole('customer'), async (req, res) => {
  const orderId = req.params.id;
  const customerId = req.session.user.id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Verify order exists and check ownership
    const [orders] = await conn.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (orders.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = orders[0];

    // Must be owned by current customer; if another customer's record -> 404
    if (order.customer_id !== customerId) {
      await conn.rollback();
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Must still be 'placed'
    if (order.status !== 'placed') {
      await conn.rollback();
      return res.status(400).json({ error: 'Only placed orders can be cancelled.' });
    }

    // Update order status to 'cancelled'
    const [orderUpdate] = await conn.query(
      "UPDATE orders SET status = 'cancelled' WHERE id = ? AND status = 'placed'",
      [orderId]
    );

    if (orderUpdate.affectedRows === 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Order could not be cancelled.' });
    }

    // Restore painting availability
    await conn.query(
      "UPDATE paintings SET status = 'available' WHERE id = ?",
      [order.painting_id]
    );

    await conn.commit();

    return res.status(200).json({
      message: 'Order cancelled successfully. The painting is now available again.',
      orderId,
      status: 'cancelled'
    });
  } catch (error) {
    await conn.rollback();
    console.error('Error cancelling order:', error);
    return res.status(500).json({ error: 'Failed to cancel the order.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
