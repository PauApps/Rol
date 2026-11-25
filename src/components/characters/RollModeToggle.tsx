'use client';

import type { RollMode } from '@/domain/systems/dnd5e-2014';

interface RollModeToggleProps {
  value: RollMode;
  onChange: (next: RollMode) => void;
  disabled?: boolean;
  label: string;
}

const MODES: ReadonlyArray<{
  value: RollMode;
  short: string;
  title: string;
  activeClass: string;
}> = [
  {
    value: 'disadvantage',
    short: 'Des',
    title: 'Desavantatge',
    activeClass:
      'bg-[var(--rol-status-danger-bg)] text-[var(--rol-status-danger-ink)] border-[var(--rol-status-danger-border)] font-semibold',
  },
  {
    value: 'normal',
    short: 'Norm',
    title: 'Normal',
    activeClass:
      'bg-[var(--rol-bg-surface)] text-[var(--rol-ink-primary)] border-[var(--rol-border-strong)] font-semibold shadow-xs',
  },
  {
    value: 'advantage',
    short: 'Ava',
    title: 'Avantatge',
    activeClass:
      'bg-[var(--rol-status-success-bg)] text-[var(--rol-status-success-ink)] border-[var(--rol-status-success-border)] font-semibold',
  },
];

export function RollModeToggle({
  value,
  onChange,
  disabled = false,
  label,
}: RollModeToggleProps) {
  return (
    <div
      role="group"
      aria-label={`Mode de tirada per a ${label}`}
      className="inline-flex shrink-0 items-center rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/70 p-0.5"
    >
      {MODES.map((mode) => {
        const active = value === mode.value;
        return (
          <button
            key={mode.value}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            aria-label={`${label}: ${mode.title}`}
            title={mode.title}
            onClick={() => onChange(mode.value)}
            className={`rounded-[calc(var(--rol-radius-sm)-2px)] border px-1.5 py-0.5 text-[11px] leading-tight transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-65 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--rol-accent-gold)] ${
              active
                ? mode.activeClass
                : 'border-transparent text-[var(--rol-ink-muted)] hover:text-[var(--rol-ink-primary)]'
            }`}
          >
            {mode.short}
          </button>
        );
      })}
    </div>
  );
}
