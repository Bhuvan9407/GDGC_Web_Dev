const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

const { pool, dbConfig } = require('./db');
const { seedDatabase } = require('./seed');

const authRoutes = require('./routes/auth');
const paintingsRoutes = require('./routes/paintings');
const ordersRoutes = require('./routes/orders');
const bookingsRoutes = require('./routes/bookings');
const potteryRoutes = require('./routes/pottery');

const app = express();
const PORT = process.env.PORT || 5000;
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// 1. CORS Configuration for secure credential handling across origins
app.use(cors({
  origin: clientOrigin,
  credentials: true
}));

// 2. Request body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Serve painting image assets statically
app.use('/images', express.static(path.join(__dirname, 'data/images')));

// 4. Configure MySQL-backed session store
const sessionStore = new MySQLStore({
  clearExpired: true,
  checkExpirationInterval: 900000, // 15 mins
  expiration: 86400000,            // 1 day
  createDatabaseTable: true,
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
}, pool);

app.use(session({
  key: 'connect.sid',
  secret: process.env.SESSION_SECRET || 'art_studio_default_secret_key_98765',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

// 5. Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/paintings', paintingsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/pottery-requests', potteryRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// Centralized error handler (Sanitizes stack traces from leaking to client)
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'An internal server error occurred.'
  });
});

// Start server and initialize database tables idempotently
async function startServer() {
  try {
    console.log('[Server] Checking and initializing database tables and seed data...');
    await seedDatabase(false);
  } catch (seedErr) {
    console.warn('[Server] Note: Database initialization failed or database not yet reachable. Check MySQL credentials in .env:', seedErr.message);
  }

  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`Art Studio API Server is running on port ${PORT}`);
    console.log(`Client Origin: ${clientOrigin}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`===============================================`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = app;
module.exports.startServer = startServer;
