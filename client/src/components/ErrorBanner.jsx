import React from 'react';

export default function ErrorBanner({ message, onRetry }) {
  if (!message) return null;

  return (
    <div className="md-banner md-banner-error" role="alert">
      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
        error
      </span>
      <div style={{ flex: 1, fontSize: '0.875rem' }}>{message}</div>
      {onRetry && (
        <button
          type="button"
          className="md-btn md-btn-sm md-btn-outlined"
          onClick={onRetry}
          style={{ borderColor: 'var(--md-sys-color-error)', color: 'var(--md-sys-color-error)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
            refresh
          </span>
          Retry
        </button>
      )}
    </div>
  );
}
