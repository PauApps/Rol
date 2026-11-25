'use client';

import { CheckCircle2, Circle } from 'lucide-react';
import type { AbilityKey, ComputedSavingThrow, RollMode } from '@/domain/systems/dnd5e-2014';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { RollModeToggle } from '../RollModeToggle';
import { canEditSheetField, type SheetAccessContext } from '../sheet-permissions';
import { formatSigned } from '../types';

interface SavingThrowsCardProps {
  computedSavingThrows: ComputedSavingThrow[];
  draftProficient: AbilityKey[];
  draftRollModes: Partial<Record<AbilityKey, RollMode>>;
  draftOverrides: Partial<Record<AbilityKey, number>>;
  access: SheetAccessContext;
  onToggleProficient: (ability: AbilityKey) => void;
  onChangeRollMode: (ability: AbilityKey, mode: RollMode) => void;
  onChangeOverride: (ability: AbilityKey, value: number | null) => void;
}

export function SavingThrowsCard({
  computedSavingThrows,
  draftProficient,
  draftRollModes,
  draftOverrides,
  access,
  onToggleProficient,
  onChangeRollMode,
  onChangeOverride,
}: SavingThrowsCardProps) {
  const canEditProf = canEditSheetField('savingThrows.proficient', access);
  const canEditRollMode = canEditSheetField('savingThrows.rollModes', access);
  const canEditOverride = canEditSheetField('savingThrows.overrides', access);

  return (
    <Card
      title="Tirades de salvació"
      subtitle="Totes les sis salvacions, competències i mode de tirada."
    >
      <ul className="divide-y divide-[var(--rol-border-subtle)]/70">
        {computedSavingThrows.map((st) => {
          const isProficientDraft = draftProficient.includes(st.ability);
          const rollModeDraft = draftRollModes[st.ability] ?? st.rollMode;
          const overrideDraft = draftOverrides[st.ability];

          return (
            <li
              key={st.ability}
              className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                {canEditProf ? (
                  <button
                    type="button"
                    aria-pressed={isProficientDraft}
                    aria-label={`Competència en salvació de ${st.labelCa}`}
                    onClick={() => onToggleProficient(st.ability)}
                    className="rounded-full p-0.5 text-[var(--rol-accent-primary)] hover:bg-[var(--rol-bg-surface-alt)] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rol-accent-gold)]"
                  >
                    {isProficientDraft ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Circle className="h-4 w-4 text-[var(--rol-ink-muted)]" />
                    )}
                  </button>
                ) : (
                  <span
                    aria-label={
                      isProficientDraft ? `${st.labelCa}: competent` : `${st.labelCa}: no competent`
                    }
                    className="p-0.5 text-[var(--rol-accent-primary)]"
                  >
                    {isProficientDraft ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Circle className="h-4 w-4 text-[var(--rol-ink-muted)]" />
                    )}
                  </span>
                )}

                <span
                  className={`text-sm ${
                    isProficientDraft
                      ? 'font-semibold text-[var(--rol-ink-primary)]'
                      : 'text-[var(--rol-ink-secondary)]'
                  }`}
                >
                  {st.labelCa}
                </span>

                <span className="text-[11px] font-mono uppercase text-[var(--rol-ink-muted)]">
                  ({st.shortCa})
                </span>

                {st.override !== null && (
                  <Badge tone="warning" className="px-1.5 py-0 text-[10px]">
                    Override GM
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canEditOverride && (
                  <input
                    type="number"
                    min={-20}
                    max={40}
                    step={1}
                    placeholder="Auto"
                    aria-label={`Override GM salvació ${st.labelCa}`}
                    value={overrideDraft ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      if (!raw) {
                        onChangeOverride(st.ability, null);
                      } else {
                        const num = Math.trunc(Number(raw));
                        if (Number.isFinite(num)) {
                          onChangeOverride(st.ability, Math.min(40, Math.max(-20, num)));
                        }
                      }
                    }}
                    className="w-14 rounded-[var(--rol-radius-sm)] border border-[var(--rol-status-warning-border)] bg-[var(--rol-status-warning-bg)]/40 px-1.5 py-0.5 text-center font-mono text-xs text-[var(--rol-ink-primary)]"
                  />
                )}

                <span
                  className="min-w-[2.5rem] rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)] px-2 py-0.5 text-center font-mono text-sm font-bold text-[var(--rol-ink-primary)]"
                  aria-label={`Total salvació de ${st.labelCa}: ${formatSigned(st.total)}`}
                >
                  {formatSigned(st.total)}
                </span>

                <RollModeToggle
                  value={rollModeDraft}
                  disabled={!canEditRollMode}
                  label={`Salvació ${st.labelCa}`}
                  onChange={(next) => onChangeRollMode(st.ability, next)}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
