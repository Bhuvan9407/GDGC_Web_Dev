import React from 'react';

export default function LoadingSpinner({ message = 'Loading studio data...' }) {
  return (
    <div className="state-container" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true"></div>
      <p className="body-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
        {message}
      </p>
    </div>
  );
}
