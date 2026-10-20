import React, { useEffect } from 'react';

export default function Modal({ isOpen, title, onClose, children, actions }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="md-scrim" onClick={onClose} role="presentation">
      <div
        className="md-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 id="dialog-title" className="title-large" style={{ color: 'var(--md-sys-color-on-surface)' }}>
            {title}
          </h3>
          {onClose && (
            <button
              type="button"
              className="md-btn-text"
              onClick={onClose}
              style={{ padding: '4px', height: 'auto', borderRadius: '50%', border: 'none', cursor: 'pointer' }}
              aria-label="Close dialog"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                close
              </span>
            </button>
          )}
        </div>

        <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>{children}</div>

        {actions && <div className="md-dialog-actions">{actions}</div>}
      </div>
    </div>
  );
}
