import React from 'react';

export default function StatusBadge({ status }) {
  const formatStatus = (s) => {
    switch (s) {
      case 'pending':
        return { label: 'Pending Approval', class: 'badge-pending', icon: '⏳' };
      case 'confirmed':
        return { label: 'Confirmed', class: 'badge-confirmed', icon: '✅' };
      case 'preparing':
        return { label: 'Preparing', class: 'badge-preparing', icon: '👩‍🍳' };
      case 'out_for_delivery':
        return { label: 'Out for Delivery', class: 'badge-out-for-delivery', icon: '🛵' };
      case 'delivered':
        return { label: 'Delivered', class: 'badge-delivered', icon: '🎉' };
      case 'cancelled':
        return { label: 'Cancelled', class: 'badge-cancelled', icon: '❌' };
      default:
        return { label: s, class: 'badge-pending', icon: '💡' };
    }
  };

  const badge = formatStatus(status);

  return (
    <span className={`badge ${badge.class}`}>
      <span>{badge.icon}</span> {badge.label}
    </span>
  );
}
