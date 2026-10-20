const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { ensureDatabaseExists, pool } = require('./db');

async function seedDatabase(force = false) {
  console.log('[Seed] Ensuring database exists...');
  await ensureDatabaseExists();

  const conn = await pool.getConnection();
  try {
    console.log('[Seed] Creating relational tables if they do not exist...');

    // 1. Users table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(191) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('customer', 'studio') NOT NULL DEFAULT 'customer',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Paintings table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS paintings (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        artist VARCHAR(150) NOT NULL,
        description TEXT NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        image_url VARCHAR(255) NOT NULL,
        status ENUM('available', 'sold') NOT NULL DEFAULT 'available',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Orders table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(50) PRIMARY KEY,
        customer_id INT NOT NULL,
        painting_id VARCHAR(50) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        status ENUM('placed', 'cancelled') NOT NULL DEFAULT 'placed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_orders_customer (customer_id),
        INDEX idx_orders_painting (painting_id),
        CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT fk_orders_painting FOREIGN KEY (painting_id) REFERENCES paintings (id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Wall Bookings table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS wall_bookings (
        id VARCHAR(50) PRIMARY KEY,
        customer_id INT NOT NULL,
        booking_date DATE NOT NULL,
        wall_area DECIMAL(8, 2) NOT NULL,
        rate_per_sq_ft DECIMAL(8, 2) NOT NULL,
        total_price DECIMAL(10, 2) NOT NULL,
        service_address TEXT NOT NULL,
        status ENUM('requested', 'confirmed', 'declined', 'cancelled') NOT NULL DEFAULT 'requested',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_wall_bookings_customer (customer_id),
        INDEX idx_wall_bookings_date (booking_date),
        CONSTRAINT fk_wall_bookings_customer FOREIGN KEY (customer_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Active Wall Dates reservation table (Enforces at database level that active date is unique)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS active_wall_dates (
        booking_date DATE PRIMARY KEY,
        booking_id VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_active_booking (booking_id),
        CONSTRAINT fk_active_booking FOREIGN KEY (booking_id) REFERENCES wall_bookings (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. Pottery Items catalogue
    await conn.query(`
      CREATE TABLE IF NOT EXISTS pottery_items (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(150) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. Glazes catalogue
    await conn.query(`
      CREATE TABLE IF NOT EXISTS glazes (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(150) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 8. Pottery Requests table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS pottery_requests (
        id VARCHAR(50) PRIMARY KEY,
        customer_id INT NOT NULL,
        item_id VARCHAR(50) NOT NULL,
        item_name VARCHAR(150) NOT NULL,
        glaze_id VARCHAR(50) NOT NULL,
        glaze_name VARCHAR(150) NOT NULL,
        quantity INT NOT NULL,
        needed_by_date DATE NOT NULL,
        status ENUM('requested', 'accepted', 'declined', 'cancelled') NOT NULL DEFAULT 'requested',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_pottery_customer (customer_id),
        CONSTRAINT fk_pottery_customer FOREIGN KEY (customer_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 9. App settings
    await conn.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        setting_key VARCHAR(100) PRIMARY KEY,
        setting_value VARCHAR(255) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 10. Sessions table (express-mysql-session)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
        expires INT(11) UNSIGNED NOT NULL,
        data MEDIUMTEXT COLLATE utf8mb4_bin,
        PRIMARY KEY (session_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Check if initial seeding was already applied
    const [settings] = await conn.query('SELECT setting_value FROM app_settings WHERE setting_key = "is_seeded"');
    if (settings.length > 0 && settings[0].setting_value === 'true' && !force) {
      console.log('[Seed] Database is already seeded. Preserving existing records and user data.');
      return;
    }

    console.log('[Seed] Reading seed data from server/data/seed.json...');
    const seedFilePath = path.join(__dirname, 'data', 'seed.json');
    const rawData = fs.readFileSync(seedFilePath, 'utf8');
    const seedData = JSON.parse(rawData);

    await conn.beginTransaction();

    // Insert App Settings
    await conn.query(`
      INSERT INTO app_settings (setting_key, setting_value)
      VALUES 
        ('currency', ?),
        ('mural_rate_per_sq_ft', ?)
      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
    `, [seedData.currency || 'INR', String(seedData.mural?.ratePerSqFt || 150)]);

    // Insert Pottery Items
    for (const item of seedData.potteryItems || []) {
      await conn.query(`
        INSERT INTO pottery_items (id, name)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name);
      `, [item.id, item.name]);
    }

    // Insert Glazes
    for (const glaze of seedData.glazes || []) {
      await conn.query(`
        INSERT INTO glazes (id, name)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name);
      `, [glaze.id, glaze.name]);
    }

    // Insert Studio Admin Account
    if (seedData.studioAccount) {
      const studioEmail = seedData.studioAccount.email;
      const studioPassword = seedData.studioAccount.password;
      const hashedPassword = await bcrypt.hash(studioPassword, 10);
      
      const [existingStudio] = await conn.query('SELECT id FROM users WHERE email = ?', [studioEmail]);
      if (existingStudio.length === 0) {
        await conn.query(`
          INSERT INTO users (name, email, password_hash, role)
          VALUES (?, ?, ?, 'studio')
        `, ['Studio Administrator', studioEmail, hashedPassword]);
        console.log(`[Seed] Seeded studio admin account: ${studioEmail}`);
      }
    }

    // Insert Paintings
    for (const painting of seedData.paintings || []) {
      const [existing] = await conn.query('SELECT id FROM paintings WHERE id = ?', [painting.id]);
      if (existing.length === 0) {
        await conn.query(`
          INSERT INTO paintings (id, title, artist, description, price, image_url, status)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          painting.id,
          painting.title,
          painting.artist,
          painting.description,
          painting.price,
          painting.imageUrl,
          painting.status || 'available'
        ]);
      }
    }

    // Mark as seeded
    await conn.query(`
      INSERT INTO app_settings (setting_key, setting_value)
      VALUES ('is_seeded', 'true')
      ON DUPLICATE KEY UPDATE setting_value = 'true';
    `);

    await conn.commit();
    console.log('[Seed] Seeding completed successfully!');
  } catch (error) {
    await conn.rollback();
    console.error('[Seed] Error during seeding:', error);
    throw error;
  } finally {
    conn.release();
  }
}

// Allow direct execution: node seed.js
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('[Seed] Finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed] Failed:', err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
