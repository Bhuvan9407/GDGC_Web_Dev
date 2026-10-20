const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireRole } = require('../auth');

/**
 * GET /api/paintings
 * Browse all paintings. Accessible to anyone (guests, customers, studio).
 */
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, title, artist, description, price, image_url AS imageUrl, status, created_at, updated_at
      FROM paintings
      ORDER BY id ASC
    `);
    return res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching paintings:', error);
    return res.status(500).json({ error: 'Failed to retrieve paintings.' });
  }
});

/**
 * POST /api/paintings
 * Studio adds a new painting. Status is automatically 'available'.
 */
router.post('/', requireRole('studio'), async (req, res) => {
  try {
    const { title, artist, description, price, imageUrl } = req.body;

    if (!title || !artist || !description || price === undefined || price === null) {
      return res.status(400).json({ error: 'Title, artist, description, and price are required.' });
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({ error: 'Price must be a positive number.' });
    }

    // Generate unique ID (e.g., p-101, p-102...)
    const paintingId = `p-${Date.now()}`;
    const finalImageUrl = imageUrl && typeof imageUrl === 'string' && imageUrl.trim().length > 0
      ? imageUrl.trim()
      : 'images/p-001.jpg';

    await pool.query(
      `INSERT INTO paintings (id, title, artist, description, price, image_url, status)
       VALUES (?, ?, ?, ?, ?, ?, 'available')`,
      [paintingId, title.trim(), artist.trim(), description.trim(), numericPrice, finalImageUrl]
    );

    const [rows] = await pool.query(
      'SELECT id, title, artist, description, price, image_url AS imageUrl, status FROM paintings WHERE id = ?',
      [paintingId]
    );

    return res.status(201).json({
      message: 'Painting created successfully.',
      painting: rows[0]
    });
  } catch (error) {
    console.error('Error creating painting:', error);
    return res.status(500).json({ error: 'Failed to create painting.' });
  }
});

/**
 * PATCH /api/paintings/:id
 * Studio edits an existing painting ONLY while it is available.
 * Sold paintings CANNOT be edited.
 */
router.patch('/:id', requireRole('studio'), async (req, res) => {
  try {
    const paintingId = req.params.id;
    const { title, artist, description, price, imageUrl } = req.body;

    // Check existing painting
    const [existing] = await pool.query('SELECT * FROM paintings WHERE id = ?', [paintingId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Painting not found.' });
    }

    const painting = existing[0];
    if (painting.status === 'sold') {
      return res.status(400).json({ error: 'Sold paintings cannot be edited.' });
    }

    const updates = [];
    const params = [];

    if (title !== undefined && title.trim().length > 0) {
      updates.push('title = ?');
      params.push(title.trim());
    }
    if (artist !== undefined && artist.trim().length > 0) {
      updates.push('artist = ?');
      params.push(artist.trim());
    }
    if (description !== undefined && description.trim().length > 0) {
      updates.push('description = ?');
      params.push(description.trim());
    }
    if (price !== undefined) {
      const numericPrice = parseFloat(price);
      if (isNaN(numericPrice) || numericPrice <= 0) {
        return res.status(400).json({ error: 'Price must be a positive number.' });
      }
      updates.push('price = ?');
      params.push(numericPrice);
    }
    if (imageUrl !== undefined && imageUrl.trim().length > 0) {
      updates.push('image_url = ?');
      params.push(imageUrl.trim());
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    params.push(paintingId);
    await pool.query(
      `UPDATE paintings SET ${updates.join(', ')} WHERE id = ? AND status = 'available'`,
      params
    );

    const [updated] = await pool.query(
      'SELECT id, title, artist, description, price, image_url AS imageUrl, status FROM paintings WHERE id = ?',
      [paintingId]
    );

    return res.status(200).json({
      message: 'Painting updated successfully.',
      painting: updated[0]
    });
  } catch (error) {
    console.error('Error updating painting:', error);
    return res.status(500).json({ error: 'Failed to update painting.' });
  }
});

module.exports = router;
