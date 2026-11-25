'use client';

import { AlertTriangle, Footprints, Heart, Shield, Skull, Zap } from 'lucide-react';
import type { ComputedDnd5e2014Snapshot, HitDieKey } from '@/domain/systems/dnd5e-2014';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { canEditSheetField, type SheetAccessContext } from '../sheet-permissions';
import { formatSigned, type CharacterSheetDraft } from '../types';

interface CombatVitalsCardProps {
  computed: ComputedDnd5e2014Snapshot;
  draft: CharacterSheetDraft;
  access: SheetAccessContext;
  onChangeHp: (field: 'current' | 'max' | 'temporary', value: number | null) => void;
  onChangeDeathSave: (kind: 'successes' | 'failures', count: number) => void;
  onChangeHitDieSpent: (dieKey: HitDieKey, spent: number) => void;
  onChangeLegacyHitDiceUsed: (spent: number) => void;
  onChangeSpeed: (field: 'walk' | 'fly' | 'swim' | 'climb', value: number | null) => void;
  onChangeArmorClass: (patch: Partial<CharacterSheetDraft['armorClass']>) => void;
  onChangeInitiative: (patch: Partial<CharacterSheetDraft['initiative']>) => void;
}

function parseOptionalInt(raw: string, min: number, max: number): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Math.trunc(Number(trimmed));
  if (!Number.isFinite(parsed)) return null;
  return Math.min(max, Math.max(min, parsed));
}

export function CombatVitalsCard({
  computed,
  draft,
  access,
  onChangeHp,
  onChangeDeathSave,
  onChangeHitDieSpent,
  onChangeLegacyHitDiceUsed,
  onChangeSpeed,
  onChangeArmorClass,
  onChangeInitiative,
}: CombatVitalsCardProps) {
  const canHpCurrent = canEditSheetField('hitPoints.current', access);
  const canHpMax = canEditSheetField('hitPoints.max', access);
  const canHpTemp = canEditSheetField('hitPoints.temporary', access);
  const canDeathSaves = canEditSheetField('hitPoints.deathSaves', access);
  const canHitDiceByDie =
    canEditSheetField('hitPoints.hitDiceUsedByDie', access) &&
    canEditSheetField('hitPoints.hitDiceUsed', access);
  const canHitDiceScalar = canEditSheetField('hitPoints.hitDiceUsed', access);

  const canAcFormula = canEditSheetField('armorClass.unarmoredFormula', access);
  const canAcNotes = canEditSheetField('armorClass.notes', access);
  const canAcOverride = canEditSheetField('armorClass.override', access);

  const canInitBonus = canEditSheetField('initiative.bonus', access);
  const canInitOverride = canEditSheetField('initiative.override', access);

  const hpPool = computed.combat.hitDicePool;
  const maxHp = draft.hitPoints.max ?? 0;
  const currentHp = draft.hitPoints.current ?? 0;
  const hpPercent = maxHp > 0 ? Math.min(100, Math.max(0, Math.round((currentHp / maxHp) * 100))) : 0;

  return (
    <Card
      title="Combat i vitalitat"
      subtitle="Punts de cop, defensa, velocitat, daus de cop i salvacions contra la mort."
    >
      <div className="space-y-5">
        {/* 1. Punts de cop */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--rol-ink-primary)]">
              <Heart className="h-4 w-4 text-[var(--rol-accent-primary)]" />
              Punts de cop
            </h3>
            {maxHp > 0 && (
              <span className="font-mono text-xs text-[var(--rol-ink-muted)]">{hpPercent}%</span>
            )}
          </div>

          {maxHp > 0 && (
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--rol-bg-surface-alt)] border border-[var(--rol-border-subtle)]">
              <div
                className="h-full bg-[var(--rol-accent-primary)] transition-all"
                style={{ width: `${hpPercent}%` }}
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label
                htmlFor="hp-current"
                className="mb-1 block text-xs font-medium text-[var(--rol-ink-secondary)]"
              >
                Actuals
              </label>
              <input
                id="hp-current"
                type="number"
                min={0}
                max={9999}
                disabled={!canHpCurrent}
                value={draft.hitPoints.current ?? ''}
                placeholder="—"
                onChange={(e) => onChangeHp('current', parseOptionalInt(e.target.value, 0, 9999))}
                className="w-full rounded-[var(--rol-radius-md)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2.5 py-1.5 text-center font-mono text-sm font-bold text-[var(--rol-ink-primary)] disabled:bg-[var(--rol-bg-surface-alt)]/50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label
                htmlFor="hp-max"
                className="mb-1 block text-xs font-medium text-[var(--rol-ink-secondary)]"
              >
                Màxims
              </label>
              <input
                id="hp-max"
                type="number"
                min={0}
                max={9999}
                disabled={!canHpMax}
                value={draft.hitPoints.max ?? ''}
                placeholder="—"
                onChange={(e) => onChangeHp('max', parseOptionalInt(e.target.value, 0, 9999))}
                className="w-full rounded-[var(--rol-radius-md)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2.5 py-1.5 text-center font-mono text-sm font-bold text-[var(--rol-ink-primary)] disabled:bg-[var(--rol-bg-surface-alt)]/50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label
                htmlFor="hp-temp"
                className="mb-1 block text-xs font-medium text-[var(--rol-ink-secondary)]"
              >
                Temporals
              </label>
              <input
                id="hp-temp"
                type="number"
                min={0}
                max={9999}
                disabled={!canHpTemp}
                value={draft.hitPoints.temporary ?? ''}
                placeholder="0"
                onChange={(e) => onChangeHp('temporary', parseOptionalInt(e.target.value, 0, 9999))}
                className="w-full rounded-[var(--rol-radius-md)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2.5 py-1.5 text-center font-mono text-sm font-bold text-[var(--rol-ink-primary)] disabled:bg-[var(--rol-bg-surface-alt)]/50 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* 2. Classe d'armadura i Iniciativa */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rol-stat-plaque p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
                <Shield className="h-3.5 w-3.5 text-[var(--rol-accent-gold)]" />
                Classe d’armadura
              </span>
              <span className="rol-heading-flourish text-xl font-bold text-[var(--rol-ink-primary)]">
                {computed.combat.armorClass.value}
              </span>
            </div>
            <p className="text-xs text-[var(--rol-ink-secondary)]">
              {computed.combat.armorClass.sourceDescription}
            </p>
            {canAcFormula && (
              <div>
                <label
                  htmlFor="ac-unarmored-formula"
                  className="mb-1 block text-[11px] font-medium text-[var(--rol-ink-muted)]"
                >
                  Fórmula sense armadura
                </label>
                <select
                  id="ac-unarmored-formula"
                  value={draft.armorClass.unarmoredFormula}
                  onChange={(e) =>
                    onChangeArmorClass({
                      unarmoredFormula: e.target.value as 'none' | 'barbarian' | 'monk',
                    })
                  }
                  className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs text-[var(--rol-ink-primary)]"
                >
                  <option value="none">Estàndard (10 + DES)</option>
                  <option value="barbarian">Bàrbar (10 + DES + CON)</option>
                  <option value="monk">Monjo (10 + DES + SAV)</option>
                </select>
              </div>
            )}
            {canAcNotes && (
              <div>
                <label
                  htmlFor="ac-notes"
                  className="mb-1 block text-[11px] font-medium text-[var(--rol-ink-muted)]"
                >
                  Notes de CA
                </label>
                <input
                  id="ac-notes"
                  type="text"
                  maxLength={1000}
                  value={draft.armorClass.notes}
                  onChange={(e) => onChangeArmorClass({ notes: e.target.value })}
                  placeholder="Escut, anell de protecció…"
                  className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs text-[var(--rol-ink-primary)]"
                />
              </div>
            )}
            {canAcOverride && (
              <div>
                <label
                  htmlFor="ac-override"
                  className="mb-1 block text-[11px] font-medium text-[var(--rol-status-warning-ink)]"
                >
                  Override GM de CA
                </label>
                <input
                  id="ac-override"
                  type="number"
                  min={0}
                  max={50}
                  placeholder="Auto"
                  value={draft.armorClass.override ?? ''}
                  onChange={(e) =>
                    onChangeArmorClass({ override: parseOptionalInt(e.target.value, 0, 50) })
                  }
                  className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-status-warning-border)] bg-[var(--rol-status-warning-bg)]/40 px-2 py-1 font-mono text-xs text-[var(--rol-ink-primary)]"
                />
              </div>
            )}
          </div>

          <div className="rol-stat-plaque p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
                <Zap className="h-3.5 w-3.5 text-[var(--rol-accent-gold)]" />
                Iniciativa
              </span>
              <span className="rol-heading-flourish text-xl font-bold text-[var(--rol-ink-primary)]">
                {formatSigned(computed.combat.initiative)}
              </span>
            </div>
            <p className="text-xs text-[var(--rol-ink-secondary)]">
              Basada en Destresa ({formatSigned(computed.abilities.dex.modifier)})
              {draft.initiative.bonus !== 0 ? ` + bo fix (${formatSigned(draft.initiative.bonus)})` : ''}.
            </p>
            {(canInitBonus || canInitOverride) && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                {canInitBonus && (
                  <div>
                    <label
                      htmlFor="init-bonus"
                      className="mb-1 block text-[11px] font-medium text-[var(--rol-status-warning-ink)]"
                    >
                      Bonif. fix (GM)
                    </label>
                    <input
                      id="init-bonus"
                      type="number"
                      min={-20}
                      max={40}
                      value={draft.initiative.bonus}
                      onChange={(e) =>
                        onChangeInitiative({
                          bonus: parseOptionalInt(e.target.value, -20, 40) ?? 0,
                        })
                      }
                      className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-status-warning-border)] bg-[var(--rol-status-warning-bg)]/40 px-2 py-1 font-mono text-xs"
                    />
                  </div>
                )}
                {canInitOverride && (
                  <div>
                    <label
                      htmlFor="init-override"
                      className="mb-1 block text-[11px] font-medium text-[var(--rol-status-warning-ink)]"
                    >
                      Override (GM)
                    </label>
                    <input
                      id="init-override"
                      type="number"
                      min={-20}
                      max={40}
                      placeholder="Auto"
                      value={draft.initiative.override ?? ''}
                      onChange={(e) =>
                        onChangeInitiative({
                          override: parseOptionalInt(e.target.value, -20, 40),
                        })
                      }
                      className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-status-warning-border)] bg-[var(--rol-status-warning-bg)]/40 px-2 py-1 font-mono text-xs"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 3. Velocitats */}
        <div className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--rol-ink-primary)]">
            <Footprints className="h-4 w-4 text-[var(--rol-ink-secondary)]" />
            Velocitat de moviment (m)
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ['walk', 'Caminar'],
                ['fly', 'Volar'],
                ['swim', 'Nedar'],
                ['climb', 'Grimpar'],
              ] as const
            ).map(([spdKey, label]) => {
              const editable = canEditSheetField(`speed.${spdKey}`, access);
              return (
                <div key={spdKey}>
                  <label
                    htmlFor={`speed-${spdKey}`}
                    className="mb-1 block text-[11px] font-medium text-[var(--rol-ink-secondary)]"
                  >
                    {label}
                  </label>
                  <input
                    id={`speed-${spdKey}`}
                    type="number"
                    min={0}
                    max={1000}
                    disabled={!editable}
                    placeholder="—"
                    value={draft.speed[spdKey] ?? ''}
                    onChange={(e) =>
                      onChangeSpeed(spdKey, parseOptionalInt(e.target.value, 0, 1000))
                    }
                    className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1 text-center font-mono text-xs font-semibold text-[var(--rol-ink-primary)] disabled:bg-[var(--rol-bg-surface-alt)]/50 disabled:cursor-not-allowed"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Daus de cop (exactament des de computed.combat.hitDicePool) */}
        <div className="space-y-2.5 border-t border-[var(--rol-border-subtle)] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--rol-ink-primary)]">Daus de cop</h3>
            {hpPool.display && <Badge tone="gold">{hpPool.display}</Badge>}
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/50 p-2.5 text-center text-xs">
            <div>
              <span className="block text-[10px] uppercase tracking-wide text-[var(--rol-ink-muted)]">
                Totals
              </span>
              <span className="font-mono text-sm font-bold text-[var(--rol-ink-primary)]">
                {hpPool.total}
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wide text-[var(--rol-ink-muted)]">
                Gastats
              </span>
              <span className="font-mono text-sm font-bold text-[var(--rol-ink-primary)]">
                {hpPool.used}
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wide text-[var(--rol-ink-muted)]">
                Disponibles
              </span>
              <span className="font-mono text-sm font-bold text-[var(--rol-status-success-ink)]">
                {hpPool.available}
              </span>
            </div>
          </div>

          {hpPool.hasUnallocatedLegacyUsage ? (
            <div className="space-y-2 rounded-[var(--rol-radius-md)] border border-[var(--rol-status-warning-border)] bg-[var(--rol-status-warning-bg)]/60 p-3 text-xs text-[var(--rol-status-warning-ink)]">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">
                    Assignació per mida desconeguda en fitxa antiga ({hpPool.unallocatedUsed} dau(s)
                    gastat(s)).
                  </p>
                  <p className="mt-0.5">
                    El motor no inventa quines mides s’havien gastat. Quan els daus gastats arribin a
                    0 (p. ex. mitjançant descansos llargs), s’activarà el control individual per mida.
                  </p>
                </div>
              </div>
              {hpPool.byDie.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {hpPool.byDie.map((entry) => (
                    <Badge key={entry.dieKey} tone="neutral">
                      {entry.total}
                      {entry.dieKey} · gastats desconeguts
                    </Badge>
                  ))}
                </div>
              )}
              {canHitDiceScalar && (
                <div className="flex items-center gap-2 pt-1">
                  <label htmlFor="legacy-hit-dice-used" className="font-medium">
                    Total gastats (global):
                  </label>
                  <input
                    id="legacy-hit-dice-used"
                    type="number"
                    min={0}
                    max={hpPool.total}
                    value={draft.hitPoints.hitDiceUsed}
                    onChange={(e) =>
                      onChangeLegacyHitDiceUsed(
                        parseOptionalInt(e.target.value, 0, hpPool.total) ?? 0
                      )
                    }
                    className="w-16 rounded-[var(--rol-radius-sm)] border border-[var(--rol-status-warning-border)] bg-[var(--rol-bg-surface)] px-2 py-1 text-center font-mono text-xs text-[var(--rol-ink-primary)]"
                  />
                </div>
              )}
            </div>
          ) : hpPool.byDie.length > 0 ? (
            <div className="space-y-2">
              {hpPool.byDie.map((entry) => {
                const draftSpent =
                  draft.hitPoints.hitDiceUsedByDie !== null
                    ? (draft.hitPoints.hitDiceUsedByDie[entry.dieKey] ?? 0)
                    : 0;
                const availableServer = entry.available ?? Math.max(0, entry.total - draftSpent);

                return (
                  <div
                    key={entry.dieKey}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Badge tone="gold">{entry.dieKey}</Badge>
                      <span className="text-[var(--rol-ink-secondary)]">
                        Totals: <strong>{entry.total}</strong> · Disponibles:{' '}
                        <strong>{availableServer}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label
                        htmlFor={`hit-die-spent-${entry.dieKey}`}
                        className="text-[var(--rol-ink-muted)]"
                      >
                        Gastats:
                      </label>
                      {canHitDiceByDie ? (
                        <input
                          id={`hit-die-spent-${entry.dieKey}`}
                          type="number"
                          min={0}
                          max={entry.total}
                          value={draftSpent}
                          onChange={(e) =>
                            onChangeHitDieSpent(
                              entry.dieKey,
                              parseOptionalInt(e.target.value, 0, entry.total) ?? 0
                            )
                          }
                          className="w-14 rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface-alt)]/50 px-1.5 py-0.5 text-center font-mono text-xs font-semibold"
                        />
                      ) : (
                        <span className="font-mono font-semibold">{draftSpent}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-[var(--rol-ink-muted)]">
              Cap classe oficial amb dau de cop assignat encara.
            </p>
          )}
        </div>

        {/* 5. Salvacions contra la mort */}
        <div className="space-y-2 border-t border-[var(--rol-border-subtle)] pt-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--rol-ink-primary)]">
            <Skull className="h-4 w-4 text-[var(--rol-accent-primary)]" />
            Salvacions contra la mort
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                ['successes', 'Èxits', 'bg-[var(--rol-status-success-ink)] border-[var(--rol-status-success-ink)]'],
                ['failures', 'Fallades', 'bg-[var(--rol-status-danger-ink)] border-[var(--rol-status-danger-ink)]'],
              ] as const
            ).map(([kind, label, activePipClass]) => {
              const value = draft.hitPoints.deathSaves[kind];
              return (
                <div
                  key={kind}
                  className="flex items-center justify-between rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/40 px-3 py-2"
                >
                  <span className="text-xs font-medium text-[var(--rol-ink-primary)]">{label}</span>
                  <div className="flex items-center gap-1.5" role="group" aria-label={label}>
                    {[1, 2, 3].map((step) => {
                      const active = value >= step;
                      const nextVal = value === step ? step - 1 : step;
                      return (
                        <button
                          key={step}
                          type="button"
                          disabled={!canDeathSaves}
                          aria-pressed={active}
                          aria-label={`${label}: ${step} de 3`}
                          onClick={() => onChangeDeathSave(kind, nextVal)}
                          className={`h-5 w-5 rounded-full border transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rol-accent-gold)] ${
                            active
                              ? activePipClass
                              : 'border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)]'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
