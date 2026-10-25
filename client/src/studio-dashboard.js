/**
 * KalaKriti Art Studio — Studio Administration Dashboard Module
 *
 * Implements:
 * - All Customer Orders with proper `#` sequential row index & real database Order ID
 * - Paintings Inventory with creation & editing restrictions (sold paintings locked)
 * - Wall Bookings decision workflow (Confirm / Decline) with automatic calendar release
 * - Pottery Requests decision workflow (Accept / Decline)
 *
 * FIX FOR NUMBERING & STALE TAB COUNTS (Requirement 5):
 * - Fetches all four collections concurrently during mount: orders, inventory, bookings, pottery
 * - Tab counts immediately and accurately reflect real database record counts
 * - Distinguishes between visual sequential row number (index + 1) and actual MySQL primary keys
 */

import { api } from './api.js';
import { getCurrentUser, isStudio, escapeHtml } from './auth.js';
import { openModal, closeModal, confirmDialog, showToast } from './modal.js';
import { openAddPaintingModal, openEditPaintingModal } from './catalogue.js';

let activeTab = 'orders'; // 'orders' | 'paintings' | 'bookings' | 'pottery'

// Local dashboard datasets
let studioOrders = [];
let studioPaintings = [];
let studioBookings = [];
let studioPottery = [];

let loadingOrders = false;
let loadingPaintings = false;
let loadingBookings = false;
let loadingPottery = false;

let errorOrders = '';
let errorPaintings = '';
let errorBookings = '';
let errorPottery = '';

/**
 * Render Studio Dashboard into container
 * @param {HTMLElement} container
 * @param {string} [initialTab='orders']
 */
export async function renderStudioDashboardView(container, initialTab = 'orders') {
  activeTab = initialTab;
  const user = getCurrentUser();

  if (!user || user.role !== 'studio') {
    container.innerHTML = `
      <div class="state-container">
        <span class="material-symbols-outlined state-icon" style="color: var(--md-sys-color-error);">gpp_bad</span>
        <h2 class="state-title">Studio Administration Privileges Required</h2>
        <p class="state-message">This dashboard is reserved for studio directors and authorized atelier staff.</p>
        <button type="button" class="btn btn-primary" onclick="window.location.hash='#catalogue'">
          Return to Gallery
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="gallery-container">
      <!-- Header -->
      <div class="dashboard-header">
        <div class="dashboard-title-group">
          <span class="dashboard-eyebrow">
            <span class="material-symbols-outlined" style="font-size: 16px;">admin_panel_settings</span>
            Master Atelier Administration
          </span>
          <h1 class="dashboard-title">Studio Operations &amp; Inventory</h1>
          <p class="dashboard-subtitle">
            Oversee paintings inventory, track patron acquisitions, confirm site mural bookings, and review custom pottery commissions.
          </p>
        </div>

        <div id="studio-header-actions">
          <!-- Injected dynamically if paintings tab is active -->
        </div>
      </div>

      <!-- Navigation Tabs with Real-Time Dataset Counters (Fix for Requirement 5) -->
      <div class="studio-tabs" role="tablist">
        <button
          type="button"
          class="studio-tab-btn ${activeTab === 'orders' ? 'active' : ''}"
          id="tab-orders-btn"
          role="tab"
        >
          <span class="material-symbols-outlined">receipt_long</span>
          <span>All Customer Orders</span>
          <span class="tab-badge" id="badge-orders">...</span>
        </button>

        <button
          type="button"
          class="studio-tab-btn ${activeTab === 'paintings' ? 'active' : ''}"
          id="tab-paintings-btn"
          role="tab"
        >
          <span class="material-symbols-outlined">palette</span>
          <span>Paintings Inventory</span>
          <span class="tab-badge" id="badge-paintings">...</span>
        </button>

        <button
          type="button"
          class="studio-tab-btn ${activeTab === 'bookings' ? 'active' : ''}"
          id="tab-bookings-btn"
          role="tab"
        >
          <span class="material-symbols-outlined">format_paint</span>
          <span>Wall Murals</span>
          <span class="tab-badge" id="badge-bookings">...</span>
        </button>

        <button
          type="button"
          class="studio-tab-btn ${activeTab === 'pottery' ? 'active' : ''}"
          id="tab-pottery-btn"
          role="tab"
        >
          <span class="material-symbols-outlined">ceramic</span>
          <span>Pottery Commissions</span>
          <span class="tab-badge" id="badge-pottery">...</span>
        </button>
      </div>

      <!-- Active Tab Panel Mount Container -->
      <div id="studio-panel-container">
        <div class="state-container">
          <div class="spinner-ring"></div>
          <p class="state-message">Synchronizing atelier records...</p>
        </div>
      </div>
    </div>
  `;

  // Bind tab click events
  container.querySelector('#tab-orders-btn')?.addEventListener('click', () => switchTab('orders'));
  container.querySelector('#tab-paintings-btn')?.addEventListener('click', () => switchTab('paintings'));
  container.querySelector('#tab-bookings-btn')?.addEventListener('click', () => switchTab('bookings'));
  container.querySelector('#tab-pottery-btn')?.addEventListener('click', () => switchTab('pottery'));

  // Concurrently fetch all datasets on initialization (Resolves stale counts bug)
  await loadAllStudioData();
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.studio-tabs .studio-tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.id === `tab-${tab}-btn`);
  });
  renderHeaderActions();
  renderActivePanel();
}

function renderHeaderActions() {
  const container = document.getElementById('studio-header-actions');
  if (!container) return;

  if (activeTab === 'paintings') {
    container.innerHTML = `
      <button type="button" class="btn btn-primary" id="studio-add-painting-btn">
        <span class="material-symbols-outlined">add</span>
        <span>Add New Painting</span>
      </button>
    `;
    container.querySelector('#studio-add-painting-btn')?.addEventListener('click', () => {
      openAddPaintingModal();
    });
  } else {
    container.innerHTML = '';
  }
}

/**
 * Fetch all studio datasets concurrently
 */
async function loadAllStudioData() {
  loadingOrders = true;
  loadingPaintings = true;
  loadingBookings = true;
  loadingPottery = true;

  try {
    const [ordData, pData, bData, potData] = await Promise.all([
      api.orders.getAll().catch((e) => {
        errorOrders = e.message;
        return [];
      }),
      api.paintings.getAll().catch((e) => {
        errorPaintings = e.message;
        return [];
      }),
      api.bookings.getAll().catch((e) => {
        errorBookings = e.message;
        return [];
      }),
      api.pottery.getAll().catch((e) => {
        errorPottery = e.message;
        return [];
      }),
    ]);

    studioOrders = ordData;
    studioPaintings = pData;
    studioBookings = bData;
    studioPottery = potData;

    updateTabBadges();
    renderHeaderActions();
    renderActivePanel();
  } catch (err) {
    console.error('Fatal dashboard loading error:', err);
  } finally {
    loadingOrders = false;
    loadingPaintings = false;
    loadingBookings = false;
    loadingPottery = false;
  }
}

function updateTabBadges() {
  const bOrd = document.getElementById('badge-orders');
  const bPnt = document.getElementById('badge-paintings');
  const bBkg = document.getElementById('badge-bookings');
  const bPot = document.getElementById('badge-pottery');

  if (bOrd) bOrd.textContent = studioOrders.length;
  if (bPnt) bPnt.textContent = studioPaintings.length;
  if (bBkg) bBkg.textContent = studioBookings.length;
  if (bPot) bPot.textContent = studioPottery.length;
}

function renderActivePanel() {
  const container = document.getElementById('studio-panel-container');
  if (!container) return;

  if (activeTab === 'orders') {
    renderOrdersTab(container);
  } else if (activeTab === 'paintings') {
    renderPaintingsTab(container);
  } else if (activeTab === 'bookings') {
    renderBookingsTab(container);
  } else if (activeTab === 'pottery') {
    renderPotteryTab(container);
  }
}

/* ==========================================================================
   TAB 1: All Customer Orders
   ========================================================================== */
function renderOrdersTab(container) {
  if (errorOrders) {
    container.innerHTML = `
      <div class="state-container">
        <span class="material-symbols-outlined state-icon" style="color: var(--md-sys-color-error);">error</span>
        <h3 class="state-title">Failed to load customer orders</h3>
        <p class="state-message">${escapeHtml(errorOrders)}</p>
      </div>
    `;
    return;
  }

  if (studioOrders.length === 0) {
    container.innerHTML = `
      <div class="state-container">
        <span class="material-symbols-outlined state-icon">receipt_long</span>
        <h3 class="state-title">No customer orders placed yet</h3>
        <p class="state-message">When patrons purchase available paintings from the gallery catalogue, their orders appear here in real time.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="table-responsive">
      <table class="gallery-table">
        <thead>
          <tr>
            <th style="width: 40px;" title="Sequential Row Index">#</th>
            <th>Order Reference ID</th>
            <th>Patron Customer</th>
            <th>Painting Artwork</th>
            <th>Price</th>
            <th>Date Placed</th>
            <th>Order Status</th>
          </tr>
        </thead>
        <tbody>
          ${studioOrders
            .map((ord, idx) => {
              const formattedPrice = `₹${Number(ord.price).toLocaleString('en-IN')}`;
              const formattedDate = new Date(ord.created_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });

              return `
                <tr>
                  <td>
                    <!-- Requirement 5: Clear sequential row number derived from list index -->
                    <span class="row-seq-badge">${idx + 1}</span>
                  </td>
                  <td>
                    <!-- Requirement 5: Real MySQL Order ID clearly styled in monospace badge -->
                    <span class="db-id-chip">${escapeHtml(ord.id)}</span>
                  </td>
                  <td>
                    <strong style="display: block; font-size: 0.9375rem;">${escapeHtml(ord.customer_name)}</strong>
                    <span style="font-size: 0.75rem; color: var(--md-sys-color-outline);">${escapeHtml(ord.customer_email)}</span>
                  </td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                      <img
                        src="${escapeHtml(ord.painting_image_url || 'images/p-001.jpg')}"
                        alt="${escapeHtml(ord.painting_title)}"
                        style="width: 42px; height: 42px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--md-sys-color-outline-variant);"
                        onerror="this.src='images/p-001.jpg'"
                      />
                      <div>
                        <strong style="display: block; font-size: 0.875rem;">${escapeHtml(ord.painting_title)}</strong>
                        <span style="font-size: 0.75rem; color: var(--md-sys-color-secondary);">Art: ${escapeHtml(ord.painting_artist || '')}</span>
                      </div>
                    </div>
                  </td>
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
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ==========================================================================
   TAB 2: Paintings Inventory
   ========================================================================== */
function renderPaintingsTab(container) {
  if (errorPaintings) {
    container.innerHTML = `
      <div class="state-container">
        <span class="material-symbols-outlined state-icon" style="color: var(--md-sys-color-error);">error</span>
        <h3 class="state-title">Failed to load paintings inventory</h3>
        <p class="state-message">${escapeHtml(errorPaintings)}</p>
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
            <th>Catalogue ID</th>
            <th>Master Artist</th>
            <th>Price</th>
            <th>Availability</th>
            <th style="text-align: right;">Studio Actions</th>
          </tr>
        </thead>
        <tbody>
          ${studioPaintings
            .map((p, idx) => {
              const isAvail = p.status === 'available';
              const formattedPrice = `₹${Number(p.price).toLocaleString('en-IN')}`;

              return `
                <tr data-painting-id="${p.id}">
                  <td><span class="row-seq-badge">${idx + 1}</span></td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                      <img
                        src="${escapeHtml(p.imageUrl || 'images/p-001.jpg')}"
                        alt="${escapeHtml(p.title)}"
                        style="width: 48px; height: 48px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--md-sys-color-outline-variant);"
                        onerror="this.src='images/p-001.jpg'"
                      />
                      <div>
                        <strong style="display: block; font-size: 0.9375rem;">${escapeHtml(p.title)}</strong>
                        <span style="font-size: 0.75rem; color: var(--md-sys-color-on-surface-variant); display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; max-width: 280px;">
                          ${escapeHtml(p.description)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td><span class="db-id-chip">${escapeHtml(p.id)}</span></td>
                  <td>${escapeHtml(p.artist)}</td>
                  <td><strong>${formattedPrice}</strong></td>
                  <td>
                    <span class="status-chip ${isAvail ? 'status-available' : 'status-sold'}">
                      <span class="status-chip-dot"></span>
                      ${isAvail ? 'Available' : 'Sold'}
                    </span>
                  </td>
                  <td style="text-align: right;">
                    ${
                      isAvail
                        ? `
                      <button type="button" class="btn btn-sm btn-outlined" data-action="edit-inventory-painting">
                        <span class="material-symbols-outlined">edit</span>
                        <span>Edit Details</span>
                      </button>
                    `
                        : `
                      <span style="font-size: 0.75rem; color: var(--md-sys-color-outline); font-style: italic;">
                        Sold (Locked)
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

  // Bind Edit buttons
  container.querySelectorAll('[data-action="edit-inventory-painting"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      const pId = tr.dataset.paintingId;
      const painting = studioPaintings.find((p) => p.id === pId);
      if (!painting) return;
      openEditPaintingModal(painting);
    });
  });
}

/* ==========================================================================
   TAB 3: Wall Bookings
   ========================================================================== */
function renderBookingsTab(container) {
  if (errorBookings) {
    container.innerHTML = `
      <div class="state-container">
        <span class="material-symbols-outlined state-icon" style="color: var(--md-sys-color-error);">error</span>
        <h3 class="state-title">Failed to load wall bookings</h3>
        <p class="state-message">${escapeHtml(errorBookings)}</p>
      </div>
    `;
    return;
  }

  if (studioBookings.length === 0) {
    container.innerHTML = `
      <div class="state-container">
        <span class="material-symbols-outlined state-icon">format_paint</span>
        <h3 class="state-title">No wall mural bookings requested yet</h3>
        <p class="state-message">Patron booking requests for on-site wall murals will appear here for studio review.</p>
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
            <th>Patron Customer</th>
            <th>Scheduled Mural Date</th>
            <th>Area &amp; Total</th>
            <th>Service Location</th>
            <th>Status</th>
            <th style="text-align: right;">Studio Decision</th>
          </tr>
        </thead>
        <tbody>
          ${studioBookings
            .map((b, idx) => {
              const isReq = b.status === 'requested';
              const formattedTotal = `₹${Number(b.total_price).toLocaleString('en-IN')}`;

              return `
                <tr data-booking-id="${b.id}">
                  <td><span class="row-seq-badge">${idx + 1}</span></td>
                  <td>
                    <strong style="display: block; font-size: 0.9375rem;">${escapeHtml(b.customer_name)}</strong>
                    <span style="font-size: 0.75rem; color: var(--md-sys-color-outline);">${escapeHtml(b.customer_email)}</span>
                  </td>
                  <td>
                    <strong style="font-size: 0.95rem; font-family: monospace;">${escapeHtml(b.booking_date)}</strong>
                  </td>
                  <td>
                    <div>${b.wall_area} sq ft</div>
                    <strong style="color: var(--md-sys-color-primary);">${formattedTotal}</strong>
                  </td>
                  <td style="max-width: 250px; font-size: 0.8125rem;">
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
                      isReq
                        ? `
                      <div style="display: inline-flex; gap: 0.5rem;">
                        <button type="button" class="btn btn-sm" data-action="confirm-booking" style="background-color: #196C42; color: #FFF;">
                          <span class="material-symbols-outlined">check</span>
                          <span>Confirm</span>
                        </button>
                        <button type="button" class="btn btn-sm btn-danger" data-action="decline-booking">
                          <span class="material-symbols-outlined">close</span>
                          <span>Decline</span>
                        </button>
                      </div>
                    `
                        : `
                      <span style="font-size: 0.75rem; color: var(--md-sys-color-outline);">
                        Processed (${b.status})
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

  // Bind Confirm / Decline handlers
  container.querySelectorAll('[data-action="confirm-booking"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      const bId = tr.dataset.bookingId;
      const booking = studioBookings.find((b) => String(b.id) === String(bId));
      if (!booking) return;

      confirmDialog({
        title: 'Confirm Wall Booking?',
        message: `Confirm on-site mural booking on <strong>${booking.booking_date}</strong> for patron <strong>${escapeHtml(
          booking.customer_name
        )}</strong>?`,
        confirmText: 'Confirm Booking',
        onConfirm: async () => {
          try {
            await api.bookings.updateStatus(booking.id, 'confirmed');
            showToast('Wall mural booking confirmed.', 'success');
            studioBookings = await api.bookings.getAll();
            updateTabBadges();
            renderBookingsTab(container);
          } catch (err) {
            showToast(err.message || 'Failed to update booking status.', 'error');
          }
        },
      });
    });
  });

  container.querySelectorAll('[data-action="decline-booking"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      const bId = tr.dataset.bookingId;
      const booking = studioBookings.find((b) => String(b.id) === String(bId));
      if (!booking) return;

      confirmDialog({
        title: 'Decline Wall Booking?',
        message: `Decline mural booking on <strong>${booking.booking_date}</strong>? The calendar date will be released.`,
        confirmText: 'Decline Booking',
        isDanger: true,
        onConfirm: async () => {
          try {
            await api.bookings.updateStatus(booking.id, 'declined');
            showToast('Wall mural booking declined and date released.', 'info');
            studioBookings = await api.bookings.getAll();
            updateTabBadges();
            renderBookingsTab(container);
          } catch (err) {
            showToast(err.message || 'Failed to decline booking.', 'error');
          }
        },
      });
    });
  });
}

/* ==========================================================================
   TAB 4: Pottery Requests
   ========================================================================== */
function renderPotteryTab(container) {
  if (errorPottery) {
    container.innerHTML = `
      <div class="state-container">
        <span class="material-symbols-outlined state-icon" style="color: var(--md-sys-color-error);">error</span>
        <h3 class="state-title">Failed to load pottery commissions</h3>
        <p class="state-message">${escapeHtml(errorPottery)}</p>
      </div>
    `;
    return;
  }

  if (studioPottery.length === 0) {
    container.innerHTML = `
      <div class="state-container">
        <span class="material-symbols-outlined state-icon">ceramic</span>
        <h3 class="state-title">No custom pottery requests</h3>
        <p class="state-message">Custom pottery commission requests from patrons will appear here for atelier scheduling.</p>
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
            <th>Patron Customer</th>
            <th>Pottery Item &amp; Glaze Formulation</th>
            <th>Quantity</th>
            <th>Needed By Date</th>
            <th>Status</th>
            <th style="text-align: right;">Studio Decision</th>
          </tr>
        </thead>
        <tbody>
          ${studioPottery
            .map((r, idx) => {
              const isReq = r.status === 'requested';

              return `
                <tr data-pottery-id="${r.id}">
                  <td><span class="row-seq-badge">${idx + 1}</span></td>
                  <td>
                    <strong style="display: block; font-size: 0.9375rem;">${escapeHtml(r.customer_name)}</strong>
                    <span style="font-size: 0.75rem; color: var(--md-sys-color-outline);">${escapeHtml(r.customer_email)}</span>
                  </td>
                  <td>
                    <strong style="display: block; font-size: 0.9375rem;">${escapeHtml(r.item_name)}</strong>
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
                        <button type="button" class="btn btn-sm" data-action="accept-pottery" style="background-color: #196C42; color: #FFF;">
                          <span class="material-symbols-outlined">check</span>
                          <span>Accept</span>
                        </button>
                        <button type="button" class="btn btn-sm btn-danger" data-action="decline-pottery">
                          <span class="material-symbols-outlined">close</span>
                          <span>Decline</span>
                        </button>
                      </div>
                    `
                        : `
                      <span style="font-size: 0.75rem; color: var(--md-sys-color-outline);">
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
  `;

  // Bind Accept / Decline handlers
  container.querySelectorAll('[data-action="accept-pottery"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      const pId = tr.dataset.potteryId;
      const req = studioPottery.find((r) => String(r.id) === String(pId));
      if (!req) return;

      confirmDialog({
        title: 'Accept Pottery Commission?',
        message: `Accept pottery order of <strong>${req.quantity} &times; ${escapeHtml(req.item_name)}</strong> (${escapeHtml(
          req.glaze_name
        )} glaze) for patron <strong>${escapeHtml(req.customer_name)}</strong>?`,
        confirmText: 'Accept Commission',
        onConfirm: async () => {
          try {
            await api.pottery.updateStatus(req.id, 'accepted');
            showToast('Pottery commission accepted.', 'success');
            studioPottery = await api.pottery.getAll();
            updateTabBadges();
            renderPotteryTab(container);
          } catch (err) {
            showToast(err.message || 'Failed to accept pottery request.', 'error');
          }
        },
      });
    });
  });

  container.querySelectorAll('[data-action="decline-pottery"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      const pId = tr.dataset.potteryId;
      const req = studioPottery.find((r) => String(r.id) === String(pId));
      if (!req) return;

      confirmDialog({
        title: 'Decline Pottery Commission?',
        message: `Decline pottery request for <strong>${escapeHtml(req.item_name)}</strong>?`,
        confirmText: 'Decline Request',
        isDanger: true,
        onConfirm: async () => {
          try {
            await api.pottery.updateStatus(req.id, 'declined');
            showToast('Pottery commission declined.', 'info');
            studioPottery = await api.pottery.getAll();
            updateTabBadges();
            renderPotteryTab(container);
          } catch (err) {
            showToast(err.message || 'Failed to decline pottery request.', 'error');
          }
        },
      });
    });
  });
}
