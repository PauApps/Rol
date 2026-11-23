import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'gold';

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral:
    'bg-[var(--rol-status-neutral-bg)] text-[var(--rol-status-neutral-ink)] border-[var(--rol-status-neutral-border)]',
  success:
    'bg-[var(--rol-status-success-bg)] text-[var(--rol-status-success-ink)] border-[var(--rol-status-success-border)]',
  warning:
    'bg-[var(--rol-status-warning-bg)] text-[var(--rol-status-warning-ink)] border-[var(--rol-status-warning-border)]',
  danger:
    'bg-[var(--rol-status-danger-bg)] text-[var(--rol-status-danger-ink)] border-[var(--rol-status-danger-border)]',
  gold:
    'bg-[var(--rol-accent-gold-soft)] text-[var(--rol-ink-primary)] border-[var(--rol-accent-gold)]',
};

export function Badge({ tone = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
