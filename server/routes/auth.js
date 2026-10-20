const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db');

// Validation helper
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && emailRegex.test(email.trim());
}

/**
 * POST /api/auth/register
 * Customer registration only. Studio role cannot be registered.
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate inputs
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required.' });
    }
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    // Check for duplicate email
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [trimmedEmail]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert new customer (Strictly 'customer' role)
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, "customer")',
      [trimmedName, trimmedEmail, passwordHash]
    );

    const newUser = {
      id: result.insertId,
      name: trimmedName,
      email: trimmedEmail,
      role: 'customer'
    };

    // Establish persistent login session
    req.session.user = newUser;
    req.session.save((err) => {
      if (err) {
        console.error('Session save error during registration:', err);
        return res.status(500).json({ error: 'Registration succeeded, but session initialization failed.' });
      }
      return res.status(201).json({
        message: 'Account created successfully.',
        user: newUser
      });
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

/**
 * POST /api/auth/login
 * Handles both customer and studio accounts.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const trimmedEmail = String(email).trim().toLowerCase();

    // Query user
    const [rows] = await pool.query(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = ?',
      [trimmedEmail]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = rows[0];

    // Verify bcrypt hash
    const isMatch = await bcrypt.compare(String(password), user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Establish persistent session
    const sessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    req.session.user = sessionUser;
    req.session.save((err) => {
      if (err) {
        console.error('Session save error during login:', err);
        return res.status(500).json({ error: 'Session establishment failed.' });
      }
      return res.status(200).json({
        message: 'Logged in successfully.',
        user: sessionUser
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
});

/**
 * POST /api/auth/logout
 * Destroys session and clears cookie
 */
router.post('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ error: 'Could not log out. Please try again.' });
      }
      res.clearCookie('connect.sid');
      return res.status(200).json({ message: 'Logged out successfully.' });
    });
  } else {
    return res.status(200).json({ message: 'No active session.' });
  }
});

/**
 * GET /api/auth/me
 * Retrieves the currently authenticated user
 */
router.get('/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.status(200).json({ user: req.session.user });
  }
  return res.status(200).json({ user: null });
});

module.exports = router;
