'use client';

import { ABILITY_KEYS, type AbilityKey, type ComputedDnd5e2014Snapshot, type Dnd5e2014AbilityScores } from '@/domain/systems/dnd5e-2014';
import { Card } from '@/components/ui/Card';
import { canEditSheetField, type SheetAccessContext } from '../sheet-permissions';
import { formatSigned } from '../types';

interface AbilityScoresGridProps {
  computedAbilities: ComputedDnd5e2014Snapshot['abilities'];
  savedAbilities: Dnd5e2014AbilityScores;
  draftAbilities: Dnd5e2014AbilityScores;
  access: SheetAccessContext;
  onChangeScore: (key: AbilityKey, nextScore: number | null) => void;
}

function parseAbilityInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(30, Math.max(1, Math.trunc(parsed)));
}

export function AbilityScoresGrid({
  computedAbilities,
  savedAbilities,
  draftAbilities,
  access,
  onChangeScore,
}: AbilityScoresGridProps) {
  return (
    <Card
      title="Característiques"
      subtitle="Puntuacions base (1–30) i modificadors oficials calculats al servidor."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {ABILITY_KEYS.map((key) => {
          const meta = computedAbilities[key];
          const editable = canEditSheetField(`abilities.${key}`, access);
          const draftScore = draftAbilities[key];
          const savedScore = savedAbilities[key];
          const isDirty = draftScore !== savedScore;
          const inputId = `ability-score-${key}`;

          return (
            <div
              key={key}
              className={`rol-stat-plaque flex flex-col items-center justify-between p-3 text-center ${
                isDirty ? 'ring-1 ring-[var(--rol-accent-gold)]' : ''
              }`}
            >
              <div className="w-full">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--rol-accent-primary)]">
                  {meta.shortCa}
                </span>
                <label
                  htmlFor={inputId}
                  className="block truncate text-xs font-medium text-[var(--rol-ink-secondary)]"
                >
                  {meta.labelCa}
                </label>
              </div>

              <p
                className="rol-heading-flourish my-2 text-2xl font-bold text-[var(--rol-ink-primary)]"
                aria-label={`Modificador de ${meta.labelCa}: ${formatSigned(meta.modifier)}`}
              >
                {formatSigned(meta.modifier)}
              </p>

              <div className="w-full">
                {editable ? (
                  <input
                    id={inputId}
                    type="number"
                    min={1}
                    max={30}
                    step={1}
                    value={draftScore ?? ''}
                    placeholder="—"
                    onChange={(e) => onChangeScore(key, parseAbilityInput(e.target.value))}
                    aria-label={`Puntuació base de ${meta.labelCa}`}
                    className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface-alt)]/60 px-2 py-1 text-center font-mono text-sm font-semibold text-[var(--rol-ink-primary)] focus:border-[var(--rol-accent-gold)] focus:outline-none focus:ring-2 focus:ring-[var(--rol-accent-gold-soft)]"
                  />
                ) : (
                  <div
                    id={inputId}
                    className="rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/40 px-2 py-1 font-mono text-sm font-semibold text-[var(--rol-ink-primary)]"
                  >
                    {draftScore ?? '—'}
                  </div>
                )}
                {isDirty && (
                  <span className="mt-1 block text-[10px] font-medium text-[var(--rol-status-warning-ink)]">
                    Desa per recalcular
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
