'use client';

import { BookMarked, Sparkles, Wand2 } from 'lucide-react';
import {
  ABILITY_KEYS,
  ABILITY_LABELS_CA,
  type AbilityKey,
  type ComputedSpellcasting,
  type Dnd5e2014ClassEntry,
  type Dnd5e2014SpellcastingSourceOverride,
} from '@/domain/systems/dnd5e-2014';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { canEditSheetField, type SheetAccessContext } from '../sheet-permissions';
import { formatSigned, SPELL_MODEL_LABELS_CA, type CharacterSheetDraft } from '../types';

interface SpellcastingSummaryCardProps {
  computedSpellcasting: ComputedSpellcasting | null;
  classes: readonly Dnd5e2014ClassEntry[];
  draftSpellcasting: CharacterSheetDraft['spellcasting'];
  access: SheetAccessContext;
  onChangeSpellcasting: (patch: Partial<CharacterSheetDraft['spellcasting']>) => void;
}

function parseOptionalInt(raw: string, min: number, max: number): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Math.trunc(Number(trimmed));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

export function SpellcastingSummaryCard({
  computedSpellcasting,
  classes,
  draftSpellcasting,
  access,
  onChangeSpellcasting,
}: SpellcastingSummaryCardProps) {
  const canUsesSpellbook = canEditSheetField('spellcasting.usesSpellbook', access);
  const canNotes = canEditSheetField('spellcasting.notes', access);
  const canGlobalAbility = canEditSheetField('spellcasting.abilityOverride', access);
  const canGlobalDc = canEditSheetField('spellcasting.saveDcOverride', access);
  const canGlobalAtk = canEditSheetField('spellcasting.attackBonusOverride', access);
  const canSourceOverrides = canEditSheetField('spellcasting.sourceOverrides', access);
  const hasAnyOverridePermission =
    canGlobalAbility || canGlobalDc || canGlobalAtk || canSourceOverrides;

  function updateSourceOverride(
    classId: string,
    patch: Partial<Dnd5e2014SpellcastingSourceOverride>
  ) {
    const prev = draftSpellcasting.sourceOverrides[classId] ?? {};
    const nextEntry: Dnd5e2014SpellcastingSourceOverride = {
      ...prev,
      ...patch,
    };
    const nextMap = { ...draftSpellcasting.sourceOverrides };
    if (
      (nextEntry.abilityOverride ?? null) === null &&
      (nextEntry.saveDcOverride ?? null) === null &&
      (nextEntry.attackBonusOverride ?? null) === null
    ) {
      delete nextMap[classId];
    } else {
      nextMap[classId] = nextEntry;
    }
    onChangeSpellcasting({ sourceOverrides: nextMap });
  }

  return (
    <Card
      title="Conjuració i fonts màgiques"
      subtitle="Aptitud màgica, CD de salvació i atac de conjur calculats pel motor D&D 5e."
      actions={
        computedSpellcasting ? (
          <Badge tone="gold">
            <Sparkles className="h-3 w-3" />
            Nivell de llançador {computedSpellcasting.effectiveCasterLevel}
          </Badge>
        ) : (
          <Badge tone="neutral">Sense màgia activa</Badge>
        )
      }
    >
      <div className="space-y-4">
        {!computedSpellcasting ? (
          <p className="text-sm text-[var(--rol-ink-secondary)]">
            Aquest personatge no té cap classe o subclasse amb capacitat de conjuració activa
            actualment ni conjurs registrats.
          </p>
        ) : (
          <>
            {/* Resum general de conjuració */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="rol-stat-plaque p-2.5">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
                  Aptitud principal
                </span>
                <span className="rol-heading-flourish mt-0.5 block text-base font-bold text-[var(--rol-ink-primary)]">
                  {computedSpellcasting.abilityLabelCa ?? '—'}
                </span>
              </div>

              <div className="rol-stat-plaque p-2.5">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
                  CD de conjurs
                </span>
                <span className="rol-heading-flourish mt-0.5 block text-lg font-bold text-[var(--rol-accent-primary)]">
                  {computedSpellcasting.saveDc ?? '—'}
                </span>
              </div>

              <div className="rol-stat-plaque p-2.5">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
                  Atac de conjur
                </span>
                <span className="rol-heading-flourish mt-0.5 block text-lg font-bold text-[var(--rol-ink-primary)]">
                  {formatSigned(computedSpellcasting.attackBonus)}
                </span>
              </div>

              <div className="rol-stat-plaque p-2.5">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
                  Nivell de llançador
                </span>
                <span className="rol-heading-flourish mt-0.5 block text-lg font-bold text-[var(--rol-ink-primary)]">
                  {computedSpellcasting.effectiveCasterLevel}
                </span>
              </div>
            </div>

            {/* Desglossament per classe / font (multiclasse separat) */}
            {computedSpellcasting.sources.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
                  <Wand2 className="h-3.5 w-3.5 text-[var(--rol-accent-primary)]" />
                  Fonts de conjuració per classe ({computedSpellcasting.sources.length})
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {computedSpellcasting.sources.map((src) => {
                    const srcOverride = draftSpellcasting.sourceOverrides[src.classId];
                    return (
                      <div
                        key={src.classId}
                        className="rounded-[var(--rol-radius-md)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface-alt)]/35 p-3 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-semibold text-sm text-[var(--rol-ink-primary)]">
                              {src.classLabelCa} {src.classLevel}
                            </span>
                            {src.subclassLabelCa && (
                              <span className="ml-1.5 text-xs text-[var(--rol-ink-secondary)]">
                                ({src.subclassLabelCa})
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge tone={src.progression === 'pact' ? 'warning' : 'gold'}>
                              {SPELL_MODEL_LABELS_CA[src.model]}
                            </Badge>
                            {src.usesSpellbook && (
                              <Badge tone="neutral">
                                <BookMarked className="h-3 w-3" />
                                Grimori ({src.spellbookCount})
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="rounded bg-[var(--rol-bg-surface)] px-2 py-1 border border-[var(--rol-border-subtle)]">
                            <span className="block text-[10px] text-[var(--rol-ink-muted)]">
                              Aptitud
                            </span>
                            <span className="font-semibold">{src.abilityLabelCa ?? '—'}</span>
                          </div>
                          <div className="rounded bg-[var(--rol-bg-surface)] px-2 py-1 border border-[var(--rol-border-subtle)]">
                            <span className="block text-[10px] text-[var(--rol-ink-muted)]">CD</span>
                            <span className="font-mono font-bold text-[var(--rol-accent-primary)]">
                              {src.saveDc ?? '—'}
                            </span>
                          </div>
                          <div className="rounded bg-[var(--rol-bg-surface)] px-2 py-1 border border-[var(--rol-border-subtle)]">
                            <span className="block text-[10px] text-[var(--rol-ink-muted)]">
                              Atac
                            </span>
                            <span className="font-mono font-bold">
                              {formatSigned(src.attackBonus)}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--rol-ink-secondary)]">
                          <span>Cercle màxim de classe: {src.maxClassSpellLevel}</span>
                          {src.preparedLimit !== null && (
                            <span
                              className={
                                src.exceedsPreparedLimit
                                  ? 'font-semibold text-[var(--rol-status-danger-ink)]'
                                  : src.preparedCount >= src.preparedLimit
                                    ? 'font-semibold text-[var(--rol-status-warning-ink)]'
                                    : ''
                              }
                            >
                              Preparats: {src.preparedCount} / {src.preparedLimit}
                              {src.alwaysPreparedCount > 0 &&
                                ` (+${src.alwaysPreparedCount} sempre prep.)`}
                            </span>
                          )}
                          {src.preparedLimit === null && src.knownCount > 0 && (
                            <span>Coneguts: {src.knownCount}</span>
                          )}
                        </div>

                        {canSourceOverrides && (
                          <div className="grid grid-cols-3 gap-2 border-t border-[var(--rol-border-subtle)] pt-2 text-[11px]">
                            <div>
                              <label
                                htmlFor={`sc-src-ability-${src.classId}`}
                                className="mb-0.5 block text-[var(--rol-status-warning-ink)]"
                              >
                                Aptitud (GM)
                              </label>
                              <select
                                id={`sc-src-ability-${src.classId}`}
                                value={srcOverride?.abilityOverride ?? ''}
                                onChange={(e) =>
                                  updateSourceOverride(src.classId, {
                                    abilityOverride: e.target.value
                                      ? (e.target.value as AbilityKey)
                                      : null,
                                  })
                                }
                                className="w-full rounded border border-[var(--rol-status-warning-border)] bg-[var(--rol-status-warning-bg)]/35 px-1.5 py-0.5 text-xs"
                              >
                                <option value="">Auto</option>
                                {ABILITY_KEYS.map((k) => (
                                  <option key={k} value={k}>
                                    {ABILITY_LABELS_CA[k]}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label
                                htmlFor={`sc-src-dc-${src.classId}`}
                                className="mb-0.5 block text-[var(--rol-status-warning-ink)]"
                              >
                                CD (GM)
                              </label>
                              <input
                                id={`sc-src-dc-${src.classId}`}
                                type="number"
                                min={1}
                                max={40}
                                placeholder="Auto"
                                value={srcOverride?.saveDcOverride ?? ''}
                                onChange={(e) =>
                                  updateSourceOverride(src.classId, {
                                    saveDcOverride: parseOptionalInt(e.target.value, 1, 40),
                                  })
                                }
                                className="w-full rounded border border-[var(--rol-status-warning-border)] bg-[var(--rol-status-warning-bg)]/35 px-1.5 py-0.5 font-mono text-xs"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor={`sc-src-atk-${src.classId}`}
                                className="mb-0.5 block text-[var(--rol-status-warning-ink)]"
                              >
                                Atac (GM)
                              </label>
                              <input
                                id={`sc-src-atk-${src.classId}`}
                                type="number"
                                min={-20}
                                max={40}
                                placeholder="Auto"
                                value={srcOverride?.attackBonusOverride ?? ''}
                                onChange={(e) =>
                                  updateSourceOverride(src.classId, {
                                    attackBonusOverride: parseOptionalInt(e.target.value, -20, 40),
                                  })
                                }
                                className="w-full rounded border border-[var(--rol-status-warning-border)] bg-[var(--rol-status-warning-bg)]/35 px-1.5 py-0.5 font-mono text-xs"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {computedSpellcasting.specialSpellsCount > 0 && (
              <p className="text-xs text-[var(--rol-ink-muted)]">
                Inclou {computedSpellcasting.specialSpellsCount} conjur(s) d’origen especial (raça,
                dot o objecte màgic) que no consumeixen el límit de preparats de classe.
              </p>
            )}
          </>
        )}

        {/* Opcions editables permeses i notes de conjuració */}
        {(canUsesSpellbook || canNotes || hasAnyOverridePermission) && (
          <div className="space-y-3 border-t border-[var(--rol-border-subtle)] pt-3">
            {canUsesSpellbook && (
              <label className="inline-flex items-center gap-2 text-xs text-[var(--rol-ink-primary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={draftSpellcasting.usesSpellbook}
                  onChange={(e) => onChangeSpellcasting({ usesSpellbook: e.target.checked })}
                />
                <span>Utilitza grimori (marca aquesta opció si manté llibre de conjurs)</span>
              </label>
            )}

            {canNotes && (
              <div>
                <label
                  htmlFor="spellcasting-notes"
                  className="mb-1 block text-xs font-medium text-[var(--rol-ink-secondary)]"
                >
                  Notes de conjuració
                </label>
                <textarea
                  id="spellcasting-notes"
                  rows={2}
                  maxLength={4000}
                  value={draftSpellcasting.notes}
                  onChange={(e) => onChangeSpellcasting({ notes: e.target.value })}
                  placeholder="Focus arcà, símbol sagrat, components cars o observacions…"
                  className="w-full rounded-[var(--rol-radius-md)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-3 py-1.5 text-xs text-[var(--rol-ink-primary)]"
                />
              </div>
            )}

            {(canGlobalAbility || canGlobalDc || canGlobalAtk) && (
              <div className="rounded-[var(--rol-radius-md)] border border-[var(--rol-status-warning-border)] bg-[var(--rol-status-warning-bg)]/35 p-3 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--rol-status-warning-ink)]">
                  Overrides globals de conjuració (autoritzats pel GM
                  {classes.length > 1 ? ' · preferir overrides per classe en multiclasse' : ''})
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {canGlobalAbility && (
                    <div>
                      <label htmlFor="sc-global-ability" className="mb-1 block text-xs">
                        Aptitud global
                      </label>
                      <select
                        id="sc-global-ability"
                        value={draftSpellcasting.abilityOverride ?? ''}
                        onChange={(e) =>
                          onChangeSpellcasting({
                            abilityOverride: e.target.value ? (e.target.value as AbilityKey) : null,
                          })
                        }
                        className="w-full rounded border border-[var(--rol-status-warning-border)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs"
                      >
                        <option value="">Oficial automàtica</option>
                        {ABILITY_KEYS.map((k) => (
                          <option key={k} value={k}>
                            {ABILITY_LABELS_CA[k]}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {canGlobalDc && (
                    <div>
                      <label htmlFor="sc-global-dc" className="mb-1 block text-xs">
                        CD global
                      </label>
                      <input
                        id="sc-global-dc"
                        type="number"
                        min={1}
                        max={40}
                        placeholder="Auto"
                        value={draftSpellcasting.saveDcOverride ?? ''}
                        onChange={(e) =>
                          onChangeSpellcasting({
                            saveDcOverride: parseOptionalInt(e.target.value, 1, 40),
                          })
                        }
                        className="w-full rounded border border-[var(--rol-status-warning-border)] bg-[var(--rol-bg-surface)] px-2 py-1 font-mono text-xs"
                      />
                    </div>
                  )}
                  {canGlobalAtk && (
                    <div>
                      <label htmlFor="sc-global-atk" className="mb-1 block text-xs">
                        Atac màgic global
                      </label>
                      <input
                        id="sc-global-atk"
                        type="number"
                        min={-20}
                        max={40}
                        placeholder="Auto"
                        value={draftSpellcasting.attackBonusOverride ?? ''}
                        onChange={(e) =>
                          onChangeSpellcasting({
                            attackBonusOverride: parseOptionalInt(e.target.value, -20, 40),
                          })
                        }
                        className="w-full rounded border border-[var(--rol-status-warning-border)] bg-[var(--rol-bg-surface)] px-2 py-1 font-mono text-xs"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
