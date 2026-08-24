import React, { useEffect } from 'react';

export function UrgencyBadge({ level }: { level: 'LOW' | 'MEDIUM' | 'HIGH' }) {
  const styles = {
    LOW: 'bg-mint text-pine',
    MEDIUM: 'bg-amber-100 text-amber-800',
    HIGH: 'bg-red-100 text-red-700',
  } as const;
  return <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${styles[level]}`}>{level} urgency</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-clay text-ink/70',
    CONFIRMED: 'bg-mint text-pine',
    COMPLETED: 'bg-ink/10 text-ink',
    CANCELLED: 'bg-red-100 text-red-700',
    RESCHEDULED: 'bg-amber-100 text-amber-800',
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${styles[status] || 'bg-clay'}`}>{status.toLowerCase()}</span>;
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [message, onClose]);
  if (!message) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-xl bg-ink px-5 py-4 text-sm text-white shadow-xl">
      {message}
      <button className="ml-3 font-semibold text-mint" onClick={onClose}>Close</button>
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <p className="rounded-xl bg-clay p-4 text-sm text-ink/65">{text}</p>;
}
