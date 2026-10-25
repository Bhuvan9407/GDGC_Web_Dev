/**
 * KalaKriti Art Studio — Main Application Entry Point
 *
 * Coordinates:
 * - Session verification on bootstrap
 * - Hash-based client routing between Gallery, Customer Dashboard, and Studio Admin
 * - Active view rendering into #view-container
 * - Navigation tab state synchronization
 */

import { checkSession, getCurrentUser, isCustomer, isStudio, onAuthChange, openAuthModal } from './auth.js';
import { renderCatalogueView } from './catalogue.js';
import { renderCustomerDashboardView } from './customer-dashboard.js';
import { renderStudioDashboardView } from './studio-dashboard.js';

let activeViewName = 'catalogue'; // 'catalogue' | 'customer-dashboard' | 'studio-dashboard'

/**
 * Navigate to a specific view
 * @param {'catalogue'|'customer-dashboard'|'studio-dashboard'} viewName
 */
export async function navigateTo(viewName) {
  activeViewName = viewName;
  window.location.hash = `#${viewName}`;
  await renderActiveView();
}

/**
 * Render the active route view into the DOM
 */
async function renderActiveView() {
  const container = document.getElementById('view-container');
  if (!container) return;

  // Extract hash without leading '#'
  const hash = window.location.hash.replace(/^#/, '') || 'catalogue';
  activeViewName = hash;

  // Synchronize navigation tab buttons
  const navCatalogue = document.getElementById('nav-catalogue-btn');
  const navCustomer = document.getElementById('nav-customer-btn');
  const navStudio = document.getElementById('nav-studio-btn');

  if (navCatalogue) navCatalogue.classList.toggle('active', activeViewName === 'catalogue');
  if (navCustomer) navCustomer.classList.toggle('active', activeViewName === 'customer-dashboard');
  if (navStudio) navStudio.classList.toggle('active', activeViewName === 'studio-dashboard');

  // Route to the appropriate module
  if (activeViewName === 'customer-dashboard') {
    const user = getCurrentUser();
    if (!user || user.role !== 'customer') {
      container.innerHTML = `
        <div class="state-container" style="margin-top: 2rem;">
          <span class="material-symbols-outlined state-icon" style="color: var(--md-sys-color-primary);">lock</span>
          <h2 class="state-title">Patron Sign In Required</h2>
          <p class="state-message">Please sign in with your customer account to view your art collection, mural bookings, and pottery requests.</p>
          <button type="button" class="btn btn-primary" id="route-signin-btn">
            <span class="material-symbols-outlined">login</span>
            Sign In
          </button>
        </div>
      `;
      document.getElementById('route-signin-btn')?.addEventListener('click', () => {
        openAuthModal('login', () => renderActiveView());
      });
      return;
    }
    await renderCustomerDashboardView(container);
  } else if (activeViewName === 'studio-dashboard') {
    const user = getCurrentUser();
    if (!user || user.role !== 'studio') {
      container.innerHTML = `
        <div class="state-container" style="margin-top: 2rem;">
          <span class="material-symbols-outlined state-icon" style="color: var(--md-sys-color-error);">gpp_bad</span>
          <h2 class="state-title">Access Restricted to Studio Administration</h2>
          <p class="state-message">You need studio director credentials to access this management dashboard.</p>
          <button type="button" class="btn btn-outlined" onclick="window.location.hash='#catalogue'">
            Return to Public Gallery
          </button>
        </div>
      `;
      return;
    }
    await renderStudioDashboardView(container);
  } else {
    // Default to Catalogue Gallery
    await renderCatalogueView(container);
  }
}

/**
 * Theme Management (Light Mode by default, Dark Mode toggle supported)
 */
export function initTheme() {
  const saved = localStorage.getItem('kalakriti_theme') || 'light';
  applyTheme(saved);

  const toggleBtn = document.getElementById('theme-toggle-btn');
  toggleBtn?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('kalakriti_theme', theme);

  const icon = document.getElementById('theme-toggle-icon');
  const text = document.getElementById('theme-toggle-text');
  const btn = document.getElementById('theme-toggle-btn');

  if (theme === 'dark') {
    if (icon) icon.textContent = 'light_mode';
    if (text) text.textContent = 'Day';
    if (btn) btn.setAttribute('title', 'Switch to Day Atelier (Light Mode)');
  } else {
    if (icon) icon.textContent = 'dark_mode';
    if (text) text.textContent = 'Night';
    if (btn) btn.setAttribute('title', 'Switch to Night Gallery (Dark Mode)');
  }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize theme (default: light)
  initTheme();

  // Set current year in footer
  const yearEl = document.getElementById('current-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Bind Brand Logo click
  document.getElementById('brand-logo-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('catalogue');
  });

  // Bind Navigation Tab buttons
  document.getElementById('nav-catalogue-btn')?.addEventListener('click', () => navigateTo('catalogue'));
  document.getElementById('nav-customer-btn')?.addEventListener('click', () => navigateTo('customer-dashboard'));
  document.getElementById('nav-studio-btn')?.addEventListener('click', () => navigateTo('studio-dashboard'));

  // Listen to browser hash changes (Back / Forward button support)
  window.addEventListener('hashchange', () => {
    renderActiveView();
  });

  // Subscribe to auth state changes to refresh views if needed
  onAuthChange(() => {
    renderActiveView();
  });

  // Check persistent session on initial bootstrap
  await checkSession();

  // Initial render
  await renderActiveView();
});
