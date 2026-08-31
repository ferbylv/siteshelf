import type { ReactNode } from 'react';

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <svg width="56" height="40" viewBox="0 0 56 40" fill="none" aria-hidden="true">
        <rect x="4" y="22" width="48" height="6" rx="2" fill="currentColor" opacity="0.18" />
        <rect x="10" y="10" width="8" height="18" rx="1.5" fill="currentColor" opacity="0.35" />
        <rect x="21" y="6" width="8" height="22" rx="1.5" fill="currentColor" opacity="0.5" />
        <rect x="32" y="12" width="8" height="16" rx="1.5" fill="currentColor" opacity="0.35" />
        <rect x="43" y="8" width="6" height="20" rx="1.5" fill="currentColor" opacity="0.25" />
      </svg>
      <strong>{title}</strong>
      <span>{detail}</span>
      {action}
    </div>
  );
}
