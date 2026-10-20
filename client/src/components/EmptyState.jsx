import React from 'react';

export default function EmptyState({
  icon = 'palette',
  title = 'No items found',
  message = 'There are no records to display at this moment.',
  actionLabel,
  onAction,
}) {
  return (
    <div className="state-container">
      <span className="material-symbols-outlined state-icon" aria-hidden="true">
        {icon}
      </span>
      <h3 className="title-large" style={{ color: 'var(--md-sys-color-on-surface)' }}>
        {title}
      </h3>
      <p className="body-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)', maxWidth: '420px' }}>
        {message}
      </p>
      {actionLabel && onAction && (
        <button type="button" className="md-btn md-btn-tonal" onClick={onAction} style={{ marginTop: '0.5rem' }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
