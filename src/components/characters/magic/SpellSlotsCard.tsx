'use client';

import { Flame, Sparkles } from 'lucide-react';
import {
  SPELL_SLOT_KEYS,
  type ComputedSpellcasting,
} from '@/domain/systems/dnd5e-2014';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { canEditSheetField, type SheetAccessContext } from '../sheet-permissions';

interface SpellSlotsCardProps {
  computedSpellcasting: ComputedSpellcasting | null;
  draftSlotsUsed: Record<string, number>;
  draftSlotOverrides: Record<string, number>;
  access: SheetAccessContext;
  onChangeSlotUsed: (slotKey: string, nextUsed: number) => void;
  onChangeSlotOverride: (slotKey: string, nextTotal: number | null) => void;
}

export function SpellSlotsCard({
  computedSpellcasting,
  draftSlotsUsed,
  draftSlotOverrides,
  access,
  onChangeSlotUsed,
  onChangeSlotOverride,
}: SpellSlotsCardProps) {
  const canEditUsed = canEditSheetField('spellSlotsUsed', access);
  const canEditOverrides = canEditSheetField('spellSlotOverrides', access);

  const regularSlots = computedSpellcasting?.slots ?? [];
  const pactMagic = computedSpellcasting?.pactMagic ?? null;

  return (
    <Card
      title="Espais de conjur"
      subtitle="Control d’espais regulars (1r–9è cercle) i Màgia de Pacte diferenciada."
    >
      <div className="space-y-4">
        {regularSlots.length === 0 && !pactMagic && (
          <p className="text-sm text-[var(--rol-ink-muted)]">
            No hi ha espais de conjur disponibles per a aquest nivell o classe.
          </p>
        )}

        {/* Espais regulars 1..9 */}
        {regularSlots.length > 0 && (
          <div className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
              <Sparkles className="h-3.5 w-3.5 text-[var(--rol-accent-gold)]" />
              Espais regulars de conjur
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {regularSlots.map((slot) => {
                const key = String(slot.level);
                const draftUsed = Math.min(slot.total, Math.max(0, draftSlotsUsed[key] ?? slot.used));
                const isDirty = draftUsed !== slot.used;

                return (
                  <div
                    key={key}
                    className={`rounded-[var(--rol-radius-md)] border p-3 space-y-2 ${
                      isDirty
                        ? 'border-[var(--rol-accent-gold)] bg-[var(--rol-bg-surface)]'
                        : 'border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/35'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-[var(--rol-ink-primary)]">
                        Cercle {slot.level}
                      </span>
                      <span className="text-xs font-mono text-[var(--rol-ink-secondary)]">
                        Disp: <strong>{slot.available}</strong> / Tot: <strong>{slot.total}</strong>
                      </span>
                    </div>

                    {slot.total > 0 && (
                      <div
                        className="flex flex-wrap items-center gap-1.5"
                        role="group"
                        aria-label={`Espais gastats de cercle ${slot.level}`}
                      >
                        {Array.from({ length: slot.total }, (_, idx) => {
                          const step = idx + 1;
                          const spent = draftUsed >= step;
                          const nextVal = draftUsed === step ? step - 1 : step;
                          return (
                            <button
                              key={step}
                              type="button"
                              disabled={!canEditUsed}
                              aria-pressed={spent}
                              aria-label={`Cercle ${slot.level}: marcar ${step} de ${slot.total} espais gastats`}
                              onClick={() => onChangeSlotUsed(key, nextVal)}
                              className={`h-6 w-6 rounded border text-[11px] font-mono font-bold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--rol-accent-gold)] ${
                                spent
                                  ? 'border-[var(--rol-accent-primary)] bg-[var(--rol-accent-primary)] text-[var(--rol-accent-primary-ink)]'
                                  : 'border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] text-[var(--rol-ink-muted)] hover:border-[var(--rol-accent-primary)]'
                              }`}
                            >
                              {spent ? '×' : step}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <p className="text-[11px] text-[var(--rol-ink-muted)]">
                      Gastats: {draftUsed}
                      {isDirty ? ' (pendent de desar)' : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Màgia de Pacte separada explícitament */}
        {pactMagic && (
          <div className="rounded-[var(--rol-radius-md)] border border-[var(--rol-status-warning-border)] bg-[var(--rol-status-warning-bg)]/40 p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-[var(--rol-accent-primary)]" />
                <span className="font-semibold text-sm text-[var(--rol-ink-primary)]">
                  Màgia de Pacte (Bruixot de pacte)
                </span>
                <Badge tone="warning">Cercle {pactMagic.slotLevel}</Badge>
              </div>
              <span className="text-xs font-mono text-[var(--rol-ink-secondary)]">
                Disp: <strong>{pactMagic.available}</strong> / Tot: <strong>{pactMagic.count}</strong>
              </span>
            </div>

            {(() => {
              const draftPactUsed = Math.min(
                pactMagic.count,
                Math.max(0, draftSlotsUsed.pact ?? pactMagic.used)
              );
              const isDirty = draftPactUsed !== pactMagic.used;

              return (
                <>
                  <div
                    className="flex flex-wrap items-center gap-2"
                    role="group"
                    aria-label="Espais de Màgia de Pacte gastats"
                  >
                    {Array.from({ length: pactMagic.count }, (_, idx) => {
                      const step = idx + 1;
                      const spent = draftPactUsed >= step;
                      const nextVal = draftPactUsed === step ? step - 1 : step;
                      return (
                        <button
                          key={step}
                          type="button"
                          disabled={!canEditUsed}
                          aria-pressed={spent}
                          aria-label={`Màgia de Pacte: marcar ${step} de ${pactMagic.count} espais gastats`}
                          onClick={() => onChangeSlotUsed('pact', nextVal)}
                          className={`h-7 min-w-[2.25rem] rounded border px-2 font-mono text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--rol-accent-gold)] ${
                            spent
                              ? 'border-[var(--rol-accent-primary)] bg-[var(--rol-accent-primary)] text-[var(--rol-accent-primary-ink)]'
                              : 'border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] text-[var(--rol-ink-primary)]'
                          }`}
                        >
                          {spent ? 'Gastat' : `Pacte ${step}`}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-[var(--rol-ink-secondary)]">
                    Gastats: {draftPactUsed} (es recuperen en descans curt al 3C.4)
                    {isDirty ? ' · pendent de desar' : ''}
                  </p>
                </>
              );
            })()}
          </div>
        )}

        {/* Overrides d'espais protegits (només GM o jugador autoritzat) */}
        {canEditOverrides && (
          <div className="rounded-[var(--rol-radius-md)] border border-[var(--rol-status-warning-border)] bg-[var(--rol-status-warning-bg)]/30 p-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--rol-status-warning-ink)]">
              Overrides de nombre total d’espais (GM / autoritzat)
            </p>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
              {SPELL_SLOT_KEYS.map((key) => (
                <div key={key}>
                  <label htmlFor={`slot-override-${key}`} className="mb-0.5 block text-[10px] font-medium">
                    {key === 'pact' ? 'Pacte' : `Niv. ${key}`}
                  </label>
                  <input
                    id={`slot-override-${key}`}
                    type="number"
                    min={0}
                    max={20}
                    placeholder="Auto"
                    value={draftSlotOverrides[key] ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      if (!raw) {
                        onChangeSlotOverride(key, null);
                      } else {
                        const n = Math.trunc(Number(raw));
                        if (Number.isFinite(n)) {
                          onChangeSlotOverride(key, Math.min(20, Math.max(0, n)));
                        }
                      }
                    }}
                    className="w-full rounded border border-[var(--rol-status-warning-border)] bg-[var(--rol-bg-surface)] px-1 py-0.5 text-center font-mono text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
