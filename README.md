# KalaKriti Art Studio — Full-Stack Web Platform

> **Google Developer Groups on Campus (GDGC)** — Web Development Volunteer Recruitment Assignment  
> Handcrafted with **React + Vite**, **Node.js + Express**, **MySQL**, and **Google Material Design 3**.

---

## 🎨 Project Overview

**KalaKriti Art Studio** is a full-stack art platform dedicated to traditional Indian art forms (Madhubani, Warli, Tanjore, Pattachitra, Kalamkari, Gond, Cheriyal, and Nirmal). The application enables customers to:
1. **Purchase One-of-a-Kind Paintings**: Browse authentic original artworks, view pricing and descriptions, and place persistent orders with guaranteed single-collector ownership.
2. **Book Professional Wall-Painting Murals**: Select future dates (7–90 days), specify wall dimensions (10–500 sq ft), receive server-calculated pricing at ₹150/sq ft, and manage bookings up to 3 days prior.
3. **Request Custom Handcrafted Pottery**: Choose genuine clay forms (Kulhad, Surahi, Matka, Diya set, Gamla) and authentic glazes (Kumkum Red, Haldi Yellow, Mehendi Green, etc.) with lead times of 14+ days.

A dedicated **Studio Administrator** role oversees inventory, reviews orders, confirms or declines mural dates, and accepts custom pottery commissions.

---

## 🚀 Key Features & Highlights

- **Google Material Design 3 UI**: Implemented with pure CSS custom property tokens (`--md-sys-color-primary`, `--md-shape-corner-*`, `--md-elevation-*`), Roboto typography, and Google Material Symbols.
- **Strict Role-Based Access Control (RBAC)**: Server-side validation on every endpoint. Customers cannot perform studio operations (403), unauthorized callers receive 401, and cross-customer record tampering returns 404.
- **Atomic Concurrency Prevention**:
  - **No Duplicate Artwork Purchases**: MySQL transactions with atomic conditional updates ensure that two simultaneous requests for the same painting cannot both succeed.
  - **No Double-Booked Wall Dates**: Database-enforced uniqueness via an `active_wall_dates` table guarantees a date is reserved only once across concurrent requests.
- **Idempotent Database Seeding**: Auto-initializes schema, seeds the studio administrator and catalogue data, and preserves user transactions across server restarts without resetting existing records.
- **Automated Test Suite**: Built-in integration tests (`npm run test`) validating authentication, transactions, concurrency collisions, date rules, and catalog locks.

---

## 🛠️ Technology Stack & Justification

| Technology | Purpose | Justification |
| :--- | :--- | :--- |
| **React 18 & Vite** | Frontend Architecture | Fast modern bundler with instant HMR and clean functional components without heavy framework overhead. |
| **Plain CSS & Material Design 3** | Visual Design & Styling | Follows official Google M3 design token guidelines without third-party UI bloat, keeping code readable for interview defense. |
| **Node.js & Express** | Backend REST API | Lightweight, modular REST architecture with straightforward middleware pipelines. |
| **MySQL & mysql2/promise** | Relational Database | ACID transactions, foreign keys, row-level locks, and strict relational integrity across orders and bookings. |
| **express-session & express-mysql-session** | Authentication Store | Secure server-side sessions stored persistently in MySQL with `httpOnly` and `sameSite` cookie security. |
| **bcryptjs** | Password Hashing | Industry-standard salt-and-hash algorithm; plain-text passwords are never stored in the database. |

---

## 📋 Prerequisites

Before running the application on Windows, verify you have installed:
1. **Node.js** (v18.x or higher, v20+ recommended) — `node -v`
2. **npm** (v9.x or higher) — `npm -v`
3. **MySQL Server 8.0** running locally on port `3306` — `Get-Service MySQL80`

---

## ⚙️ Environment Configuration

1. In the project root folder, copy `.env.example` to create `.env`:
   ```powershell
   Copy-Item .env.example .env
   ```
2. Open `.env` and configure your local MySQL credentials:
   ```ini
   # Database Configuration (MySQL)
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=YOUR_MYSQL_PASSWORD_HERE
   DB_NAME=art_studio_db

   # Server Configuration
   PORT=5000
   SESSION_SECRET=art_studio_super_secret_session_key_2026

   # Client / CORS Configuration
   CLIENT_ORIGIN=http://localhost:5173
   ```

---

## 📦 Installation & Setup

Open **Windows PowerShell** inside the project folder (`GDGC_Web`):

### 1. Install all dependencies (Root, Server, and Client)
```powershell
npm run install:all
```

### 2. Initialize and Seed the MySQL Database
```powershell
npm run seed
```
> *Note:* The seed script automatically creates the database `art_studio_db` (if it does not already exist), creates all relational tables, and inserts the seed dataset (12 paintings, 5 pottery items, 6 glazes, rate setting of ₹150, and the demo studio account).  
> Running `npm run seed` multiple times is safe and **idempotent**—it will never overwrite your existing orders or paintings.

---

## 🏃 Running the Application

### Option A: Run Both Frontend and Backend Concurrently (Recommended)
```powershell
npm run dev
```
- **Backend API**: Runs on [http://localhost:5000](http://localhost:5000)
- **Frontend App**: Runs on [http://localhost:5173](http://localhost:5173)

### Option B: Run in Separate PowerShell Windows
- **Terminal 1 (Backend Server)**:
  ```powershell
  npm run dev:server
  ```
- **Terminal 2 (Frontend Client)**:
  ```powershell
  npm run dev:client
  ```

Open your browser and navigate to: **`http://localhost:5173`**

---

## 🔑 Demo Accounts & Login Instructions

### 1. Seeded Studio Administrator Account
- **Email**: `studio@artstudio.in`
- **Password**: `Studio@123`
- **Role**: `studio`
- *Access*: Can manage the painting inventory (add new paintings, edit available paintings), view all customer orders, confirm/decline wall bookings, and accept/decline pottery requests.
- *Quick Tip*: The login modal includes a one-click button **"Use Seeded Studio Admin"** to automatically populate these credentials.

### 2. Customer Account
- Click **"Sign In"** in the top navigation bar.
- Switch to the **"Customer Register"** tab.
- Enter your Name, Email, and a Password (minimum 6 characters) to create an account.
- Once registered, you will be automatically signed in as a `customer` with access to the **"My Dashboard"** section.

---

## 🧪 Testing & Verification

### Running the Automated Test Suite
To execute the automated end-to-end integration test suite:
```powershell
npm run test
```
This tests the full business logic against Express and MySQL:
- ✅ Idempotent database initialization and seed retention
- ✅ 12 paintings loaded; initial sold states (`p-004`, `p-009`) preserved
- ✅ Unauthenticated calls blocked with `401 Unauthorized`
- ✅ Customer registration, duplicate email rejection (`409 Conflict`), and Studio login
- ✅ Role-Based Access Control (`403 Forbidden` for wrong role actions)
- ✅ Studio edit constraints (sold paintings rejected with `400 Bad Request`)
- ✅ Atomic painting purchase & duplicate purchase prevention (`409 Conflict`)
- ✅ **Simultaneous concurrent purchase test**: Only one succeeds, other gets 409
- ✅ Customer order cancellation & instant painting availability restoration
- ✅ Cross-customer access prevention (`404 Not Found`)
- ✅ Wall booking validation (7–90 days, 10–500 sq ft, Asia/Kolkata date calculations)
- ✅ **Simultaneous concurrent date booking test**: Only one reserves date, other gets 409
- ✅ 3-day booking cancellation cutoff enforcement and date release
- ✅ Studio confirm/decline status transitions
- ✅ Pottery catalogue inspection, lead time enforcement (>= 14 days), snapshot storage, customer editing/cancellation, and studio decisions

### Manual Verification Flow
1. **Browse Gallery**: Visit `http://localhost:5173`. Notice 12 authentic paintings; paintings `p-004` and `p-009` are marked `SOLD`.
2. **Buy a Painting**: Sign in as a customer, click **"Buy Now"** on an available painting. Confirm the order. The painting card immediately transitions to `SOLD`.
3. **Cancel Order**: Go to **My Dashboard -> My Orders**. Click **"Cancel Order"**. The order becomes `CANCELLED` and returning to the gallery shows the painting is `AVAILABLE` again!
4. **Wall Mural Booking**: Go to **My Dashboard -> Wall-Painting Bookings**. Pick a date between 7 and 90 days away, adjust the wall size (e.g., 100 sq ft), enter an address, and submit. The server calculates the exact total (₹15,000).
5. **Studio Decision**: Log out, sign in with the Studio account (`studio@artstudio.in` / `Studio@123`), open **Studio Admin**, review the booking, and click **Confirm** or **Decline**.

---

## 📂 Project Structure

```
GDGC_Web/
├── client/                     # Frontend Application
│   ├── public/
│   │   └── images/             # Seed painting image assets (p-001.jpg - p-012.jpg)
│   ├── src/
│   │   ├── components/
│   │   │   ├── AuthModal.jsx   # Login & Customer Registration Dialog
│   │   │   ├── EmptyState.jsx  # Empty state visual placeholder
│   │   │   ├── ErrorBanner.jsx # Error container banner with retry
│   │   │   ├── LoadingSpinner.jsx # Accessible progress indicator
│   │   │   ├── Modal.jsx       # Material 3 accessible dialog
│   │   │   ├── Navbar.jsx      # Top app bar with user role chip
│   │   │   ├── PaintingCard.jsx# Elevated card with M3 typography & buttons
│   │   │   └── StatusChip.jsx  # Color-coded M3 status chips
│   │   ├── pages/
│   │   │   ├── CataloguePage.jsx   # Painting gallery with filters & buy modal
│   │   │   ├── CustomerDashboard.jsx # Orders, Bookings & Pottery tabs
│   │   │   └── StudioDashboard.jsx # Inventory, Orders, Bookings & Pottery admin
│   │   ├── api.js              # Centralized fetch wrapper with credentials
│   │   ├── App.jsx             # Main application layout and navigation
│   │   ├── main.jsx            # React root mount
│   │   └── theme.css           # Material 3 CSS tokens, components & utilities
│   ├── index.html              # Entry HTML with Roboto & Material Symbols
│   ├── package.json            # Client dependencies
│   └── vite.config.js          # Vite config with API proxy
├── server/                     # Backend API & Database
│   ├── data/
│   │   ├── images/             # Original seed painting assets
│   │   └── seed.json           # Supplied JSON dataset
│   ├── routes/
│   │   ├── auth.js             # Register, Login, Logout, Me
│   │   ├── paintings.js        # Browse, Studio Add, Studio Edit
│   │   ├── orders.js           # Atomic Purchase, My/All Orders, Cancel Order
│   │   ├── bookings.js         # Wall Bookings, Date Reservations, Studio Decisions
│   │   └── pottery.js          # Pottery Catalogue, Requests, Edit, Cancel, Decisions
│   ├── auth.js                 # requireAuth & requireRole middleware
│   ├── db.js                   # MySQL2 connection pool & DB initialization
│   ├── index.js                # Express app entry & session configuration
│   ├── seed.js                 # Idempotent table creation & seed migration
│   └── package.json            # Server dependencies
├── .env.example                # Template configuration file
├── .gitignore                  # Git exclusions for secrets and node_modules
├── DESIGN.md                   # Technical design decisions & interview answers
├── package.json                # Root orchestrator with concurrently & scripts
├── README.md                   # Full documentation & setup guide
└── test_api.js                 # Automated API test suite
```

---

## 🔒 Security & Data Integrity Details

1. **Parameterization**: All database interactions use prepared statements (`?` placeholders) with MySQL2, eliminating SQL injection risks.
2. **Session Storage**: User sessions are stored server-side in the MySQL `sessions` table. No sensitive user passwords or tokens are stored in cookies or localStorage.
3. **Cookie Configuration**: Session cookies are configured with `httpOnly: true`, preventing client-side script access, and `sameSite: 'lax'`.
4. **Data Isolation**: Customers can only query and cancel their own records. Record lookups check `WHERE customer_id = req.session.user.id`; unauthorized attempts return 404.
5. **Snapshot Architecture**: Custom pottery requests store both the item/glaze IDs and their names as frozen snapshots to prevent catalog updates from mutating past orders.

---

## 📄 License & Attribution

Developed for the **Google Developer Groups on Campus (GDGC)** Web Development domain recruitments. Built strictly in compliance with the assignment brief.
