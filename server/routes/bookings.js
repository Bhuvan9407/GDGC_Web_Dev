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
 * GET /api/bookings/booked-dates
 * Public/Customer helper endpoint to retrieve active reserved dates
 */
router.get('/booked-dates', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT DATE_FORMAT(booking_date, "%Y-%m-%d") AS booking_date FROM active_wall_dates');
    const dates = rows.map((r) => r.booking_date);
    return res.status(200).json(dates);
  } catch (error) {
    console.error('Error fetching booked dates:', error);
    return res.status(500).json({ error: 'Failed to retrieve booked dates.' });
  }
});

/**
 * GET /api/bookings
 * Customers view their own bookings; Studio views all bookings.
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = req.session.user;

    if (user.role === 'customer') {
      const [rows] = await pool.query(
        `SELECT id, customer_id, DATE_FORMAT(booking_date, '%Y-%m-%d') AS booking_date,
                wall_area, rate_per_sq_ft, total_price, service_address, status, created_at, updated_at
         FROM wall_bookings
         WHERE customer_id = ?
         ORDER BY booking_date ASC, created_at DESC`,
        [user.id]
      );
      return res.status(200).json(rows);
    } else if (user.role === 'studio') {
      const [rows] = await pool.query(
        `SELECT b.id, b.customer_id, DATE_FORMAT(b.booking_date, '%Y-%m-%d') AS booking_date,
                b.wall_area, b.rate_per_sq_ft, b.total_price, b.service_address, b.status, b.created_at, b.updated_at,
                u.name AS customer_name, u.email AS customer_email
         FROM wall_bookings b
         JOIN users u ON b.customer_id = u.id
         ORDER BY b.booking_date ASC, b.created_at DESC`
      );
      return res.status(200).json(rows);
    } else {
      return res.status(403).json({ error: 'Unauthorized role.' });
    }
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return res.status(500).json({ error: 'Failed to retrieve bookings.' });
  }
});

/**
 * POST /api/bookings
 * Customer creates a wall-painting booking.
 * Enforces:
 * - 7 to 90 days in the future (Asia/Kolkata).
 * - 10 to 500 sq ft wall area.
 * - Non-empty address.
 * - Server-calculated pricing using rate from database.
 * - Database-enforced atomic date reservation in active_wall_dates.
 */
router.post('/', requireRole('customer'), async (req, res) => {
  const { bookingDate, wallArea, serviceAddress } = req.body;
  const customerId = req.session.user.id;

  // Validate presence
  if (!bookingDate || wallArea === undefined || wallArea === null || !serviceAddress) {
    return res.status(400).json({ error: 'Booking date, wall area, and service address are required.' });
  }

  // Validate date format YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(String(bookingDate).trim())) {
    return res.status(400).json({ error: 'Booking date must be in YYYY-MM-DD format.' });
  }
  const dateStr = String(bookingDate).trim();

  // Validate date range (7 to 90 calendar days in Asia/Kolkata)
  const diffDays = getCalendarDayDifference(dateStr);
  if (isNaN(diffDays)) {
    return res.status(400).json({ error: 'Invalid booking date.' });
  }
  if (diffDays < 7) {
    return res.status(400).json({ error: 'Booking date must be at least 7 days in the future.' });
  }
  if (diffDays > 90) {
    return res.status(400).json({ error: 'Booking date cannot be more than 90 days in the future.' });
  }

  // Validate wall area (10 to 500 sq ft)
  const numericArea = parseFloat(wallArea);
  if (isNaN(numericArea) || numericArea < 10 || numericArea > 500) {
    return res.status(400).json({ error: 'Wall area must be between 10 and 500 square feet.' });
  }

  // Validate address
  const trimmedAddress = String(serviceAddress).trim();
  if (trimmedAddress.length === 0) {
    return res.status(400).json({ error: 'Service address is required.' });
  }

  // Fetch current rate from app_settings
  let rate = 150;
  const [rateSetting] = await pool.query('SELECT setting_value FROM app_settings WHERE setting_key = "mural_rate_per_sq_ft"');
  if (rateSetting.length > 0) {
    rate = parseFloat(rateSetting[0].setting_value) || 150;
  }

  const totalPrice = numericArea * rate;
  const bookingId = `book-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Insert into wall_bookings table first
    await conn.query(
      `INSERT INTO wall_bookings (id, customer_id, booking_date, wall_area, rate_per_sq_ft, total_price, service_address, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'requested')`,
      [bookingId, customerId, dateStr, numericArea, rate, totalPrice, trimmedAddress]
    );

    // Atomically reserve the date in active_wall_dates (Primary key enforces single active booking per date)
    try {
      await conn.query(
        'INSERT INTO active_wall_dates (booking_date, booking_id) VALUES (?, ?)',
        [dateStr, bookingId]
      );
    } catch (insertError) {
      if (insertError.code === 'ER_DUP_ENTRY' || insertError.errno === 1062) {
        await conn.rollback();
        return res.status(409).json({
          error: 'This date has already been booked. Please choose a different date.'
        });
      }
      throw insertError;
    }

    await conn.commit();

    return res.status(201).json({
      message: 'Wall painting booking requested successfully!',
      booking: {
        id: bookingId,
        customerId,
        bookingDate: dateStr,
        wallArea: numericArea,
        ratePerSqFt: rate,
        totalPrice,
        serviceAddress: trimmedAddress,
        status: 'requested'
      }
    });
  } catch (error) {
    await conn.rollback();
    console.error('Error creating wall booking:', error);
    return res.status(500).json({ error: 'Failed to create booking.' });
  } finally {
    conn.release();
  }
});

/**
 * PATCH /api/bookings/:id/cancel
 * Customers cancel their own eligible booking until three calendar days before the date.
 * Releases the reserved date atomically.
 */
router.patch('/:id/cancel', requireRole('customer'), async (req, res) => {
  const bookingId = req.params.id;
  const customerId = req.session.user.id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [bookings] = await conn.query(
      "SELECT id, customer_id, DATE_FORMAT(booking_date, '%Y-%m-%d') AS booking_date, status FROM wall_bookings WHERE id = ?",
      [bookingId]
    );

    if (bookings.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const booking = bookings[0];

    // Ownership check: if another customer's record -> 404
    if (booking.customer_id !== customerId) {
      await conn.rollback();
      return res.status(404).json({ error: 'Booking not found.' });
    }

    // Status check
    if (booking.status === 'cancelled') {
      await conn.rollback();
      return res.status(400).json({ error: 'This booking is already cancelled.' });
    }
    if (booking.status === 'declined') {
      await conn.rollback();
      return res.status(400).json({ error: 'This booking was declined by the studio and cannot be cancelled.' });
    }

    // Cancellation deadline check: at least 3 calendar days remaining
    const diffDays = getCalendarDayDifference(booking.booking_date);
    if (diffDays < 3) {
      await conn.rollback();
      return res.status(400).json({
        error: 'Bookings can only be cancelled at least 3 calendar days before the scheduled date.'
      });
    }

    // Update status to 'cancelled'
    await conn.query(
      "UPDATE wall_bookings SET status = 'cancelled' WHERE id = ?",
      [bookingId]
    );

    // Release the active date reservation
    await conn.query(
      'DELETE FROM active_wall_dates WHERE booking_date = ?',
      [booking.booking_date]
    );

    await conn.commit();

    return res.status(200).json({
      message: 'Booking cancelled successfully. The date has been released.',
      bookingId,
      status: 'cancelled'
    });
  } catch (error) {
    await conn.rollback();
    console.error('Error cancelling booking:', error);
    return res.status(500).json({ error: 'Failed to cancel booking.' });
  } finally {
    conn.release();
  }
});

/**
 * PATCH /api/bookings/:id/status
 * Studio confirms or declines a requested booking.
 * Declining releases the date reservation; confirming keeps the date reserved.
 * Invalid status transitions (e.g., confirming a declined or cancelled booking) are rejected.
 */
router.patch('/:id/status', requireRole('studio'), async (req, res) => {
  const bookingId = req.params.id;
  const { status } = req.body;

  if (!status || !['confirmed', 'declined'].includes(status)) {
    return res.status(400).json({ error: "Invalid status. Permitted values: 'confirmed' or 'declined'." });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [bookings] = await conn.query(
      "SELECT id, customer_id, DATE_FORMAT(booking_date, '%Y-%m-%d') AS booking_date, status FROM wall_bookings WHERE id = ?",
      [bookingId]
    );

    if (bookings.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const booking = bookings[0];

    // Only bookings in 'requested' status can transition to 'confirmed' or 'declined'
    if (booking.status !== 'requested') {
      await conn.rollback();
      return res.status(400).json({
        error: `Cannot update booking status. Current status is '${booking.status}'. Only 'requested' bookings can be confirmed or declined.`
      });
    }

    // Update status
    await conn.query(
      'UPDATE wall_bookings SET status = ? WHERE id = ?',
      [status, bookingId]
    );

    // If declined, release the active date reservation
    if (status === 'declined') {
      await conn.query(
        'DELETE FROM active_wall_dates WHERE booking_date = ?',
        [booking.booking_date]
      );
    }

    await conn.commit();

    return res.status(200).json({
      message: `Booking has been ${status}.`,
      bookingId,
      status
    });
  } catch (error) {
    await conn.rollback();
    console.error('Error updating booking status:', error);
    return res.status(500).json({ error: 'Failed to update booking status.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
