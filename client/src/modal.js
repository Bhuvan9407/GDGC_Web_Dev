/**
 * KalaKriti Art Studio — Reusable Vanilla Modal & Notification System
 *
 * Provides:
 * - openModal(): Renders an accessible, responsive dialog with backdrop and escape key support
 * - closeModal(): Cleans up dialog DOM and restores document scrolling
 * - confirmDialog(): Lightweight confirmation modal for cancellations or administrative actions
 * - showToast(): Non-intrusive floating feedback messages for success/errors
 */

let activeModalId = null;
let escapeListener = null;

/**
 * Open a modal dialog
 * @param {object} config
 * @param {string} [config.id] - Optional DOM identifier
 * @param {string} [config.title] - Dialog header title
 * @param {string|HTMLElement} config.content - HTML string or DOM node for body
 * @param {string|HTMLElement} [config.actions] - Optional footer action buttons
 * @param {'sm'|'md'|'lg'|'artwork-preview'} [config.size='md'] - Sizing variant
 * @param {boolean} [config.showCloseButton=true] - Whether to show the top-right close 'X'
 * @param {Function} [config.onClose] - Cleanup hook
 * @returns {HTMLElement} The created dialog container
 */
export function openModal({
  id = `modal-${Date.now()}`,
  title = '',
  content = '',
  actions = null,
  size = 'md',
  showCloseButton = true,
  onClose = null,
}) {
  // If a modal is already open, close it first
  if (activeModalId) {
    closeModal(activeModalId);
  }

  const container = document.getElementById('modal-container');
  if (!container) return null;

  activeModalId = id;
  document.body.style.overflow = 'hidden'; // Prevent background scrolling

  const scrim = document.createElement('div');
  scrim.className = 'modal-scrim';
  scrim.id = id;
  scrim.setAttribute('role', 'presentation');

  // Modal dialog box
  const dialog = document.createElement('div');
  dialog.className = `modal-dialog modal-${size}`;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  if (title) dialog.setAttribute('aria-label', title);

  // Prevent clicks inside the dialog from closing the modal
  dialog.addEventListener('click', (e) => e.stopPropagation());

  // Dedicated large artwork preview has its own bespoke layout (Requirement 4)
  if (size === 'artwork-preview') {
    if (showCloseButton) {
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'modal-close-corner';
      closeBtn.setAttribute('aria-label', 'Close artwork preview');
      closeBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
      closeBtn.addEventListener('click', () => closeModal(id));
      dialog.appendChild(closeBtn);
    }

    if (typeof content === 'string') {
      dialog.insertAdjacentHTML('beforeend', content);
    } else if (content instanceof HTMLElement) {
      dialog.appendChild(content);
    }
  } else {
    // Standard dialog layout with Header, Body, Footer
    if (title || showCloseButton) {
      const header = document.createElement('div');
      header.className = 'modal-header';

      if (title) {
        const titleEl = document.createElement('h3');
        titleEl.className = 'modal-title';
        titleEl.textContent = title;
        header.appendChild(titleEl);
      }

      if (showCloseButton) {
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'btn-text';
        closeBtn.setAttribute('aria-label', 'Close dialog');
        closeBtn.style.padding = '4px 8px';
        closeBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
        closeBtn.addEventListener('click', () => closeModal(id));
        header.appendChild(closeBtn);
      }

      dialog.appendChild(header);
    }

    // Modal Body
    const body = document.createElement('div');
    body.className = 'modal-body';
    if (typeof content === 'string') {
      body.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      body.appendChild(content);
    }
    dialog.appendChild(body);

    // Modal Footer Actions
    if (actions) {
      const footer = document.createElement('div');
      footer.className = 'modal-footer';
      if (typeof actions === 'string') {
        footer.innerHTML = actions;
      } else if (actions instanceof HTMLElement) {
        footer.appendChild(actions);
      }
      dialog.appendChild(footer);
    }
  }

  // Backdrop click closes dialog
  scrim.addEventListener('click', () => {
    closeModal(id);
  });

  scrim.appendChild(dialog);
  container.appendChild(scrim);

  // Escape key closes modal
  escapeListener = (e) => {
    if (e.key === 'Escape') {
      closeModal(id);
    }
  };
  window.addEventListener('keydown', escapeListener);

  // Store onClose callback on element
  if (onClose) {
    scrim._onCloseCallback = onClose;
  }

  return dialog;
}

/**
 * Close a specific modal dialog
 * @param {string} [id] - Modal ID to close
 */
export function closeModal(id = activeModalId) {
  if (!id) return;
  const scrim = document.getElementById(id);
  if (scrim) {
    if (typeof scrim._onCloseCallback === 'function') {
      scrim._onCloseCallback();
    }
    scrim.remove();
  }

  if (activeModalId === id) {
    activeModalId = null;
  }

  // Check if any modal is still present
  const remaining = document.querySelectorAll('.modal-scrim');
  if (remaining.length === 0) {
    document.body.style.overflow = 'auto'; // Restore page scrolling
    if (escapeListener) {
      window.removeEventListener('keydown', escapeListener);
      escapeListener = null;
    }
  }
}

/**
 * Confirm dialog helper (replaces browser confirm)
 */
export function confirmDialog({
  title = 'Please Confirm',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false,
  onConfirm,
}) {
  const content = document.createElement('div');
  content.innerHTML = `<p style="font-size: 0.95rem; color: var(--md-sys-color-on-surface-variant); line-height: 1.5;">${message}</p>`;

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '0.5rem';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn-tonal';
  cancelBtn.textContent = cancelText;

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = `btn ${isDanger ? 'btn-danger' : 'btn-primary'}`;
  confirmBtn.textContent = confirmText;

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);

  const modalId = `confirm-${Date.now()}`;
  openModal({
    id: modalId,
    title,
    content,
    actions,
    size: 'sm',
  });

  cancelBtn.addEventListener('click', () => closeModal(modalId));
  confirmBtn.addEventListener('click', async () => {
    closeModal(modalId);
    if (onConfirm) await onConfirm();
  });
}

/**
 * Floating Toast notification
 */
export function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconName = type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info';
  toast.innerHTML = `
    <span class="material-symbols-outlined" style="font-size: 20px;">${iconName}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
