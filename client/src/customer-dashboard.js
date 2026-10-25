/**
 * KalaKriti Art Studio — Customer Dashboard Module
 *
 * Implements:
 * - Customer Orders: Browsing acquired paintings & eligible order cancellation
 * - Wall Bookings: 7-90 day validation, 10-500 sq ft, ₹150/sq ft calculation, booked dates display, 3-day cancel rule
 * - Custom Pottery: Catalogue & Glaze selection, 1-12 qty, >=14 day date, edit/cancel while requested
 */

import { api } from './api.js';
import { getCurrentUser, escapeHtml } from './auth.js';
import { openModal, closeModal, confirmDialog, showToast } from './modal.js';

let activeTab = 'orders'; // 'orders' | 'bookings' | 'pottery'

// Local cache
let orders = [];
let bookings = [];
let bookedDates = [];
let potteryRequests = [];
let potteryCatalogue = { items: [], glazes: [] };

// Timezone-safe Asia/Kolkata date generator
function getKolkataDate(daysOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function getDaysRemaining(targetDateStr) {
  const todayStr = getKolkataDate(0);
  const [tY, tM, tD] = todayStr.split('-').map(Number);
  const [bY, bM, bD] = targetDateStr.split('-').map(Number);
  const todayUtc = Date.UTC(tY, tM - 1, tD);
  const targetUtc = Date.UTC(bY, bM - 1, bD);
  return Math.round((targetUtc - todayUtc) / (1000 * 60 * 60 * 24));
}

/**
 * Render Customer Dashboard into container
 * @param {HTMLElement} container
 * @param {string} [initialTab='orders']
 */
export async function renderCustomerDashboardView(container, initialTab = 'orders') {
  activeTab = initialTab;
  const user = getCurrentUser();

  if (!user || user.role !== 'customer') {
    container.innerHTML = `
      <div class="state-container">
        <span class="material-symbols-outlined state-icon" style="color: var(--md-sys-color-error);">lock</span>
        <h2 class="state-title">Customer Access Only</h2>
        <p class="state-message">Please sign in with a registered customer account to view your acquisitions and commissions.</p>
        <button type="button" class="btn btn-primary" id="cust-dash-signin-btn">Sign In</button>
      </div>
    `;
    document.getElementById('cust-dash-signin-btn')?.addEventListener('click', () => {
      window.location.hash = '#catalogue';
    });
    return;
  }

  container.innerHTML = `
    <div class="gallery-container">
      <!-- Dashboard Header -->
      <div class="dashboard-header">
        <div class="dashboard-title-group">
          <span class="dashboard-eyebrow">
            <span class="material-symbols-outlined" style="font-size: 16px;">account_circle</span>
            Patron Atelier Dashboard
          </span>
          <h1 class="dashboard-title">My Art Collection &amp; Commissions</h1>
          <p class="dashboard-subtitle">
            Manage your acquired paintings, book live wall-painting dates, and track bespoke pottery requests.
          </p>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="studio-tabs" role="tablist">
        <button
          type="button"
          class="studio-tab-btn ${activeTab === 'orders' ? 'active' : ''}"
          id="cust-tab-orders"
          role="tab"
        >
          <span class="material-symbols-outlined">receipt_long</span>
          <span>My Paintings</span>
          <span class="tab-badge" id="cust-orders-count">...</span>
        </button>

        <button
          type="button"
          class="studio-tab-btn ${activeTab === 'bookings' ? 'active' : ''}"
          id="cust-tab-bookings"
          role="tab"
        >
          <span class="material-symbols-outlined">format_paint</span>
          <span>Wall Mural Bookings</span>
          <span class="tab-badge" id="cust-bookings-count">...</span>
        </button>

        <button
          type="button"
          class="studio-tab-btn ${activeTab === 'pottery' ? 'active' : ''}"
          id="cust-tab-pottery"
          role="tab"
        >
          <span class="material-symbols-outlined">ceramic</span>
          <span>Bespoke Pottery</span>
          <span class="tab-badge" id="cust-pottery-count">...</span>
        </button>
      </div>

      <!-- Tab Panels Container -->
      <div id="cust-tab-panel-container">
        <div class="state-container">
          <div class="spinner-ring"></div>
          <p class="state-message">Loading patron records...</p>
        </div>
      </div>
    </div>
  `;

  // Bind Tab Click Handlers
  container.querySelector('#cust-tab-orders')?.addEventListener('click', () => switchTab('orders'));
  container.querySelector('#cust-tab-bookings')?.addEventListener('click', () => switchTab('bookings'));
  container.querySelector('#cust-tab-pottery')?.addEventListener('click', () => switchTab('pottery'));

  // Load all initial data concurrently
  await loadAllCustomerData();
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.studio-tabs .studio-tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.id === `cust-tab-${tab}`);
  });
  renderActiveTabPanel();
}

async function loadAllCustomerData() {
  try {
    const [ordData, bookData, datesData, potCatalogue, potReqs] = await Promise.all([
      api.orders.getAll().catch(() => []),
      api.bookings.getAll().catch(() => []),
      api.bookings.getBookedDates().catch(() => []),
      api.pottery.getCatalogue().catch(() => ({ items: [], glazes: [] })),
      api.pottery.getAll().catch(() => []),
    ]);

    orders = ordData;
    bookings = bookData;
    bookedDates = datesData;
    potteryCatalogue = potCatalogue;
    potteryRequests = potReqs;

    updateTabCounts();
    renderActiveTabPanel();
  } catch (err) {
    const container = document.getElementById('cust-tab-panel-container');
    if (container) {
      container.innerHTML = `
        <div class="state-container">
          <span class="material-symbols-outlined state-icon" style="color: var(--md-sys-color-error);">error</span>
          <h3 class="state-title">Failed to load patron records</h3>
          <p class="state-message">${escapeHtml(err.message)}</p>
        </div>
      `;
    }
  }
}

function updateTabCounts() {
  const oCount = document.getElementById('cust-orders-count');
  const bCount = document.getElementById('cust-bookings-count');
  const pCount = document.getElementById('cust-pottery-count');

  if (oCount) oCount.textContent = orders.length;
  if (bCount) bCount.textContent = bookings.length;
  if (pCount) pCount.textContent = potteryRequests.length;
}

function renderActiveTabPanel() {
  const container = document.getElementById('cust-tab-panel-container');
  if (!container) return;

  if (activeTab === 'orders') {
    renderOrdersPanel(container);
  } else if (activeTab === 'bookings') {
    renderBookingsPanel(container);
  } else if (activeTab === 'pottery') {
    renderPotteryPanel(container);
  }
}

/* ==========================================================================
   TAB 1: Customer Painting Orders
   ========================================================================== */
function renderOrdersPanel(container) {
  if (orders.length === 0) {
    container.innerHTML = `
      <div class="state-container">
        <span class="material-symbols-outlined state-icon">receipt_long</span>
        <h3 class="state-title">No acquired paintings yet</h3>
        <p class="state-message">When you acquire original artworks from the gallery catalogue, your collection and orders will appear here.</p>
        <button type="button" class="btn btn-primary" onclick="window.location.hash='#catalogue'">
          <span class="material-symbols-outlined">palette</span>
          Browse Gallery Catalogue
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="table-responsive">
      <table class="gallery-table">
        <thead>
          <tr>
            <th style="width: 40px;">#</th>
            <th>Artwork</th>
            <th>Master Artist</th>
            <th>Acquisition Price</th>
            <th>Order Date</th>
            <th>Status</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${orders
            .map((ord, idx) => {
              const isPlaced = ord.status === 'placed';
              const formattedPrice = `₹${Number(ord.price).toLocaleString('en-IN')}`;
              const formattedDate = new Date(ord.created_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });

              return `
                <tr data-order-id="${ord.id}">
                  <td>
                    <span class="row-seq-badge">${idx + 1}</span>
                  </td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                      <img
                        src="${escapeHtml(ord.painting_image_url || 'images/p-001.jpg')}"
                        alt="${escapeHtml(ord.painting_title)}"
                        style="width: 48px; height: 48px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--md-sys-color-outline-variant);"
                        onerror="this.src='images/p-001.jpg'"
                      />
                      <div>
                        <strong style="display: block; font-size: 0.9375rem;">${escapeHtml(ord.painting_title)}</strong>
                        <span class="db-id-chip">${escapeHtml(ord.id)}</span>
                      </div>
                    </div>
                  </td>
                  <td>${escapeHtml(ord.painting_artist)}</td>
                  <td>
                    <strong style="color: var(--md-sys-color-primary);">${formattedPrice}</strong>
                  </td>
                  <td>${formattedDate}</td>
                  <td>
                    <span class="status-chip status-${ord.status}">
                      <span class="status-chip-dot"></span>
                      ${ord.status}
                    </span>
                  </td>
                  <td style="text-align: right;">
                    ${
                      isPlaced
                        ? `
                      <button type="button" class="btn btn-sm btn-outlined" data-action="cancel-order" style="color: var(--md-sys-color-error); border-color: var(--md-sys-color-outline-variant);">
                        <span class="material-symbols-outlined">cancel</span>
                        <span>Cancel Order</span>
                      </button>
                    `
                        : `
                      <span style="font-size: 0.75rem; color: var(--md-sys-color-outline); font-style: italic;">
                        Order Finalized
                      </span>
                    `
                    }
                  </td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  // Bind order cancellation
  container.querySelectorAll('[data-action="cancel-order"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      const orderId = tr.dataset.orderId;
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;

      confirmDialog({
        title: 'Cancel Artwork Order?',
        message: `Are you sure you wish to cancel order <strong>${escapeHtml(order.id)}</strong> for <strong>${escapeHtml(
          order.painting_title
        )}</strong>? The painting will be immediately restored to available status in the gallery.`,
        confirmText: 'Yes, Cancel Order',
        isDanger: true,
        onConfirm: async () => {
          try {
            await api.orders.cancel(order.id);
            showToast('Order cancelled. Painting restored to gallery.', 'info');
            // Refresh customer orders
            orders = await api.orders.getAll();
            updateTabCounts();
            renderOrdersPanel(container);
          } catch (err) {
            showToast(err.message || 'Failed to cancel order.', 'error');
          }
        },
      });
    });
  });
}

/* ==========================================================================
   TAB 2: Wall-Painting Murals
   ========================================================================== */
function renderBookingsPanel(container) {
  const minDate = getKolkataDate(7);
  const maxDate = getKolkataDate(90);

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr; gap: 2rem;">
      <!-- Wall Booking Form Card -->
      <div style="background-color: var(--md-sys-color-surface-container-lowest); border: 1px solid var(--md-sys-color-outline-variant); border-radius: var(--radius-lg); padding: 1.75rem; box-shadow: var(--shadow-sm);">
        <h3 style="font-family: var(--font-serif); font-size: 1.35rem; font-weight: 700; margin-bottom: 0.5rem;">
          Commission a Handcrafted Wall Mural
        </h3>
        <p style="font-size: 0.875rem; color: var(--md-sys-color-on-surface-variant); margin-bottom: 1.5rem;">
          Master artisans travel to your location to hand-paint large authentic murals (Madhubani, Warli, or Pattachitra). Rate: ₹150 / sq ft.
        </p>

        <form id="wall-booking-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="booking-date">Scheduled Mural Date *</label>
              <input
                type="date"
                id="booking-date"
                class="form-control"
                required
                min="${minDate}"
                max="${maxDate}"
                value="${minDate}"
              />
              <span class="form-hint">Must be between 7 and 90 days from today.</span>
            </div>

            <div class="form-group">
              <label class="form-label" for="booking-area">Wall Area (Square Feet) *</label>
              <input
                type="number"
                id="booking-area"
                class="form-control"
                required
                min="10"
                max="500"
                value="50"
              />
              <span class="form-hint">Accepted range: 10 to 500 sq ft.</span>
            </div>
          </div>

          <!-- Live Price Calculation Callout -->
          <div class="calc-callout">
            <div class="calc-callout-text">
              <span class="calc-rate-label">Studio Handcrafting Rate</span>
              <span class="calc-rate-value"><span id="calc-area-display">50</span> sq ft &times; ₹150 / sq ft</span>
            </div>
            <div class="calc-total-box">
              <span class="calc-total-label">Estimated Total</span>
              <span class="calc-total-amount" id="calc-total-display">₹7,500</span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="booking-address">Service Location / Site Address *</label>
            <textarea
              id="booking-address"
              class="form-control"
              required
              placeholder="Full building name, street, locality, landmark, and city where the mural will be painted..."
            ></textarea>
          </div>

          <!-- Unavailable Dates Display -->
          ${
            bookedDates.length > 0
              ? `
            <div style="margin-bottom: 1.25rem; padding: 0.75rem 1rem; background-color: var(--md-sys-color-surface-container); border-radius: var(--radius-sm); border: 1px solid var(--md-sys-color-outline-variant);">
              <span style="font-size: 0.75rem; font-weight: 700; color: var(--md-sys-color-secondary); text-transform: uppercase;">Currently Reserved Dates:</span>
              <div style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.35rem;">
                ${bookedDates
                  .map(
                    (d) => `
                  <span style="font-size: 0.75rem; background: #FFF; padding: 0.2rem 0.5rem; border-radius: var(--radius-xs); border: 1px solid var(--md-sys-color-outline-variant); font-family: monospace;">
                    ${escapeHtml(d)}
                  </span>
                `
                  )
                  .join('')}
              </div>
            </div>
          `
              : ''
          }

          <div id="booking-error-banner" style="display: none;" class="alert-banner alert-error">
            <span class="material-symbols-outlined">error</span>
            <span id="booking-error-msg"></span>
          </div>

          <button type="submit" class="btn btn-primary" id="booking-submit-btn">
            <span class="material-symbols-outlined">add_task</span>
            Request Wall Mural Booking
          </button>
        </form>
      </div>

      <!-- Bookings History Table -->
      <div>
        <h3 style="font-family: var(--font-serif); font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem;">
          My Scheduled Wall Murals (${bookings.length})
        </h3>

        ${
          bookings.length === 0
            ? `
          <div class="state-container" style="padding: 2.5rem 1rem;">
            <span class="material-symbols-outlined state-icon">format_paint</span>
            <p class="state-message">You have not requested any wall-painting dates yet.</p>
          </div>
        `
            : `
          <div class="table-responsive">
            <table class="gallery-table">
              <thead>
                <tr>
                  <th style="width: 40px;">#</th>
                  <th>Scheduled Date</th>
                  <th>Area &amp; Total</th>
                  <th>Service Address</th>
                  <th>Status</th>
                  <th style="text-align: right;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${bookings
                  .map((b, idx) => {
                    const daysAway = getDaysRemaining(b.booking_date);
                    const canCancel = (b.status === 'requested' || b.status === 'confirmed') && daysAway > 3;
                    const formattedTotal = `₹${Number(b.total_price).toLocaleString('en-IN')}`;

                    return `
                      <tr data-booking-id="${b.id}">
                        <td><span class="row-seq-badge">${idx + 1}</span></td>
                        <td>
                          <strong style="font-size: 0.9375rem;">${escapeHtml(b.booking_date)}</strong>
                          <span style="font-size: 0.72rem; color: var(--md-sys-color-secondary); display: block;">
                            ${daysAway > 0 ? `In ${daysAway} days` : 'Past date'}
                          </span>
                        </td>
                        <td>
                          <div>${b.wall_area} sq ft</div>
                          <strong style="color: var(--md-sys-color-primary);">${formattedTotal}</strong>
                        </td>
                        <td style="max-width: 260px; font-size: 0.8125rem;">
                          ${escapeHtml(b.service_address)}
                        </td>
                        <td>
                          <span class="status-chip status-${b.status}">
                            <span class="status-chip-dot"></span>
                            ${b.status}
                          </span>
                        </td>
                        <td style="text-align: right;">
                          ${
                            canCancel
                              ? `
                            <button type="button" class="btn btn-sm btn-outlined" data-action="cancel-booking" style="color: var(--md-sys-color-error); border-color: var(--md-sys-color-outline-variant);">
                              <span class="material-symbols-outlined">event_busy</span>
                              <span>Cancel</span>
                            </button>
                          `
                              : `
                            <span style="font-size: 0.72rem; color: var(--md-sys-color-outline);">
                              ${b.status === 'cancelled' ? 'Cancelled' : b.status === 'declined' ? 'Declined' : 'Locked (< 3 days)'}
                            </span>
                          `
                          }
                        </td>
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        `
        }
      </div>
    </div>
  `;

  // Dynamic price calculation
  const areaInput = document.getElementById('booking-area');
  const calcArea = document.getElementById('calc-area-display');
  const calcTotal = document.getElementById('calc-total-display');

  function updateCalculation() {
    const area = parseInt(areaInput.value, 10) || 0;
    const total = area * 150;
    if (calcArea) calcArea.textContent = area;
    if (calcTotal) calcTotal.textContent = `₹${total.toLocaleString('en-IN')}`;
  }

  areaInput?.addEventListener('input', updateCalculation);

  // Form submission
  document.getElementById('wall-booking-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBanner = document.getElementById('booking-error-banner');
    const errorMsg = document.getElementById('booking-error-msg');
    const submitBtn = document.getElementById('booking-submit-btn');

    if (errorBanner) errorBanner.style.display = 'none';

    const payload = {
      bookingDate: document.getElementById('booking-date').value,
      wallArea: parseFloat(document.getElementById('booking-area').value),
      serviceAddress: document.getElementById('booking-address').value.trim(),
    };

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_top</span> Reserving date...';
      }
      await api.bookings.create(payload);
      showToast('Wall mural booking requested successfully!', 'success');
      // Refresh bookings
      [bookings, bookedDates] = await Promise.all([api.bookings.getAll(), api.bookings.getBookedDates()]);
      updateTabCounts();
      renderBookingsPanel(container);
    } catch (err) {
      if (errorBanner && errorMsg) {
        errorMsg.textContent = err.message || 'Failed to reserve wall-painting date.';
        errorBanner.style.display = 'flex';
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="material-symbols-outlined">add_task</span> Request Wall Mural Booking';
      }
    }
  });

  // Cancel booking handler
  container.querySelectorAll('[data-action="cancel-booking"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      const bookingId = tr.dataset.bookingId;
      const booking = bookings.find((b) => String(b.id) === String(bookingId));
      if (!booking) return;

      confirmDialog({
        title: 'Cancel Wall Booking?',
        message: `Are you sure you want to cancel the wall-painting reservation for <strong>${booking.booking_date}</strong>? The studio calendar date will be released.`,
        confirmText: 'Yes, Cancel Reservation',
        isDanger: true,
        onConfirm: async () => {
          try {
            await api.bookings.cancel(booking.id);
            showToast('Wall mural booking cancelled.', 'info');
            [bookings, bookedDates] = await Promise.all([api.bookings.getAll(), api.bookings.getBookedDates()]);
            updateTabCounts();
            renderBookingsPanel(container);
          } catch (err) {
            showToast(err.message || 'Failed to cancel booking.', 'error');
          }
        },
      });
    });
  });
}

/* ==========================================================================
   TAB 3: Bespoke Pottery Commissions
   ========================================================================== */
function renderPotteryPanel(container) {
  const minDate = getKolkataDate(14);

  const items = potteryCatalogue.items || [];
  const glazes = potteryCatalogue.glazes || [];

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr; gap: 2rem;">
      <!-- Pottery Request Form Card -->
      <div style="background-color: var(--md-sys-color-surface-container-lowest); border: 1px solid var(--md-sys-color-outline-variant); border-radius: var(--radius-lg); padding: 1.75rem; box-shadow: var(--shadow-sm);">
        <h3 style="font-family: var(--font-serif); font-size: 1.35rem; font-weight: 700; margin-bottom: 0.5rem;">
          Commission Bespoke Studio Pottery
        </h3>
        <p style="font-size: 0.875rem; color: var(--md-sys-color-on-surface-variant); margin-bottom: 1.5rem;">
          Wheel-thrown earthenware and stoneware shaped by our resident ceramists with traditional wood-fired glazes.
        </p>

        <form id="pottery-request-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="pottery-item-select">Pottery Vessel / Form *</label>
              <select id="pottery-item-select" class="form-control" required>
                <option value="">-- Choose Ceramic Form --</option>
                ${items.map((it) => `<option value="${escapeHtml(it.id)}">${escapeHtml(it.name)} (${escapeHtml(it.description || '')})</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="pottery-glaze-select">Heritage Glaze Formulation *</label>
              <select id="pottery-glaze-select" class="form-control" required>
                <option value="">-- Select Artisan Glaze --</option>
                ${glazes.map((g) => `<option value="${escapeHtml(g.id)}">${escapeHtml(g.name)} (${escapeHtml(g.finish || '')})</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="pottery-qty">Quantity (1 – 12 Pieces) *</label>
              <input type="number" id="pottery-qty" class="form-control" required min="1" max="12" value="2" />
              <span class="form-hint">Studio batch limit: 12 handcrafted pieces.</span>
            </div>

            <div class="form-group">
              <label class="form-label" for="pottery-date">Needed By Date *</label>
              <input type="date" id="pottery-date" class="form-control" required min="${minDate}" value="${minDate}" />
              <span class="form-hint">Requires at least 14 days for throwing, drying, and kiln firing.</span>
            </div>
          </div>

          <div id="pottery-error-banner" style="display: none;" class="alert-banner alert-error">
            <span class="material-symbols-outlined">error</span>
            <span id="pottery-error-msg"></span>
          </div>

          <button type="submit" class="btn btn-primary" id="pottery-submit-btn">
            <span class="material-symbols-outlined">ceramic</span>
            Submit Pottery Commission Request
          </button>
        </form>
      </div>

      <!-- Pottery Requests History Table -->
      <div>
        <h3 style="font-family: var(--font-serif); font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem;">
          My Pottery Commissions (${potteryRequests.length})
        </h3>

        ${
          potteryRequests.length === 0
            ? `
          <div class="state-container" style="padding: 2.5rem 1rem;">
            <span class="material-symbols-outlined state-icon">ceramic</span>
            <p class="state-message">You have not submitted any custom pottery commission requests yet.</p>
          </div>
        `
            : `
          <div class="table-responsive">
            <table class="gallery-table">
              <thead>
                <tr>
                  <th style="width: 40px;">#</th>
                  <th>Pottery Item &amp; Glaze</th>
                  <th>Quantity</th>
                  <th>Needed By</th>
                  <th>Status</th>
                  <th style="text-align: right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${potteryRequests
                  .map((r, idx) => {
                    const isReq = r.status === 'requested';

                    return `
                      <tr data-pottery-id="${r.id}">
                        <td><span class="row-seq-badge">${idx + 1}</span></td>
                        <td>
                          <strong style="font-size: 0.9375rem; display: block;">${escapeHtml(r.item_name)}</strong>
                          <span style="font-size: 0.75rem; color: var(--md-sys-color-primary);">
                            Glaze: ${escapeHtml(r.glaze_name)}
                          </span>
                        </td>
                        <td><strong>${r.quantity}</strong> units</td>
                        <td>
                          <span style="font-family: monospace;">${escapeHtml(r.needed_by_date)}</span>
                        </td>
                        <td>
                          <span class="status-chip status-${r.status}">
                            <span class="status-chip-dot"></span>
                            ${r.status}
                          </span>
                        </td>
                        <td style="text-align: right;">
                          ${
                            isReq
                              ? `
                            <div style="display: inline-flex; gap: 0.5rem;">
                              <button type="button" class="btn btn-sm btn-outlined" data-action="edit-pottery">
                                <span class="material-symbols-outlined">edit</span>
                                <span>Edit</span>
                              </button>
                              <button type="button" class="btn btn-sm btn-outlined" data-action="cancel-pottery" style="color: var(--md-sys-color-error); border-color: var(--md-sys-color-outline-variant);">
                                <span class="material-symbols-outlined">cancel</span>
                                <span>Cancel</span>
                              </button>
                            </div>
                          `
                              : `
                            <span style="font-size: 0.72rem; color: var(--md-sys-color-outline);">
                              Processed (${r.status})
                            </span>
                          `
                          }
                        </td>
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        `
        }
      </div>
    </div>
  `;

  // Submit Pottery Request
  document.getElementById('pottery-request-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBanner = document.getElementById('pottery-error-banner');
    const errorMsg = document.getElementById('pottery-error-msg');
    const submitBtn = document.getElementById('pottery-submit-btn');

    if (errorBanner) errorBanner.style.display = 'none';

    const payload = {
      potteryItemId: document.getElementById('pottery-item-select').value,
      glazeId: document.getElementById('pottery-glaze-select').value,
      quantity: parseInt(document.getElementById('pottery-qty').value, 10),
      neededByDate: document.getElementById('pottery-date').value,
    };

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_top</span> Submitting...';
      }
      await api.pottery.create(payload);
      showToast('Pottery request submitted to studio atelier.', 'success');
      potteryRequests = await api.pottery.getAll();
      updateTabCounts();
      renderPotteryPanel(container);
    } catch (err) {
      if (errorBanner && errorMsg) {
        errorMsg.textContent = err.message || 'Failed to submit pottery request.';
        errorBanner.style.display = 'flex';
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="material-symbols-outlined">ceramic</span> Submit Pottery Commission Request';
      }
    }
  });

  // Edit and Cancel Pottery handlers
  container.querySelectorAll('[data-action="edit-pottery"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      const reqId = tr.dataset.potteryId;
      const req = potteryRequests.find((r) => String(r.id) === String(reqId));
      if (!req) return;
      openEditPotteryModal(req, async () => {
        potteryRequests = await api.pottery.getAll();
        updateTabCounts();
        renderPotteryPanel(container);
      });
    });
  });

  container.querySelectorAll('[data-action="cancel-pottery"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      const reqId = tr.dataset.potteryId;
      const req = potteryRequests.find((r) => String(r.id) === String(reqId));
      if (!req) return;

      confirmDialog({
        title: 'Cancel Pottery Commission?',
        message: `Cancel request for <strong>${escapeHtml(req.item_name)}</strong> with ${escapeHtml(req.glaze_name)} glaze?`,
        confirmText: 'Yes, Cancel Request',
        isDanger: true,
        onConfirm: async () => {
          try {
            await api.pottery.cancel(req.id);
            showToast('Pottery request cancelled.', 'info');
            potteryRequests = await api.pottery.getAll();
            updateTabCounts();
            renderPotteryPanel(container);
          } catch (err) {
            showToast(err.message || 'Failed to cancel pottery request.', 'error');
          }
        },
      });
    });
  });
}

function openEditPotteryModal(req, onSuccess) {
  const modalId = `edit-pottery-${req.id}`;
  const minDate = getKolkataDate(14);
  const items = potteryCatalogue.items || [];
  const glazes = potteryCatalogue.glazes || [];

  const content = `
    <form id="edit-pottery-form">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="edit-pot-item">Vessel / Form</label>
          <select id="edit-pot-item" class="form-control" required>
            ${items
              .map(
                (it) => `
              <option value="${escapeHtml(it.id)}" ${it.id === req.pottery_item_id ? 'selected' : ''}>
                ${escapeHtml(it.name)}
              </option>
            `
              )
              .join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="edit-pot-glaze">Glaze Formulation</label>
          <select id="edit-pot-glaze" class="form-control" required>
            ${glazes
              .map(
                (g) => `
              <option value="${escapeHtml(g.id)}" ${g.id === req.glaze_id ? 'selected' : ''}>
                ${escapeHtml(g.name)}
              </option>
            `
              )
              .join('')}
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="edit-pot-qty">Quantity (1 - 12)</label>
          <input type="number" id="edit-pot-qty" class="form-control" required min="1" max="12" value="${req.quantity}" />
        </div>

        <div class="form-group">
          <label class="form-label" for="edit-pot-date">Needed By Date</label>
          <input type="date" id="edit-pot-date" class="form-control" required min="${minDate}" value="${req.needed_by_date}" />
        </div>
      </div>

      <div id="edit-pottery-error" style="display: none;" class="alert-banner alert-error">
        <span class="material-symbols-outlined">error</span>
        <span id="edit-pottery-error-msg"></span>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.25rem;">
        <button type="button" class="btn btn-tonal" id="edit-pot-cancel-btn">Cancel</button>
        <button type="submit" class="btn btn-primary" id="edit-pot-save-btn">Save Changes</button>
      </div>
    </form>
  `;

  openModal({
    id: modalId,
    title: 'Modify Pottery Commission Request',
    content,
    size: 'md',
  });

  document.getElementById('edit-pot-cancel-btn')?.addEventListener('click', () => {
    closeModal(modalId);
  });

  document.getElementById('edit-pottery-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBanner = document.getElementById('edit-pottery-error');
    const errorMsg = document.getElementById('edit-pottery-error-msg');
    const submitBtn = document.getElementById('edit-pot-save-btn');

    if (errorBanner) errorBanner.style.display = 'none';

    const payload = {
      potteryItemId: document.getElementById('edit-pot-item').value,
      glazeId: document.getElementById('edit-pot-glaze').value,
      quantity: parseInt(document.getElementById('edit-pot-qty').value, 10),
      neededByDate: document.getElementById('edit-pot-date').value,
    };

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_top</span> Saving...';
      }
      await api.pottery.update(req.id, payload);
      closeModal(modalId);
      showToast('Pottery request updated.', 'success');
      if (onSuccess) await onSuccess();
    } catch (err) {
      if (errorBanner && errorMsg) {
        errorMsg.textContent = err.message || 'Failed to update pottery request.';
        errorBanner.style.display = 'flex';
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Save Changes';
      }
    }
  });
}
