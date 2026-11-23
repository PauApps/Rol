'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, description, children }: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-lg rounded-[var(--rol-radius-lg)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] p-6"
        style={{ boxShadow: 'var(--rol-shadow-modal)' }}
      >
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-[var(--rol-border-subtle)] pb-3">
          <div>
            <h3 className="rol-heading-flourish text-xl font-semibold text-[var(--rol-ink-primary)]">
              {title}
            </h3>
            {description && (
              <p className="mt-1 text-sm text-[var(--rol-ink-secondary)]">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tancar"
            className="rounded-md p-1.5 text-[var(--rol-ink-muted)] hover:bg-[var(--rol-bg-surface-alt)] hover:text-[var(--rol-ink-primary)] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
