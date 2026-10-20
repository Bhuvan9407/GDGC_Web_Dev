import React from 'react';

const STATUS_ICONS = {
  available: 'check_circle',
  sold: 'block',
  placed: 'shopping_bag',
  requested: 'schedule',
  confirmed: 'verified',
  accepted: 'task_alt',
  declined: 'cancel',
  cancelled: 'remove_circle_outline',
};

export default function StatusChip({ status }) {
  if (!status) return null;
  const normalized = status.toLowerCase();
  const icon = STATUS_ICONS[normalized] || 'info';

  return (
    <span className={`md-chip md-chip-${normalized}`}>
      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
        {icon}
      </span>
      {status}
    </span>
  );
}
