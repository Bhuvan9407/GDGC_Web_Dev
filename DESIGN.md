# DESIGN.md — Architecture & Design Decisions

### 1. How do login and the two roles work?
Authentication is handled using secure HTTP server-side sessions backed by MySQL (`express-session` with `express-mysql-session`) and password hashing via `bcryptjs`. There are exactly two roles: `customer` and `studio`. When a user logs in or registers as a customer, their identity and role are stored in the server session, and a tamper-proof session cookie (`connect.sid`) is returned with `httpOnly` and `sameSite` protections. Reusable backend middleware (`requireAuth` and `requireRole`) strictly verifies session state on every incoming API request rather than trusting client-submitted payloads. Unauthenticated calls return `401 Unauthorized`, wrong-role actions return `403 Forbidden`, and any attempt by a customer to inspect or cancel another customer's record yields a `404 Not Found` for complete data privacy. The studio administrator account (`studio@artstudio.in`) is pre-seeded into MySQL; public registration is exclusively restricted to customers.

### 2. Which database did you choose, and why?
We chose **MySQL** (using `mysql2/promise`) as specified in the assignment constraints. MySQL is an ideal fit for an art studio platform because the system requires strict relational integrity across customers, unique artworks, orders, date reservations, and pottery specifications. Its InnoDB engine provides full ACID transaction guarantees (`START TRANSACTION`, `COMMIT`, `ROLLBACK`), foreign key constraints, row-level locking (`FOR UPDATE`), and unique indexes. This prevents corrupt states when multiple operations depend on each other—such as simultaneously creating an order and marking an artwork as sold.

### 3. How do you stop two people from taking the same painting or date?
Concurrency is solved at the database layer through atomic transactions and database constraints:
- **Paintings (Duplicate Purchase Prevention)**: When a customer purchases a painting, the backend initiates a MySQL transaction and executes an atomic conditional update:
  ```sql
  UPDATE paintings SET status = 'sold' WHERE id = ? AND status = 'available';
  ```
  The server inspects MySQL's `affectedRows`. If `affectedRows === 0`, another customer has already purchased the painting (or a concurrent request won the lock). The transaction rolls back, and the client receives an immediate `409 Conflict` ("This painting has already been sold"). If `affectedRows === 1`, the order is inserted and committed.
- **Wall-Painting Dates (Double-Booking Prevention)**: Active date reservations are enforced using a dedicated `active_wall_dates` table with a `PRIMARY KEY (booking_date)`. Within a transaction, the booking insertion attempts to insert the date into `active_wall_dates`. If two customers submit requests for the same date at the exact same millisecond, MySQL rejects the second attempt with a duplicate key error (`ER_DUP_ENTRY`), causing an automatic rollback and a `409 Conflict` response. When a booking is cancelled by a customer or declined by the studio, the date is deleted from `active_wall_dates`, safely releasing the slot for future bookings.

### 4. Why was the frontend rewritten from React to Vanilla HTML/CSS/JS?
The original prototype used **React 18 + Vite** with `.jsx` components and a virtual DOM. The frontend was subsequently rewritten to **plain HTML5, CSS3, and native ES Modules** (`.js` files) for several reasons:

- **Zero runtime overhead**: Vanilla JS has no virtual DOM reconciliation cost, no JSX compilation, and no component lifecycle complexity. Page interactions are direct DOM mutations, which are faster and simpler to reason about for a content-focused art platform.
- **Simpler dependency footprint**: The client `package.json` now lists only `vite` as a dev dependency (for the dev server and asset proxy). There is no `react`, `react-dom`, or any JSX transform needed.
- **Interviewer transparency**: Plain DOM manipulation code is immediately readable without requiring knowledge of React hooks, context, or the component model — every function, event listener, and API call is explicit and traceable.
- **Vite retained for practical benefits**: Even without React, Vite provides instant HMR, a zero-config `/api` and `/images` proxy to the Express backend, and an optimised production bundle — so the developer experience remains smooth.
- **CSS architecture unchanged**: The full Material Design 3 CSS token system (`theme.css`) required no changes; it was always framework-agnostic CSS custom properties.

The modular breakdown maps directly to the old React pages and components:

| Old React File | New Vanilla JS File | Role |
| :--- | :--- | :--- |
| `App.jsx` + `main.jsx` | `main.js` | App entry, view router, tab switching |
| `AuthModal.jsx` + `Navbar.jsx` | `auth.js` | Session state, auth modal, nav controls |
| `CataloguePage.jsx` + `PaintingCard.jsx` | `catalogue.js` | Gallery rendering, filters, buy flow |
| `CustomerDashboard.jsx` | `customer-dashboard.js` | Orders, bookings & pottery tabs |
| `StudioDashboard.jsx` | `studio-dashboard.js` | Inventory, order/booking/pottery admin |
| `Modal.jsx` | `modal.js` | Reusable accessible dialog helper |
| `api.js` | `api.js` | Centralized `fetch` wrapper (unchanged) |
| `theme.css` | `theme.css` | M3 design tokens & components (unchanged) |

### 5. What did you finish, what did you leave out, and what would you do next?
- **What was finished**:
  - Full-stack architecture with a Vanilla HTML/CSS/JS frontend (ES Modules via Vite) and Node.js + Express + MySQL backend.
  - Complete authentication system with customer registration, login, logout, persistent sessions, and RBAC.
  - 100% of seed dataset integrated (12 authentic paintings, 5 pottery items, 6 traditional glazes, mural rate of ₹150/sq ft, pre-seeded studio admin).
  - Atomic purchase flow with 409 conflict detection and order cancellation availability restoration.
  - Wall-painting booking engine with Asia/Kolkata timezone calendar calculations, 7–90 day constraints, 10–500 sq ft validation, server price calculation, and 3-day cancellation cutoff.
  - Custom pottery request system with 14-day minimum lead time, 1–12 quantity enforcement, snapshot recording, customer editing/cancellation, and studio decision workflows.
  - Google Material Design 3 UI using custom CSS tokens, curated typography (Cinzel, Cormorant Garamond, Plus Jakarta Sans), Material Symbols, and responsive elevated cards.
  - Automated integration test suite (`test_api.js`) verifying all business rules, role protections, and concurrent collision handling.
- **What was left out (Out of Scope as per Section 06 of Brief)**:
  - Real payment gateway integration (mock purchases create persistent database orders).
  - Password resets, email verification, SMS notifications, and social logins.
  - Dynamic user file uploads for artwork images (served from static studio assets).
- **What would be done next**:
  - Implement real-time WebSocket or Server-Sent Events (SSE) notifications for instant calendar updates when a date is booked or released.
  - Add client-side image optimization (WebP delivery and responsive srcset).
  - Add email notification hooks (e.g., Nodemailer) for booking confirmations.
