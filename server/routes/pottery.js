const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../auth');

/**
 * Returns YYYY-MM-DD formatted date in Asia/Kolkata timezone
 */
function getKolkataDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

/**
 * Calculates calendar day difference between target date and today in Asia/Kolkata timezone.
 */
function getCalendarDayDifference(targetDateStr) {
  const todayStr = getKolkataDateString();
  const [tY, tM, tD] = todayStr.split('-').map(Number);
  const [bY, bM, bD] = targetDateStr.split('-').map(Number);

  const todayUtc = Date.UTC(tY, tM - 1, tD);
  const targetUtc = Date.UTC(bY, bM - 1, bD);

  return Math.round((targetUtc - todayUtc) / (1000 * 60 * 60 * 24));
}

/**
 * GET /api/pottery-requests/catalogue
 * Provides items and glazes for dropdowns
 */
router.get('/catalogue', async (req, res) => {
  try {
    const [items] = await pool.query('SELECT id, name FROM pottery_items ORDER BY id ASC');
    const [glazes] = await pool.query('SELECT id, name FROM glazes ORDER BY id ASC');
    return res.status(200).json({ items, glazes });
  } catch (error) {
    console.error('Error fetching pottery catalogue:', error);
    return res.status(500).json({ error: 'Failed to retrieve pottery catalogue.' });
  }
});

/**
 * GET /api/pottery-requests
 * Customers see only their own requests; Studio sees all requests.
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = req.session.user;

    if (user.role === 'customer') {
      const [rows] = await pool.query(
        `SELECT id, customer_id, item_id, item_name, glaze_id, glaze_name, quantity,
                DATE_FORMAT(needed_by_date, '%Y-%m-%d') AS needed_by_date, status, created_at, updated_at
         FROM pottery_requests
         WHERE customer_id = ?
         ORDER BY created_at DESC`,
        [user.id]
      );
      return res.status(200).json(rows);
    } else if (user.role === 'studio') {
      const [rows] = await pool.query(
        `SELECT r.id, r.customer_id, r.item_id, r.item_name, r.glaze_id, r.glaze_name, r.quantity,
                DATE_FORMAT(r.needed_by_date, '%Y-%m-%d') AS needed_by_date, r.status, r.created_at, r.updated_at,
                u.name AS customer_name, u.email AS customer_email
         FROM pottery_requests r
         JOIN users u ON r.customer_id = u.id
         ORDER BY r.created_at DESC`
      );
      return res.status(200).json(rows);
    } else {
      return res.status(403).json({ error: 'Unauthorized role.' });
    }
  } catch (error) {
    console.error('Error fetching pottery requests:', error);
    return res.status(500).json({ error: 'Failed to retrieve pottery requests.' });
  }
});

/**
 * POST /api/pottery-requests
 * Customer submits a custom pottery request.
 * Enforces:
 * - Valid catalogue item & glaze.
 * - Quantity between 1 and 12.
 * - Needed-by date at least 14 days in future (Asia/Kolkata).
 * - Persistent snapshot of item and glaze names in MySQL.
 */
router.post('/', requireRole('customer'), async (req, res) => {
  try {
    const { itemId, glazeId, quantity, neededByDate } = req.body;
    const customerId = req.session.user.id;

    if (!itemId || !glazeId || quantity === undefined || !neededByDate) {
      return res.status(400).json({ error: 'Pottery item, glaze, quantity, and needed-by date are required.' });
    }

    // Verify item exists
    const [itemRows] = await pool.query('SELECT id, name FROM pottery_items WHERE id = ?', [itemId]);
    if (itemRows.length === 0) {
      return res.status(400).json({ error: 'Selected pottery item is not in the catalogue.' });
    }
    const item = itemRows[0];

    // Verify glaze exists
    const [glazeRows] = await pool.query('SELECT id, name FROM glazes WHERE id = ?', [glazeId]);
    if (glazeRows.length === 0) {
      return res.status(400).json({ error: 'Selected glaze is not in the catalogue.' });
    }
    const glaze = glazeRows[0];

    // Verify quantity (1 to 12)
    const numericQty = parseInt(quantity, 10);
    if (isNaN(numericQty) || numericQty < 1 || numericQty > 12) {
      return res.status(400).json({ error: 'Quantity must be an integer between 1 and 12.' });
    }

    // Verify date format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(String(neededByDate).trim())) {
      return res.status(400).json({ error: 'Needed-by date must be in YYYY-MM-DD format.' });
    }
    const dateStr = String(neededByDate).trim();

    // Verify date >= 14 days in future
    const diffDays = getCalendarDayDifference(dateStr);
    if (isNaN(diffDays)) {
      return res.status(400).json({ error: 'Invalid needed-by date.' });
    }
    if (diffDays < 14) {
      return res.status(400).json({ error: 'Needed-by date must be at least 14 days in the future.' });
    }

    const requestId = `pot-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    await pool.query(
      `INSERT INTO pottery_requests (id, customer_id, item_id, item_name, glaze_id, glaze_name, quantity, needed_by_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'requested')`,
      [requestId, customerId, item.id, item.name, glaze.id, glaze.name, numericQty, dateStr]
    );

    return res.status(201).json({
      message: 'Pottery request submitted successfully!',
      request: {
        id: requestId,
        customerId,
        itemId: item.id,
        itemName: item.name,
        glazeId: glaze.id,
        glazeName: glaze.name,
        quantity: numericQty,
        neededByDate: dateStr,
        status: 'requested'
      }
    });
  } catch (error) {
    console.error('Error creating pottery request:', error);
    return res.status(500).json({ error: 'Failed to submit pottery request.' });
  }
});

/**
 * PATCH /api/pottery-requests/:id
 * Customer edits a request ONLY while status is 'requested'.
 */
router.patch('/:id', requireRole('customer'), async (req, res) => {
  try {
    const requestId = req.params.id;
    const customerId = req.session.user.id;
    const { itemId, glazeId, quantity, neededByDate } = req.body;

    const [rows] = await pool.query('SELECT * FROM pottery_requests WHERE id = ?', [requestId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Pottery request not found.' });
    }

    const request = rows[0];

    // Ownership check: if another customer's record -> 404
    if (request.customer_id !== customerId) {
      return res.status(404).json({ error: 'Pottery request not found.' });
    }

    // Editable only while 'requested'
    if (request.status !== 'requested') {
      return res.status(400).json({
        error: `A pottery request that has already been ${request.status} cannot be edited.`
      });
    }

    const updates = [];
    const params = [];

    if (itemId !== undefined) {
      const [itemRows] = await pool.query('SELECT id, name FROM pottery_items WHERE id = ?', [itemId]);
      if (itemRows.length === 0) {
        return res.status(400).json({ error: 'Selected pottery item is not in the catalogue.' });
      }
      updates.push('item_id = ?', 'item_name = ?');
      params.push(itemRows[0].id, itemRows[0].name);
    }

    if (glazeId !== undefined) {
      const [glazeRows] = await pool.query('SELECT id, name FROM glazes WHERE id = ?', [glazeId]);
      if (glazeRows.length === 0) {
        return res.status(400).json({ error: 'Selected glaze is not in the catalogue.' });
      }
      updates.push('glaze_id = ?', 'glaze_name = ?');
      params.push(glazeRows[0].id, glazeRows[0].name);
    }

    if (quantity !== undefined) {
      const numericQty = parseInt(quantity, 10);
      if (isNaN(numericQty) || numericQty < 1 || numericQty > 12) {
        return res.status(400).json({ error: 'Quantity must be an integer between 1 and 12.' });
      }
      updates.push('quantity = ?');
      params.push(numericQty);
    }

    if (neededByDate !== undefined) {
      const dateStr = String(neededByDate).trim();
      const diffDays = getCalendarDayDifference(dateStr);
      if (isNaN(diffDays) || diffDays < 14) {
        return res.status(400).json({ error: 'Needed-by date must be at least 14 days in the future.' });
      }
      updates.push('needed_by_date = ?');
      params.push(dateStr);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields provided to update.' });
    }

    params.push(requestId);
    await pool.query(
      `UPDATE pottery_requests SET ${updates.join(', ')} WHERE id = ? AND status = 'requested'`,
      params
    );

    const [updated] = await pool.query(
      `SELECT id, customer_id, item_id, item_name, glaze_id, glaze_name, quantity,
              DATE_FORMAT(needed_by_date, '%Y-%m-%d') AS needed_by_date, status, updated_at
       FROM pottery_requests WHERE id = ?`,
      [requestId]
    );

    return res.status(200).json({
      message: 'Pottery request updated successfully.',
      request: updated[0]
    });
  } catch (error) {
    console.error('Error updating pottery request:', error);
    return res.status(500).json({ error: 'Failed to update pottery request.' });
  }
});

/**
 * PATCH /api/pottery-requests/:id/cancel
 * Customer cancels request ONLY while status is 'requested'.
 */
router.patch('/:id/cancel', requireRole('customer'), async (req, res) => {
  try {
    const requestId = req.params.id;
    const customerId = req.session.user.id;

    const [rows] = await pool.query('SELECT * FROM pottery_requests WHERE id = ?', [requestId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Pottery request not found.' });
    }

    const request = rows[0];

    // Ownership check: if another customer's record -> 404
    if (request.customer_id !== customerId) {
      return res.status(404).json({ error: 'Pottery request not found.' });
    }

    // Cancellable only while 'requested'
    if (request.status !== 'requested') {
      return res.status(400).json({
        error: `A pottery request that has already been ${request.status} cannot be cancelled.`
      });
    }

    await pool.query(
      "UPDATE pottery_requests SET status = 'cancelled' WHERE id = ? AND status = 'requested'",
      [requestId]
    );

    return res.status(200).json({
      message: 'Pottery request cancelled successfully.',
      requestId,
      status: 'cancelled'
    });
  } catch (error) {
    console.error('Error cancelling pottery request:', error);
    return res.status(500).json({ error: 'Failed to cancel pottery request.' });
  }
});

/**
 * PATCH /api/pottery-requests/:id/status
 * Studio accepts or declines a requested pottery order.
 * Reject invalid or repeated status transitions.
 */
router.patch('/:id/status', requireRole('studio'), async (req, res) => {
  try {
    const requestId = req.params.id;
    const { status } = req.body;

    if (!status || !['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Permitted values: 'accepted' or 'declined'." });
    }

    const [rows] = await pool.query('SELECT * FROM pottery_requests WHERE id = ?', [requestId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Pottery request not found.' });
    }

    const request = rows[0];

    // Only allow transition from 'requested'
    if (request.status !== 'requested') {
      return res.status(400).json({
        error: `Cannot update pottery request. Current status is '${request.status}'. Only 'requested' orders can be accepted or declined.`
      });
    }

    await pool.query(
      'UPDATE pottery_requests SET status = ? WHERE id = ?',
      [status, requestId]
    );

    return res.status(200).json({
      message: `Pottery request has been ${status}.`,
      requestId,
      status
    });
  } catch (error) {
    console.error('Error updating pottery request status:', error);
    return res.status(500).json({ error: 'Failed to update pottery request status.' });
  }
});

module.exports = router;
