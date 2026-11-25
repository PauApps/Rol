'use client';

import { Dices, Lock, Sparkles } from 'lucide-react';
import {
  ABILITY_METHOD_LABELS_CA,
  type CampaignCreationConfig,
} from '@/domain/campaigns/creation-config';
import {
  ABILITY_KEYS,
  ABILITY_LABELS_CA,
  ABILITY_SHORT_CA,
  POINT_BUY_BUDGET_2014,
  POINT_BUY_COSTS_2014,
  STANDARD_ARRAY_2014,
  calculateAbilityModifier,
  calculatePointBuyCost,
  getRaceEntry,
  getSubraceEntry,
  roll4d6DropLowestSet,
  type AbilityKey,
} from '@/domain/systems/dnd5e-2014';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatSigned } from '../types';
import {
  getWizardFinalAbilities,
  getWizardRacialBonusVector,
  type CharacterWizardState,
} from './wizard-state';

interface StepAbilitiesProps {
  state: CharacterWizardState;
  config: CampaignCreationConfig;
  isGm: boolean;
  onChange: (updater: (prev: CharacterWizardState) => CharacterWizardState) => void;
}

export function StepAbilities({ state, config, isGm, onChange }: StepAbilitiesProps) {
  const method = config.abilityScoreMethod;
  const race = state.raceMode === 'catalog' ? getRaceEntry(state.raceId) : undefined;
  const subrace = getSubraceEntry(race, state.subraceId);
  const flexNeeded = subrace?.flexibleBonusCount ?? race?.flexibleBonusCount ?? 0;
  const flexExcluded = new Set(subrace?.flexibleBonusExcluded ?? race?.flexibleBonusExcluded ?? []);

  const racialVec = getWizardRacialBonusVector(state);
  const finalScores = getWizardFinalAbilities(state, method, isGm);
  const pointBuyInfo = method === 'point_buy' ? calculatePointBuyCost(state.baseAbilities) : null;

  function toggleFlexibleBonus(key: AbilityKey) {
    if (flexExcluded.has(key)) return;
    onChange((prev) => {
      const exists = prev.flexibleRacialAbilities.includes(key);
      if (exists) {
        return {
          ...prev,
          flexibleRacialAbilities: prev.flexibleRacialAbilities.filter((k) => k !== key),
        };
      }
      const next = [...prev.flexibleRacialAbilities, key];
      if (next.length > flexNeeded) {
        next.shift();
      }
      return { ...prev, flexibleRacialAbilities: next };
    });
  }

  function handleRollAll() {
    const rolled = roll4d6DropLowestSet();
    onChange((prev) => ({
      ...prev,
      rolledPool: rolled,
      baseAbilities: {
        str: rolled[0]?.total ?? 10,
        dex: rolled[1]?.total ?? 10,
        con: rolled[2]?.total ?? 10,
        int: rolled[3]?.total ?? 10,
        wis: rolled[4]?.total ?? 10,
        cha: rolled[5]?.total ?? 10,
      },
    }));
  }

  function handleStandardArraySwap(targetKey: AbilityKey, desiredValue: number) {
    onChange((prev) => {
      const next = { ...prev.baseAbilities };
      const currentVal = next[targetKey];
      const existingHolder = ABILITY_KEYS.find(
        (k) => k !== targetKey && next[k] === desiredValue
      );
      next[targetKey] = desiredValue;
      if (existingHolder && currentVal !== null) {
        next[existingHolder] = currentVal;
      }
      return { ...prev, baseAbilities: next };
    });
  }

  const rolledValuesSorted = state.rolledPool.map((r) => r.total);

  return (
    <Card
      title="Pas 2 · Característiques"
      subtitle={`Mètode actiu de la campanya: ${ABILITY_METHOD_LABELS_CA[method]}.`}
      actions={
        method === 'point_buy' && pointBuyInfo ? (
          <Badge tone={pointBuyInfo.valid ? 'gold' : 'danger'}>
            Punts usats: {pointBuyInfo.totalCost} / {POINT_BUY_BUDGET_2014}
          </Badge>
        ) : method === 'standard_array' ? (
          <Badge tone="gold">Array: 15, 14, 13, 12, 10, 8</Badge>
        ) : null
      }
    >
      <div className="space-y-4">
        {method === 'manual_gm' && !isGm && (
          <div className="flex items-start gap-2.5 rounded-[var(--rol-radius-md)] border border-[var(--rol-status-warning-border)] bg-[var(--rol-status-warning-bg)]/50 p-3 text-xs text-[var(--rol-status-warning-ink)]">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Assignació directa reservada al Director de Joc</p>
              <p className="mt-0.5">
                Pots continuar la creació amb les puntuacions pendents; el GM les establirà a la
                fitxa un cop creat el personatge.
              </p>
            </div>
          </div>
        )}

        {method === 'rolled_4d6_drop_lowest' && (
          <div className="rounded-[var(--rol-radius-md)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface-alt)]/45 p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[var(--rol-ink-secondary)]">
                Llança 6 sèries de 4d6 descartant el menor i distribueix els resultats obtinguts.
              </p>
              <Button size="sm" variant="secondary" onClick={handleRollAll}>
                <Dices className="h-3.5 w-3.5" />
                {state.rolledPool.length > 0 ? 'Tornar a tirar (4d6)' : 'Tirar 6 valors (4d6)'}
              </Button>
            </div>
            {state.rolledPool.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {state.rolledPool.map((r, idx) => (
                  <Badge key={idx} tone="gold">
                    {r.total} ({r.dice.join('+')} · desc. {r.dropped})
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {flexNeeded > 0 && (
          <div className="rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/40 p-3 space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--rol-ink-primary)]">
              <Sparkles className="h-3.5 w-3.5 text-[var(--rol-accent-gold)]" />
              Bonificador racial flexible ({race?.labelCa}): tria {flexNeeded} característiques (+1 cadascuna)
            </p>
            <div className="flex flex-wrap gap-2">
              {ABILITY_KEYS.map((key) => {
                const excluded = flexExcluded.has(key);
                const selected = state.flexibleRacialAbilities.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={excluded}
                    aria-pressed={selected}
                    onClick={() => toggleFlexibleBonus(key)}
                    className={`rounded-[var(--rol-radius-sm)] border px-2.5 py-1 text-xs font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      selected
                        ? 'border-[var(--rol-accent-primary)] bg-[var(--rol-accent-primary)] text-[var(--rol-accent-primary-ink)]'
                        : 'border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] text-[var(--rol-ink-primary)]'
                    }`}
                  >
                    {ABILITY_SHORT_CA[key]} (+1)
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Graella de les 6 característiques */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ABILITY_KEYS.map((key) => {
            const baseVal = state.baseAbilities[key];
            const racialBonus = racialVec[key];
            const finalVal = finalScores[key];
            const mod = calculateAbilityModifier(finalVal);
            const disabled = method === 'manual_gm' && !isGm;

            return (
              <div
                key={key}
                className="rol-stat-plaque p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--rol-accent-primary)]">
                      {ABILITY_SHORT_CA[key]}
                    </span>
                    <h3 className="text-sm font-semibold text-[var(--rol-ink-primary)]">
                      {ABILITY_LABELS_CA[key]}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] uppercase text-[var(--rol-ink-muted)]">
                      Mod. final
                    </span>
                    <span className="rol-heading-flourish text-xl font-bold text-[var(--rol-ink-primary)]">
                      {formatSigned(mod)}
                    </span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor={`wizard-ab-${key}`}
                    className="mb-1 block text-xs text-[var(--rol-ink-secondary)]"
                  >
                    Puntuació base
                  </label>

                  {disabled ? (
                    <div className="rounded border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/40 px-2.5 py-1.5 text-xs text-[var(--rol-ink-muted)]">
                      Pendent del GM
                    </div>
                  ) : method === 'standard_array' ? (
                    <select
                      id={`wizard-ab-${key}`}
                      value={baseVal ?? ''}
                      onChange={(e) => handleStandardArraySwap(key, Number(e.target.value))}
                      className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2.5 py-1.5 font-mono text-sm font-semibold"
                    >
                      {STANDARD_ARRAY_2014.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  ) : method === 'point_buy' ? (
                    <div className="flex items-center gap-2">
                      <select
                        id={`wizard-ab-${key}`}
                        value={baseVal ?? 8}
                        onChange={(e) => {
                          const num = Number(e.target.value);
                          onChange((prev) => ({
                            ...prev,
                            baseAbilities: { ...prev.baseAbilities, [key]: num },
                          }));
                        }}
                        className="flex-1 rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2.5 py-1.5 font-mono text-sm font-semibold"
                      >
                        {[8, 9, 10, 11, 12, 13, 14, 15].map((score) => (
                          <option key={score} value={score}>
                            {score} (cost {POINT_BUY_COSTS_2014[score]})
                          </option>
                        ))}
                      </select>
                      <span className="text-[11px] font-mono text-[var(--rol-ink-muted)]">
                        8–15
                      </span>
                    </div>
                  ) : method === 'rolled_4d6_drop_lowest' && rolledValuesSorted.length === 6 ? (
                    <select
                      id={`wizard-ab-${key}`}
                      value={baseVal ?? ''}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        onChange((prev) => ({
                          ...prev,
                          baseAbilities: { ...prev.baseAbilities, [key]: val },
                        }));
                      }}
                      className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2.5 py-1.5 font-mono text-sm font-semibold"
                    >
                      <option value="">Selecciona…</option>
                      {Array.from(new Set(rolledValuesSorted)).map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`wizard-ab-${key}`}
                      type="number"
                      min={1}
                      max={20}
                      value={baseVal ?? ''}
                      placeholder="—"
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        const parsed = raw ? Math.min(20, Math.max(1, Math.trunc(Number(raw)))) : null;
                        onChange((prev) => ({
                          ...prev,
                          baseAbilities: { ...prev.baseAbilities, [key]: parsed },
                        }));
                      }}
                      className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2.5 py-1.5 font-mono text-sm font-semibold"
                    />
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-[var(--rol-border-subtle)] pt-1.5 text-xs">
                  <span className="text-[var(--rol-ink-muted)]">
                    Racial: {racialBonus > 0 ? `+${racialBonus}` : '0'}
                  </span>
                  <span className="font-mono font-bold text-[var(--rol-ink-primary)]">
                    Total: {finalVal ?? '—'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
