import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function Card({ children, className = '', title, subtitle, actions }: CardProps) {
  return (
    <section className={`rol-card-surface p-5 ${className}`}>
      {(title || subtitle || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--rol-border-subtle)] pb-3">
          <div>
            {title && (
              <h2 className="rol-heading-flourish text-lg font-semibold text-[var(--rol-ink-primary)]">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-0.5 text-sm text-[var(--rol-ink-secondary)]">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
