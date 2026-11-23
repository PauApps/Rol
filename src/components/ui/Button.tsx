'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--rol-accent-primary)] text-[var(--rol-accent-primary-ink)] hover:bg-[var(--rol-accent-primary-hover)] border border-transparent shadow-sm',
  secondary:
    'bg-[var(--rol-bg-surface-alt)] text-[var(--rol-ink-primary)] hover:bg-[var(--rol-border-subtle)] border border-[var(--rol-border-strong)]',
  ghost:
    'bg-transparent text-[var(--rol-ink-secondary)] hover:bg-[var(--rol-bg-surface-alt)] border border-transparent',
  danger:
    'bg-[var(--rol-status-danger-bg)] text-[var(--rol-status-danger-ink)] hover:opacity-90 border border-[var(--rol-status-danger-border)]',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--rol-radius-md)] font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rol-accent-gold)] ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
