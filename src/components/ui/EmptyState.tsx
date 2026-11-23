import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="rol-card-surface flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface-alt)] text-[var(--rol-accent-primary)]">
          {icon}
        </div>
      )}
      <h2 className="rol-heading-flourish text-xl font-semibold text-[var(--rol-ink-primary)]">
        {title}
      </h2>
      <p className="mt-2 max-w-md text-sm text-[var(--rol-ink-secondary)]">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
