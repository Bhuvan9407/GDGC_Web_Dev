/**
 * KalaKriti Art Studio — Authentication & Session Management Module
 *
 * Manages:
 * - Current user session state
 * - Registration, Login, Logout HTTP calls
 * - Auth modal rendering with tab switching & demo credentials
 * - Header user controls rendering based on role
 */

import { api } from './api.js';
import { openModal, closeModal, showToast } from './modal.js';

let currentUser = null;
const authListeners = [];

/**
 * Get the currently authenticated user or null
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Check if a user is currently signed in
 */
export function isLoggedIn() {
  return currentUser !== null;
}

/**
 * Check if the active user is a Studio Administrator
 */
export function isStudio() {
  return currentUser && currentUser.role === 'studio';
}

/**
 * Check if the active user is a Customer
 */
export function isCustomer() {
  return currentUser && currentUser.role === 'customer';
}

/**
 * Subscribe to authentication state changes
 * @param {Function} callback
 */
export function onAuthChange(callback) {
  authListeners.push(callback);
}

function notifyAuthChange() {
  renderHeaderUserControls();
  authListeners.forEach((fn) => {
    try {
      fn(currentUser);
    } catch (e) {
      console.error('Error in auth listener:', e);
    }
  });
}

/**
 * Verify persistent server-side session on application load
 */
export async function checkSession() {
  try {
    const res = await api.auth.getMe();
    currentUser = res && res.user ? res.user : null;
  } catch (err) {
    currentUser = null;
  }
  notifyAuthChange();
  return currentUser;
}

/**
 * Sign in existing user
 */
export async function login(email, password) {
  const res = await api.auth.login({ email, password });
  currentUser = res.user;
  notifyAuthChange();
  showToast(`Welcome back, ${currentUser.name}!`, 'success');
  return currentUser;
}

/**
 * Register new customer account
 */
export async function register(name, email, password) {
  const res = await api.auth.register({ name, email, password });
  currentUser = res.user;
  notifyAuthChange();
  showToast(`Account created! Welcome to KalaKriti, ${currentUser.name}.`, 'success');
  return currentUser;
}

/**
 * Sign out current user
 */
export async function logout() {
  try {
    await api.auth.logout();
  } catch (err) {
    console.error('Logout error:', err);
  } finally {
    currentUser = null;
    notifyAuthChange();
    showToast('You have been signed out.', 'info');
  }
}

/**
 * Render Header User Controls in the Navigation Bar
 */
export function renderHeaderUserControls() {
  const container = document.getElementById('header-user-controls');
  const navCustomerBtn = document.getElementById('nav-customer-btn');
  const navStudioBtn = document.getElementById('nav-studio-btn');

  if (!container) return;

  // Update navigation tab visibility based on authenticated role
  if (navCustomerBtn) {
    navCustomerBtn.style.display = isCustomer() ? 'inline-flex' : 'none';
  }
  if (navStudioBtn) {
    navStudioBtn.style.display = isStudio() ? 'inline-flex' : 'none';
  }

  if (currentUser) {
    container.innerHTML = `
      <div class="user-identity-badge">
        <span class="material-symbols-outlined" style="font-size: 18px; color: var(--md-sys-color-primary);">
          ${currentUser.role === 'studio' ? 'verified_user' : 'person'}
        </span>
        <div class="user-identity-text">
          <span class="user-identity-name">${escapeHtml(currentUser.name)}</span>
          <span class="user-identity-role">${currentUser.role === 'studio' ? 'Studio Admin' : 'Customer'}</span>
        </div>
      </div>
      <button type="button" class="btn btn-sm btn-outlined" id="header-logout-btn" title="Sign out of your session">
        <span class="material-symbols-outlined">logout</span>
        <span>Sign Out</span>
      </button>
    `;

    document.getElementById('header-logout-btn')?.addEventListener('click', async () => {
      await logout();
      // Navigate to catalogue if currently on a protected dashboard
      window.location.hash = '#catalogue';
    });
  } else {
    container.innerHTML = `
      <button type="button" class="btn btn-sm btn-primary" id="header-login-btn">
        <span class="material-symbols-outlined">login</span>
        <span>Sign In</span>
      </button>
    `;

    document.getElementById('header-login-btn')?.addEventListener('click', () => {
      openAuthModal('login');
    });
  }
}

/**
 * Open the Authentication Dialog (Login & Customer Registration)
 * @param {'login'|'register'} initialTab
 * @param {Function} [onSuccess]
 */
export function openAuthModal(initialTab = 'login', onSuccess = null) {
  const modalId = 'auth-modal';
  let activeTab = initialTab;

  function renderModalContent() {
    return `
      <div>
        <!-- Tabs Switcher -->
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--md-sys-color-outline-variant); padding-bottom: 0.5rem;">
          <button
            type="button"
            id="auth-tab-login"
            class="btn btn-sm ${activeTab === 'login' ? 'btn-secondary' : 'btn-text'}"
            style="flex: 1;"
          >
            <span class="material-symbols-outlined">login</span>
            Sign In
          </button>
          <button
            type="button"
            id="auth-tab-register"
            class="btn btn-sm ${activeTab === 'register' ? 'btn-secondary' : 'btn-text'}"
            style="flex: 1;"
          >
            <span class="material-symbols-outlined">person_add</span>
            Customer Register
          </button>
        </div>

        <!-- Inline Error Banner -->
        <div id="auth-error-banner" style="display: none;" class="alert-banner alert-error">
          <span class="material-symbols-outlined" style="font-size: 18px;">error</span>
          <span id="auth-error-message"></span>
        </div>

        ${
          activeTab === 'login'
            ? `
          <form id="auth-login-form">
            <div class="form-group">
              <label class="form-label" for="login-email">Email Address</label>
              <input type="email" id="login-email" class="form-control" required placeholder="e.g. artlover@example.com" autocomplete="email" />
            </div>

            <div class="form-group">
              <label class="form-label" for="login-password">Password</label>
              <input type="password" id="login-password" class="form-control" required placeholder="••••••••" autocomplete="current-password" />
            </div>

            <button type="submit" class="btn btn-primary" id="login-submit-btn" style="width: 100%; margin-top: 0.75rem;">
              <span class="material-symbols-outlined">login</span>
              Sign In
            </button>

            <!-- Demo Studio Account Quick-Fill -->
            <div style="margin-top: 1.25rem; padding-top: 1rem; border-top: 1px dashed var(--md-sys-color-outline-variant); text-align: center;">
              <p style="font-size: 0.75rem; color: var(--md-sys-color-outline); margin-bottom: 0.5rem;">
                Evaluating the studio dashboard?
              </p>
              <button type="button" class="btn btn-sm btn-tonal" id="auth-fill-studio-btn" style="width: 100%;">
                <span class="material-symbols-outlined">admin_panel_settings</span>
                Use Demo Studio Account (studio@artstudio.in)
              </button>
            </div>
          </form>
        `
            : `
          <form id="auth-register-form">
            <div class="form-group">
              <label class="form-label" for="register-name">Full Name</label>
              <input type="text" id="register-name" class="form-control" required placeholder="e.g. Ananya Sharma" autocomplete="name" />
            </div>

            <div class="form-group">
              <label class="form-label" for="register-email">Email Address</label>
              <input type="email" id="register-email" class="form-control" required placeholder="e.g. ananya@example.com" autocomplete="email" />
            </div>

            <div class="form-group">
              <label class="form-label" for="register-password">Password</label>
              <input type="password" id="register-password" class="form-control" required minlength="6" placeholder="At least 6 characters" autocomplete="new-password" />
              <span class="form-hint">Used to securely access your orders and bookings.</span>
            </div>

            <button type="submit" class="btn btn-primary" id="register-submit-btn" style="width: 100%; margin-top: 0.75rem;">
              <span class="material-symbols-outlined">person_add</span>
              Create Customer Account
            </button>
          </form>
        `
        }
      </div>
    `;
  }

  function bindEvents() {
    const errorBanner = document.getElementById('auth-error-banner');
    const errorMessage = document.getElementById('auth-error-message');

    function showError(msg) {
      if (errorBanner && errorMessage) {
        errorMessage.textContent = msg;
        errorBanner.style.display = 'flex';
      }
    }

    function clearError() {
      if (errorBanner) {
        errorBanner.style.display = 'none';
      }
    }

    // Tab buttons
    document.getElementById('auth-tab-login')?.addEventListener('click', () => {
      activeTab = 'login';
      refreshDialog();
    });

    document.getElementById('auth-tab-register')?.addEventListener('click', () => {
      activeTab = 'register';
      refreshDialog();
    });

    // Demo Fill button
    document.getElementById('auth-fill-studio-btn')?.addEventListener('click', () => {
      const emailInput = document.getElementById('login-email');
      const passInput = document.getElementById('login-password');
      if (emailInput && passInput) {
        emailInput.value = 'studio@artstudio.in';
        passInput.value = 'Studio@123';
        clearError();
      }
    });

    // Login Form Submit
    document.getElementById('auth-login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError();
      const submitBtn = document.getElementById('login-submit-btn');
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_top</span> Signing in...';
        }
        const user = await login(email, password);
        closeModal(modalId);
        if (onSuccess) onSuccess(user);
      } catch (err) {
        showError(err.message || 'Login failed. Please check your email and password.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span class="material-symbols-outlined">login</span> Sign In';
        }
      }
    });

    // Register Form Submit
    document.getElementById('auth-register-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError();
      const submitBtn = document.getElementById('register-submit-btn');
      const name = document.getElementById('register-name').value.trim();
      const email = document.getElementById('register-email').value.trim();
      const password = document.getElementById('register-password').value;

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_top</span> Creating account...';
        }
        const user = await register(name, email, password);
        closeModal(modalId);
        if (onSuccess) onSuccess(user);
      } catch (err) {
        showError(err.message || 'Registration failed. This email may already be in use.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span class="material-symbols-outlined">person_add</span> Create Customer Account';
        }
      }
    });
  }

  function refreshDialog() {
    const dialog = openModal({
      id: modalId,
      title: activeTab === 'login' ? 'Sign In to KalaKriti' : 'Join Our Art Community',
      content: renderModalContent(),
      size: 'sm',
    });
    bindEvents();
  }

  refreshDialog();
}

/**
 * Safe string escape helper for DOM injection
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
