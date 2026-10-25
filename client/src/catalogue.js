/**
 * KalaKriti Art Studio — Painting Catalogue Module
 *
 * Implements:
 * - Public Art Gallery catalogue with filtering (All, Available, Sold)
 * - Large Artwork Detail Preview Dialog (Requirement 4: 2-column desktop, uncropped contain, responsive)
 * - Explicit Purchase Confirmation Flow with atomic backend order placement
 * - Studio Painting Addition and Editing for available paintings
 */

import { api } from './api.js';
import { getCurrentUser, isCustomer, isStudio, openAuthModal, escapeHtml } from './auth.js';
import { openModal, closeModal, showToast } from './modal.js';

let paintingsCache = [];
let currentFilter = 'all'; // 'all' | 'available' | 'sold'
let isLoading = false;
let loadError = '';

/**
 * Render Catalogue View into the container
 * @param {HTMLElement} container
 */
export async function renderCatalogueView(container) {
  container.innerHTML = `
    <!-- Full-Screen Curated Editorial Hero Landing -->
    <section class="editorial-hero" id="hero-landing">
      <span class="material-symbols-outlined hero-art-motif" aria-hidden="true">brush</span>
      
      <div class="hero-content">
        <span class="hero-eyebrow">
          <span class="material-symbols-outlined" style="font-size: 15px;">verified</span>
          Bespoke Heritage Atelier &amp; Curated Gallery
        </span>
        
        <h1 class="hero-title">Curated Traditional Indian Art &amp; Masterworks</h1>
        
        <p class="hero-description">
          Welcome to KalaKriti Art Studio. Step into an exclusive sanctuary of authentic, handcrafted Indian art. From radiant 22K Tanjore gold leaf to ancestral Madhubani, explore original paintings or commission bespoke architectural murals and studio pottery.
        </p>
        
        <div class="hero-traditions">
          <span class="tradition-chip"><span class="tradition-bullet">•</span> Madhubani</span>
          <span class="tradition-chip"><span class="tradition-bullet">•</span> Warli</span>
          <span class="tradition-chip"><span class="tradition-bullet">•</span> Tanjore 22K Gold</span>
          <span class="tradition-chip"><span class="tradition-bullet">•</span> Pattachitra</span>
          <span class="tradition-chip"><span class="tradition-bullet">•</span> Kalamkari</span>
          <span class="tradition-chip"><span class="tradition-bullet">•</span> Gond</span>
          <span class="tradition-chip"><span class="tradition-bullet">•</span> Cheriyal Scrolls</span>
          <span class="tradition-chip"><span class="tradition-bullet">•</span> Nirmal Studio</span>
        </div>

        <div class="hero-actions">
          <button type="button" class="btn btn-primary" id="hero-explore-btn">
            <span class="material-symbols-outlined">palette</span>
            <span>Explore Collection</span>
            <span class="material-symbols-outlined" style="font-size: 18px;">arrow_downward</span>
          </button>
          
          <button type="button" class="btn btn-outlined" id="hero-commission-btn">
            <span class="material-symbols-outlined">brush</span>
            <span>Commission Murals &amp; Pottery</span>
          </button>
        </div>
      </div>

      <!-- Animated Scroll-Down Discovery Indicator -->
      <div class="hero-scroll-cue" id="hero-scroll-cue" role="button" tabindex="0" aria-label="Scroll down to art catalogue">
        <span>Scroll To Explore Exhibition</span>
        <span class="material-symbols-outlined">keyboard_arrow_down</span>
      </div>
    </section>

    <!-- Main Art Gallery Container (Contained Width) -->
    <div class="gallery-container" id="catalogue-gallery-section">
      <!-- Catalogue Filter Toolbar -->
      <div class="catalogue-toolbar">
        <div class="filter-group" role="tablist" aria-label="Painting availability filter">
          <button
            type="button"
            class="filter-btn ${currentFilter === 'all' ? 'active' : ''}"
            data-filter="all"
            role="tab"
            aria-selected="${currentFilter === 'all'}"
          >
            <span>All Works</span>
            <span class="filter-count-badge" id="count-all">0</span>
          </button>
          <button
            type="button"
            class="filter-btn ${currentFilter === 'available' ? 'active' : ''}"
            data-filter="available"
            role="tab"
            aria-selected="${currentFilter === 'available'}"
          >
            <span>Available</span>
            <span class="filter-count-badge" id="count-available">0</span>
          </button>
          <button
            type="button"
            class="filter-btn ${currentFilter === 'sold' ? 'active' : ''}"
            data-filter="sold"
            role="tab"
            aria-selected="${currentFilter === 'sold'}"
          >
            <span>Acquired / Sold</span>
            <span class="filter-count-badge" id="count-sold">0</span>
          </button>
        </div>

        <div class="catalogue-actions">
          ${
            isStudio()
              ? `
            <button type="button" class="btn btn-primary" id="catalogue-add-painting-btn">
              <span class="material-symbols-outlined">add</span>
              <span>Add Painting</span>
            </button>
          `
              : ''
          }
        </div>
      </div>

      <!-- Painting Grid / State Container -->
      <div id="paintings-list-container">
        <div class="state-container">
          <div class="spinner-ring"></div>
          <p class="state-message">Loading paintings from the studio catalogue...</p>
        </div>
      </div>
    </div>
  `;

  // Bind smooth scroll from hero CTA and scroll cue
  const scrollToGallery = () => {
    document.getElementById('catalogue-gallery-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  container.querySelector('#hero-explore-btn')?.addEventListener('click', scrollToGallery);
  container.querySelector('#hero-scroll-cue')?.addEventListener('click', scrollToGallery);
  container.querySelector('#hero-scroll-cue')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      scrollToGallery();
    }
  });

  // Bind hero commissions button
  container.querySelector('#hero-commission-btn')?.addEventListener('click', () => {
    const user = getCurrentUser();
    if (user && user.role === 'customer') {
      window.location.hash = '#customer-dashboard';
    } else {
      openAuthModal('login', () => {
        window.location.hash = '#customer-dashboard';
      });
    }
  });

  // Bind filter tabs
  container.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      container.querySelectorAll('.filter-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.filter === currentFilter);
        b.setAttribute('aria-selected', b.dataset.filter === currentFilter);
      });
      renderPaintingsGrid();
    });
  });

  // Bind studio add painting button
  container.querySelector('#catalogue-add-painting-btn')?.addEventListener('click', () => {
    openAddPaintingModal();
  });

  // Load paintings from backend
  await loadPaintings();
}

/**
 * Fetch paintings from API and update view
 */
export async function loadPaintings() {
  isLoading = true;
  loadError = '';

  try {
    paintingsCache = await api.paintings.getAll();
    updateFilterCounts();
    renderPaintingsGrid();
  } catch (err) {
    loadError = err.message || 'Failed to load paintings from studio catalogue.';
    renderErrorState();
  } finally {
    isLoading = false;
  }
}

/**
 * Update the numeric badges on filter tabs
 */
function updateFilterCounts() {
  const total = paintingsCache.length;
  const available = paintingsCache.filter((p) => p.status === 'available').length;
  const sold = paintingsCache.filter((p) => p.status === 'sold').length;

  const countAll = document.getElementById('count-all');
  const countAvailable = document.getElementById('count-available');
  const countSold = document.getElementById('count-sold');

  if (countAll) countAll.textContent = total;
  if (countAvailable) countAvailable.textContent = available;
  if (countSold) countSold.textContent = sold;
}

/**
 * Render the filtered artwork cards
 */
function renderPaintingsGrid() {
  const container = document.getElementById('paintings-list-container');
  if (!container) return;

  const filtered = paintingsCache.filter((p) => {
    if (currentFilter === 'available') return p.status === 'available';
    if (currentFilter === 'sold') return p.status === 'sold';
    return true; // 'all'
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="state-container">
        <span class="material-symbols-outlined state-icon">palette</span>
        <h3 class="state-title">No paintings found</h3>
        <p class="state-message">
          ${
            currentFilter === 'available'
              ? 'All artworks in this collection are currently spoken for. Check back soon for new releases!'
              : currentFilter === 'sold'
              ? 'No sold paintings in this view.'
              : 'The studio catalogue is currently empty.'
          }
        </p>
      </div>
    `;
    return;
  }

  const user = getCurrentUser();

  const gridHtml = `
    <div class="paintings-grid" role="region" aria-label="Art Catalogue Grid">
      ${filtered
        .map((painting) => {
          const isAvail = painting.status === 'available';
          const formattedPrice = `₹${Number(painting.price).toLocaleString('en-IN')}`;

          return `
            <article class="artwork-card" data-id="${painting.id}" aria-label="${escapeHtml(painting.title)}">
              <!-- Clickable Artwork Frame Preview -->
              <div class="artwork-frame" data-action="view-preview" title="Click to view large preview">
                <img
                  src="${escapeHtml(painting.imageUrl || 'images/p-001.jpg')}"
                  alt="${escapeHtml(painting.title)}"
                  loading="lazy"
                  onerror="this.src='images/p-001.jpg'"
                />
                <div class="artwork-status-badge">
                  <span class="status-chip ${isAvail ? 'status-available' : 'status-sold'}">
                    <span class="status-chip-dot"></span>
                    ${isAvail ? 'Available' : 'Sold'}
                  </span>
                </div>
                <div class="artwork-preview-overlay">
                  <span class="material-symbols-outlined">visibility</span>
                  <span>Inspect Artwork</span>
                </div>
              </div>

              <!-- Artwork Body -->
              <div class="artwork-body">
                <div class="artwork-header-group">
                  <h3 class="artwork-title" data-action="view-preview" title="Inspect ${escapeHtml(painting.title)}">
                    ${escapeHtml(painting.title)}
                  </h3>
                  <span class="artwork-artist">${escapeHtml(painting.artist)}</span>
                </div>

                <p class="artwork-description" title="${escapeHtml(painting.description)}">
                  ${escapeHtml(painting.description)}
                </p>

                <div class="artwork-footer">
                  <div class="artwork-price-tag">
                    <span class="price-currency-label">Atelier Valuation</span>
                    <span class="price-amount">${formattedPrice}</span>
                  </div>

                  <div class="artwork-card-actions">
                    ${
                      !isAvail
                        ? `
                      <button type="button" class="btn btn-sm" disabled style="background-color: var(--atelier-surface-frame); color: var(--atelier-ink-muted); border-color: var(--atelier-border-light);">
                        <span class="material-symbols-outlined">lock</span>
                        <span>Acquired</span>
                      </button>
                    `
                        : !user
                        ? `
                      <button type="button" class="btn btn-sm btn-tonal" data-action="login-to-buy">
                        <span class="material-symbols-outlined">login</span>
                        <span>Sign In to Acquire</span>
                      </button>
                    `
                        : user.role === 'customer'
                        ? `
                      <button type="button" class="btn btn-sm btn-primary" data-action="buy-now">
                        <span class="material-symbols-outlined">shopping_bag</span>
                        <span>Acquire Artwork</span>
                      </button>
                    `
                        : user.role === 'studio'
                        ? `
                      <button type="button" class="btn btn-sm btn-outlined" data-action="edit-painting">
                        <span class="material-symbols-outlined">edit</span>
                        <span>Edit Details</span>
                      </button>
                    `
                        : ''
                    }
                  </div>
                </div>
              </div>
            </article>
          `;
        })
        .join('')}
    </div>
  `;

  container.innerHTML = gridHtml;

  // Bind delegated events to prevent event bubbling issues
  container.querySelectorAll('.artwork-card').forEach((card) => {
    const paintingId = card.dataset.id;
    const painting = paintingsCache.find((p) => p.id === paintingId);
    if (!painting) return;

    // Artwork Preview triggers (clicking image frame or title)
    card.querySelectorAll('[data-action="view-preview"]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        openArtworkDetailModal(painting);
      });
    });

    // Action button handlers with stopPropagation to isolate from card preview
    card.querySelector('[data-action="buy-now"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openPurchaseConfirmModal(painting);
    });

    card.querySelector('[data-action="login-to-buy"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openAuthModal('login', () => {
        renderPaintingsGrid();
      });
    });

    card.querySelector('[data-action="edit-painting"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditPaintingModal(painting);
    });
  });
}

function renderErrorState() {
  const container = document.getElementById('paintings-list-container');
  if (!container) return;

  container.innerHTML = `
    <div class="state-container">
      <span class="material-symbols-outlined state-icon" style="color: var(--md-sys-color-error);">error</span>
      <h3 class="state-title">Failed to load paintings</h3>
      <p class="state-message">${escapeHtml(loadError)}</p>
      <button type="button" class="btn btn-outlined" id="catalogue-retry-btn">
        <span class="material-symbols-outlined">refresh</span>
        Retry Connection
      </button>
    </div>
  `;

  document.getElementById('catalogue-retry-btn')?.addEventListener('click', () => {
    loadPaintings();
  });
}

/* ==========================================================================
   REQUIREMENT 4: Large Artwork Detail Preview Dialog
   ========================================================================== */

/**
 * Open the Large Dedicated Artwork Detail Preview Modal
 * Two-column desktop layout, uncropped full aspect-ratio preview, INR pricing,
 * customer buy action, studio edit action, accessible close/escape/backdrop behavior.
 * @param {object} painting
 */
export function openArtworkDetailModal(painting) {
  const modalId = `artwork-preview-${painting.id}`;
  const isAvail = painting.status === 'available';
  const formattedPrice = `₹${Number(painting.price).toLocaleString('en-IN')}`;
  const user = getCurrentUser();

  const content = document.createElement('div');
  content.className = 'artwork-preview-container';
  content.innerHTML = `
    <!-- Artwork Column: Complete uncropped image with warm matting -->
    <div class="artwork-preview-media">
      <img
        src="${escapeHtml(painting.imageUrl || 'images/p-001.jpg')}"
        alt="${escapeHtml(painting.title)}"
        onerror="this.src='images/p-001.jpg'"
      />
    </div>

    <!-- Details Column: Curated editorial metadata & action controls -->
    <div class="artwork-preview-details">
      <div class="preview-eyebrow">
        <span class="preview-tradition-badge">Traditional Atelier Masterwork</span>
        <span class="status-chip ${isAvail ? 'status-available' : 'status-sold'}">
          <span class="status-chip-dot"></span>
          ${isAvail ? 'Available for Acquisition' : 'Sold / Private Collection'}
        </span>
      </div>

      <h2 class="preview-title">${escapeHtml(painting.title)}</h2>
      <p class="preview-artist">Original work handcrafted by ${escapeHtml(painting.artist)}</p>

      <div class="preview-meta-grid">
        <div class="meta-item">
          <span class="meta-item-label">Acquisition Price</span>
          <span class="meta-item-value">${formattedPrice}</span>
        </div>
        <div class="meta-item">
          <span class="meta-item-label">Catalogue ID</span>
          <span class="meta-item-value" style="font-family: monospace; font-size: 0.95rem;">${escapeHtml(painting.id)}</span>
        </div>
      </div>

      <div style="margin-bottom: 0.75rem;">
        <span class="meta-item-label">Curator's Notes & Dimensions</span>
      </div>
      <p class="preview-description">
        ${escapeHtml(painting.description)}
      </p>

      <!-- Action Button Area -->
      <div class="preview-actions">
        ${
          !isAvail
            ? `
          <button type="button" class="btn" disabled style="background-color: var(--atelier-surface-sandstone); color: var(--atelier-ink-muted); width: 100%; border-color: var(--atelier-border);">
            <span class="material-symbols-outlined">lock</span>
            <span>Acquired (Part of a Private Collection)</span>
          </button>
        `
            : !user
            ? `
          <button type="button" class="btn btn-primary" id="preview-login-btn" style="width: 100%;">
            <span class="material-symbols-outlined">login</span>
            <span>Sign In to Acquire Artwork</span>
          </button>
        `
            : user.role === 'customer'
            ? `
          <button type="button" class="btn btn-primary" id="preview-buy-btn" style="width: 100%;">
            <span class="material-symbols-outlined">shopping_bag</span>
            <span>Acquire This Original Artwork</span>
          </button>
        `
            : user.role === 'studio'
            ? `
          <button type="button" class="btn btn-outlined" id="preview-edit-btn" style="width: 100%;">
            <span class="material-symbols-outlined">edit</span>
            <span>Edit Painting Details</span>
          </button>
        `
            : ''
        }
      </div>
    </div>
  `;

  openModal({
    id: modalId,
    content,
    size: 'artwork-preview',
    showCloseButton: true,
  });

  // Action listeners inside preview
  content.querySelector('#preview-buy-btn')?.addEventListener('click', () => {
    closeModal(modalId);
    openPurchaseConfirmModal(painting);
  });

  content.querySelector('#preview-login-btn')?.addEventListener('click', () => {
    closeModal(modalId);
    openAuthModal('login', () => {
      openArtworkDetailModal(painting);
    });
  });

  content.querySelector('#preview-edit-btn')?.addEventListener('click', () => {
    closeModal(modalId);
    openEditPaintingModal(painting);
  });
}

/* ==========================================================================
   Purchase Confirmation Modal
   ========================================================================== */

/**
 * Open explicit purchase confirmation dialog
 * Enforces two-step confirmation, shows customer info, executes backend order
 * @param {object} painting
 */
export function openPurchaseConfirmModal(painting) {
  const user = getCurrentUser();
  if (!user) {
    openAuthModal('login', () => openPurchaseConfirmModal(painting));
    return;
  }

  if (user.role !== 'customer') {
    showToast('Only customer accounts can acquire paintings.', 'error');
    return;
  }

  const modalId = `purchase-confirm-${painting.id}`;
  const formattedPrice = `₹${Number(painting.price).toLocaleString('en-IN')}`;

  const content = `
    <div style="display: flex; flex-direction: column; gap: 1.25rem;">
      <div style="display: flex; gap: 1rem; align-items: center; background-color: var(--md-sys-color-surface-container); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--md-sys-color-outline-variant);">
        <img
          src="${escapeHtml(painting.imageUrl || 'images/p-001.jpg')}"
          alt="${escapeHtml(painting.title)}"
          style="width: 72px; height: 72px; object-fit: cover; border-radius: var(--radius-sm);"
        />
        <div>
          <h4 style="font-family: var(--font-serif); font-size: 1.15rem; font-weight: 700;">${escapeHtml(painting.title)}</h4>
          <p style="font-size: 0.8125rem; color: var(--md-sys-color-secondary);">by ${escapeHtml(painting.artist)}</p>
          <strong style="color: var(--md-sys-color-primary); font-size: 1.1rem; display: block; margin-top: 0.25rem;">${formattedPrice}</strong>
        </div>
      </div>

      <div class="alert-banner alert-info" style="margin: 0;">
        <span class="material-symbols-outlined">info</span>
        <div>
          <strong>Original Art Guarantee:</strong> Traditional paintings are unique, single-edition works. Upon purchase confirmation, this painting is marked as sold immediately and reserved under your account.
        </div>
      </div>

      <div id="purchase-error-banner" style="display: none;" class="alert-banner alert-error">
        <span class="material-symbols-outlined">error</span>
        <span id="purchase-error-text"></span>
      </div>
    </div>
  `;

  const actions = `
    <button type="button" class="btn btn-tonal" id="purchase-cancel-btn">Cancel</button>
    <button type="button" class="btn btn-primary" id="purchase-confirm-btn">
      <span class="material-symbols-outlined">check_circle</span>
      Confirm &amp; Place Order
    </button>
  `;

  openModal({
    id: modalId,
    title: 'Confirm Artwork Acquisition',
    content,
    actions,
    size: 'sm',
  });

  document.getElementById('purchase-cancel-btn')?.addEventListener('click', () => {
    closeModal(modalId);
  });

  document.getElementById('purchase-confirm-btn')?.addEventListener('click', async () => {
    const confirmBtn = document.getElementById('purchase-confirm-btn');
    const cancelBtn = document.getElementById('purchase-cancel-btn');
    const errorBanner = document.getElementById('purchase-error-banner');
    const errorText = document.getElementById('purchase-error-text');

    if (errorBanner) errorBanner.style.display = 'none';

    try {
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_top</span> Placing order...';
      }
      if (cancelBtn) cancelBtn.disabled = true;

      const res = await api.orders.create(painting.id);
      closeModal(modalId);

      // Open Success Modal
      openPurchaseSuccessModal(res.order || { id: res.id, paintingTitle: painting.title, price: painting.price });

      // Refresh catalogue data so painting is immediately marked as sold
      await loadPaintings();
    } catch (err) {
      if (errorBanner && errorText) {
        errorText.textContent = err.message || 'Could not complete acquisition. This painting may have just been acquired.';
        errorBanner.style.display = 'flex';
      }
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<span class="material-symbols-outlined">check_circle</span> Confirm &amp; Place Order';
      }
      if (cancelBtn) cancelBtn.disabled = false;
    }
  });
}

/**
 * Success dialog after purchase
 */
function openPurchaseSuccessModal(order) {
  const modalId = `purchase-success-${Date.now()}`;
  const formattedPrice = `₹${Number(order.price).toLocaleString('en-IN')}`;

  const content = `
    <div style="text-align: center; padding: 1rem 0;">
      <div style="width: 56px; height: 56px; border-radius: 50%; background-color: var(--md-status-available-bg); color: var(--md-status-available-text); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
        <span class="material-symbols-outlined" style="font-size: 32px;">check</span>
      </div>
      <h3 style="font-family: var(--font-serif); font-size: 1.45rem; font-weight: 700; margin-bottom: 0.5rem;">Acquisition Confirmed!</h3>
      <p style="font-size: 0.9375rem; color: var(--md-sys-color-on-surface-variant); margin-bottom: 1.25rem;">
        Thank you! Your order for <strong>${escapeHtml(order.paintingTitle || 'Original Painting')}</strong> (${formattedPrice}) has been securely recorded.
      </p>
      <div style="background-color: var(--md-sys-color-surface-container); padding: 0.75rem 1rem; border-radius: var(--radius-sm); display: inline-block; font-family: monospace; font-size: 0.8125rem;">
        Order Ref: ${escapeHtml(order.id)}
      </div>
    </div>
  `;

  const actions = `
    <button type="button" class="btn btn-tonal" id="success-close-btn">Return to Gallery</button>
    <button type="button" class="btn btn-primary" id="success-view-orders-btn">
      <span class="material-symbols-outlined">receipt_long</span>
      View My Orders
    </button>
  `;

  openModal({
    id: modalId,
    title: '',
    content,
    actions,
    size: 'sm',
  });

  document.getElementById('success-close-btn')?.addEventListener('click', () => {
    closeModal(modalId);
  });

  document.getElementById('success-view-orders-btn')?.addEventListener('click', () => {
    closeModal(modalId);
    window.location.hash = '#customer-dashboard';
  });
}

/* ==========================================================================
   Studio Painting Management (Add & Edit)
   ========================================================================== */

/**
 * Open Studio Add Painting Modal
 */
export function openAddPaintingModal() {
  const modalId = 'add-painting-modal';

  const content = `
    <form id="add-painting-form">
      <div class="form-group">
        <label class="form-label" for="add-title">Painting Title *</label>
        <input type="text" id="add-title" class="form-control" required placeholder="e.g. Madhubani Tree of Life" />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="add-artist">Master Artist *</label>
          <input type="text" id="add-artist" class="form-control" required placeholder="e.g. Meera Kumari" />
        </div>
        <div class="form-group">
          <label class="form-label" for="add-price">Price (INR ₹) *</label>
          <input type="number" id="add-price" class="form-control" required min="1" step="50" placeholder="e.g. 7500" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="add-image-url">Image Path *</label>
        <input type="text" id="add-image-url" class="form-control" required value="images/p-001.jpg" />
        <span class="form-hint">E.g. images/p-001.jpg up to images/p-012.jpg, or a valid URL.</span>
      </div>

      <div class="form-group">
        <label class="form-label" for="add-description">Artwork Description & Dimensions *</label>
        <textarea id="add-description" class="form-control" required placeholder="Tradition, pigments used, dimensions, and significance..."></textarea>
      </div>

      <div id="add-painting-error" style="display: none;" class="alert-banner alert-error">
        <span class="material-symbols-outlined">error</span>
        <span id="add-painting-error-msg"></span>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.25rem;">
        <button type="button" class="btn btn-tonal" id="add-painting-cancel-btn">Cancel</button>
        <button type="submit" class="btn btn-primary" id="add-painting-submit-btn">
          <span class="material-symbols-outlined">add</span>
          Add to Gallery
        </button>
      </div>
    </form>
  `;

  openModal({
    id: modalId,
    title: 'Add New Painting to Inventory',
    content,
    size: 'md',
  });

  document.getElementById('add-painting-cancel-btn')?.addEventListener('click', () => {
    closeModal(modalId);
  });

  document.getElementById('add-painting-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBanner = document.getElementById('add-painting-error');
    const errorMsg = document.getElementById('add-painting-error-msg');
    const submitBtn = document.getElementById('add-painting-submit-btn');

    if (errorBanner) errorBanner.style.display = 'none';

    const payload = {
      title: document.getElementById('add-title').value.trim(),
      artist: document.getElementById('add-artist').value.trim(),
      price: parseFloat(document.getElementById('add-price').value),
      imageUrl: document.getElementById('add-image-url').value.trim(),
      description: document.getElementById('add-description').value.trim(),
    };

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_top</span> Adding...';
      }
      await api.paintings.create(payload);
      closeModal(modalId);
      showToast('New painting added to catalogue.', 'success');
      await loadPaintings();
    } catch (err) {
      if (errorBanner && errorMsg) {
        errorMsg.textContent = err.message || 'Failed to add painting.';
        errorBanner.style.display = 'flex';
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="material-symbols-outlined">add</span> Add to Gallery';
      }
    }
  });
}

/**
 * Open Studio Edit Painting Modal (Available paintings only)
 * @param {object} painting
 */
export function openEditPaintingModal(painting) {
  if (painting.status === 'sold') {
    showToast('Sold paintings cannot be modified per studio business rules.', 'error');
    return;
  }

  const modalId = `edit-painting-${painting.id}`;

  const content = `
    <form id="edit-painting-form">
      <div class="form-group">
        <label class="form-label" for="edit-title">Painting Title *</label>
        <input type="text" id="edit-title" class="form-control" required value="${escapeHtml(painting.title)}" />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="edit-artist">Master Artist *</label>
          <input type="text" id="edit-artist" class="form-control" required value="${escapeHtml(painting.artist)}" />
        </div>
        <div class="form-group">
          <label class="form-label" for="edit-price">Price (INR ₹) *</label>
          <input type="number" id="edit-price" class="form-control" required min="1" step="50" value="${painting.price}" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="edit-image-url">Image Path *</label>
        <input type="text" id="edit-image-url" class="form-control" required value="${escapeHtml(painting.imageUrl || '')}" />
      </div>

      <div class="form-group">
        <label class="form-label" for="edit-description">Description *</label>
        <textarea id="edit-description" class="form-control" required>${escapeHtml(painting.description)}</textarea>
      </div>

      <div id="edit-painting-error" style="display: none;" class="alert-banner alert-error">
        <span class="material-symbols-outlined">error</span>
        <span id="edit-painting-error-msg"></span>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.25rem;">
        <button type="button" class="btn btn-tonal" id="edit-painting-cancel-btn">Cancel</button>
        <button type="submit" class="btn btn-primary" id="edit-painting-submit-btn">
          <span class="material-symbols-outlined">save</span>
          Save Modifications
        </button>
      </div>
    </form>
  `;

  openModal({
    id: modalId,
    title: `Edit Details: ${painting.title}`,
    content,
    size: 'md',
  });

  document.getElementById('edit-painting-cancel-btn')?.addEventListener('click', () => {
    closeModal(modalId);
  });

  document.getElementById('edit-painting-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBanner = document.getElementById('edit-painting-error');
    const errorMsg = document.getElementById('edit-painting-error-msg');
    const submitBtn = document.getElementById('edit-painting-submit-btn');

    if (errorBanner) errorBanner.style.display = 'none';

    const payload = {
      title: document.getElementById('edit-title').value.trim(),
      artist: document.getElementById('edit-artist').value.trim(),
      price: parseFloat(document.getElementById('edit-price').value),
      imageUrl: document.getElementById('edit-image-url').value.trim(),
      description: document.getElementById('edit-description').value.trim(),
    };

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_top</span> Saving...';
      }
      await api.paintings.update(painting.id, payload);
      closeModal(modalId);
      showToast('Painting details updated successfully.', 'success');
      await loadPaintings();
    } catch (err) {
      if (errorBanner && errorMsg) {
        errorMsg.textContent = err.message || 'Failed to update painting.';
        errorBanner.style.display = 'flex';
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="material-symbols-outlined">save</span> Save Modifications';
      }
    }
  });
}
