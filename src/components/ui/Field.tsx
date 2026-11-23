'use client';

import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
}

export function InputField({
  label,
  htmlFor,
  hint,
  error,
  className = '',
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-[var(--rol-ink-primary)]"
      >
        {label}
      </label>
      <input
        id={htmlFor}
        className={`w-full rounded-[var(--rol-radius-md)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-3 py-2 text-sm text-[var(--rol-ink-primary)] placeholder:text-[var(--rol-ink-muted)] focus:border-[var(--rol-accent-gold)] focus:outline-none focus:ring-2 focus:ring-[var(--rol-accent-gold-soft)] ${className}`}
        {...props}
      />
      {hint && !error && <p className="text-xs text-[var(--rol-ink-muted)]">{hint}</p>}
      {error && <p className="text-xs text-[var(--rol-status-danger-ink)]">{error}</p>}
    </div>
  );
}

export function SelectField({
  label,
  htmlFor,
  hint,
  error,
  children,
  className = '',
  ...props
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-[var(--rol-ink-primary)]"
      >
        {label}
      </label>
      <select
        id={htmlFor}
        className={`w-full rounded-[var(--rol-radius-md)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-3 py-2 text-sm text-[var(--rol-ink-primary)] focus:border-[var(--rol-accent-gold)] focus:outline-none focus:ring-2 focus:ring-[var(--rol-accent-gold-soft)] ${className}`}
        {...props}
      >
        {children}
      </select>
      {hint && !error && <p className="text-xs text-[var(--rol-ink-muted)]">{hint}</p>}
      {error && <p className="text-xs text-[var(--rol-status-danger-ink)]">{error}</p>}
    </div>
  );
}

export function TextareaField({
  label,
  htmlFor,
  hint,
  error,
  className = '',
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-[var(--rol-ink-primary)]"
      >
        {label}
      </label>
      <textarea
        id={htmlFor}
        className={`w-full rounded-[var(--rol-radius-md)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-3 py-2 text-sm text-[var(--rol-ink-primary)] placeholder:text-[var(--rol-ink-muted)] focus:border-[var(--rol-accent-gold)] focus:outline-none focus:ring-2 focus:ring-[var(--rol-accent-gold-soft)] ${className}`}
        {...props}
      />
      {hint && !error && <p className="text-xs text-[var(--rol-ink-muted)]">{hint}</p>}
      {error && <p className="text-xs text-[var(--rol-status-danger-ink)]">{error}</p>}
    </div>
  );
}
