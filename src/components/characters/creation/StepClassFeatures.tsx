'use client';

import { useState } from 'react';
import { Flame, Heart, Plus, Sparkles, Swords, Trash2 } from 'lucide-react';
import {
  DND5E_FIGHTING_STYLES,
  calculateStartingHitPoints,
  getClassCreationRule,
  getClassEntry,
  type Dnd5e2014SpellEntry,
} from '@/domain/systems/dnd5e-2014';
import type { CampaignCreationConfig } from '@/domain/campaigns/creation-config';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatSigned, SPELL_MODEL_LABELS_CA } from '../types';
import {
  buildPreviewFromWizard,
  getWizardFinalAbilities,
  type CharacterWizardState,
} from './wizard-state';

interface StepClassFeaturesProps {
  state: CharacterWizardState;
  config: CampaignCreationConfig;
  isGm: boolean;
  onChange: (updater: (prev: CharacterWizardState) => CharacterWizardState) => void;
}

export function StepClassFeatures({
  state,
  config,
  isGm,
  onChange,
}: StepClassFeaturesProps) {
  const [spellName, setSpellName] = useState('');
  const [spellLevel, setSpellLevel] = useState(0);
  const [spellPrepared, setSpellPrepared] = useState(true);

  const classMeta = state.classMode === 'official' ? getClassEntry(state.classId) : undefined;
  const classRule = state.classMode === 'official' ? getClassCreationRule(state.classId) : undefined;
  const finalAbilities = getWizardFinalAbilities(state, config.abilityScoreMethod, isGm);
  const officialHp =
    state.classMode === 'official'
      ? calculateStartingHitPoints(state.classId, state.level, finalAbilities.con, state.subraceId)
      : 8;

  const { computed } = buildPreviewFromWizard(state, config, isGm);
  const fightingStyleUnlocked =
    classRule?.fightingStyleLevel !== null &&
    classRule?.fightingStyleLevel !== undefined &&
    state.level >= classRule.fightingStyleLevel;

  const activeSource = computed.spellcasting?.sources[0] ?? null;
  const maxSpellCircle = activeSource?.maxClassSpellLevel ?? 0;

  function handleAddSpell() {
    const clean = spellName.trim();
    if (!clean) return;
    const id = `init-spell-${state.initialSpells.length + 1}-${Date.now().toString(36)}`;
    const entry: Dnd5e2014SpellEntry = {
      id,
      level: Math.min(9, Math.max(0, spellLevel)),
      name: clean,
      castingTime: '1 acció',
      range: '',
      components: 'V, S',
      duration: 'Instantània',
      school: null,
      sourceType: activeSource?.progression === 'pact' ? 'pact' : 'class',
      sourceClassId: state.classMode === 'official' ? state.classId : null,
      alwaysPrepared: false,
      prepared: spellLevel >= 1 && (activeSource?.model === 'prepared' || activeSource?.model === 'spellbook') ? spellPrepared : false,
      inSpellbook: Boolean(activeSource?.usesSpellbook),
      ritual: false,
      concentration: false,
      notes: '',
    };
    onChange((prev) => ({
      ...prev,
      initialSpells: [...prev.initialSpells, entry],
    }));
    setSpellName('');
  }

  return (
    <Card
      title="Pas 4 · Classe, capacitats i màgia inicial"
      subtitle="Punts de cop inicials, trets oficials, recursos especials i configuració màgica del personatge."
    >
      <div className="space-y-5">
        {/* Punts de cop inicials */}
        <div className="rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/35 p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--rol-ink-primary)]">
              <Heart className="h-4 w-4 text-[var(--rol-accent-primary)]" />
              Punts de cop inicials (Dau d{classMeta?.hitDie ?? 8})
            </span>
            <Badge tone="gold">Oficial: {officialHp ?? '—'} PV</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="wizard-hp-mode"
                checked={state.hpMode === 'official_average'}
                onChange={() =>
                  onChange((prev) => ({ ...prev, hpMode: 'official_average', customHpMax: null }))
                }
              />
              <span>Màxim a nivell 1 + mitjana oficial per nivells següents ({officialHp})</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="wizard-hp-mode"
                checked={state.hpMode === 'custom'}
                onChange={() =>
                  onChange((prev) => ({
                    ...prev,
                    hpMode: 'custom',
                    customHpMax: prev.customHpMax ?? officialHp ?? 10,
                  }))
                }
              />
              <span>Tirada / valor personalitzat:</span>
            </label>
            {state.hpMode === 'custom' && (
              <input
                type="number"
                min={1}
                max={999}
                aria-label="Punts de cop màxims inicials"
                value={state.customHpMax ?? ''}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    customHpMax: Math.max(1, Math.trunc(Number(e.target.value) || 1)),
                  }))
                }
                className="w-20 rounded border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1 font-mono text-xs font-bold"
              />
            )}
          </div>
        </div>

        {/* Estil de combat (si la classe el desbloqueja al nivell actual) */}
        {fightingStyleUnlocked && classRule && (
          <div className="rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/35 p-3.5 space-y-2.5">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--rol-ink-primary)]">
              <Swords className="h-4 w-4 text-[var(--rol-accent-gold)]" />
              Estil de combat (nivell {classRule.fightingStyleLevel})
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {DND5E_FIGHTING_STYLES.filter((fs) =>
                classRule.fightingStyleIds.includes(fs.id)
              ).map((fs) => {
                const selected = state.fightingStyleId === fs.id;
                return (
                  <button
                    key={fs.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onChange((prev) => ({ ...prev, fightingStyleId: fs.id }))}
                    className={`rounded-[var(--rol-radius-sm)] border p-2.5 text-left text-xs cursor-pointer ${
                      selected
                        ? 'border-[var(--rol-accent-primary)] bg-[var(--rol-accent-primary)]/10 text-[var(--rol-ink-primary)]'
                        : 'border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] text-[var(--rol-ink-secondary)]'
                    }`}
                  >
                    <p className="font-semibold text-[var(--rol-ink-primary)]">{fs.labelCa}</p>
                    <p className="mt-0.5">{fs.descriptionCa}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Recursos especials calculats pel domini */}
        <div className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--rol-ink-primary)]">
            <Flame className="h-4 w-4 text-[var(--rol-accent-primary)]" />
            Recursos especials al nivell {state.level} ({computed.resources.length})
          </h3>
          {computed.resources.length === 0 ? (
            <p className="text-xs text-[var(--rol-ink-muted)]">
              Cap recurs especial amb usos comptats al nivell {state.level} per a aquesta combinació.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {computed.resources.map((r) => (
                <div
                  key={r.key}
                  className="rounded border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{r.name}</span>
                    <Badge tone="gold">{r.unlimited ? 'Il·limitat' : `${r.totalUses} usos`}</Badge>
                  </div>
                  <p className="mt-0.5 text-[var(--rol-ink-muted)]">{r.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Conjuració inicial (només si té màgia activa) */}
        <div className="space-y-3 border-t border-[var(--rol-border-subtle)] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--rol-ink-primary)]">
              <Sparkles className="h-4 w-4 text-[var(--rol-accent-gold)]" />
              Màgia i conjurs inicials
            </h3>
            {activeSource && (
              <Badge tone="gold">{SPELL_MODEL_LABELS_CA[activeSource.model]}</Badge>
            )}
          </div>

          {!activeSource ? (
            <p className="text-xs text-[var(--rol-ink-muted)]">
              Aquesta classe al nivell {state.level} no té llançament de conjurs actiu.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 text-center text-xs">
                <div className="rol-stat-plaque p-2">
                  <span className="block text-[10px] text-[var(--rol-ink-muted)]">Aptitud</span>
                  <span className="font-semibold">{activeSource.abilityLabelCa ?? '—'}</span>
                </div>
                <div className="rol-stat-plaque p-2">
                  <span className="block text-[10px] text-[var(--rol-ink-muted)]">CD conjurs</span>
                  <span className="font-mono font-bold text-[var(--rol-accent-primary)]">
                    {activeSource.saveDc ?? '—'}
                  </span>
                </div>
                <div className="rol-stat-plaque p-2">
                  <span className="block text-[10px] text-[var(--rol-ink-muted)]">Atac màgic</span>
                  <span className="font-mono font-bold">{formatSigned(activeSource.attackBonus)}</span>
                </div>
                <div className="rol-stat-plaque p-2">
                  <span className="block text-[10px] text-[var(--rol-ink-muted)]">
                    {activeSource.preparedLimit !== null ? 'Límit preparats' : 'Cercle màxim'}
                  </span>
                  <span className="font-mono font-bold">
                    {activeSource.preparedLimit !== null
                      ? `${activeSource.preparedCount} / ${activeSource.preparedLimit}`
                      : `Nivell ${maxSpellCircle}`}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-[var(--rol-ink-muted)]">
                Nota: el projecte no inclou encara un catàleg tancat de conjurs oficials; pots
                afegir els conjurs inicials manualment respectant les regles del model (també els
                podràs gestionar des de la pestanya «Màgia i habilitats»).
              </p>

              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[160px]">
                  <label htmlFor="wizard-spell-name" className="mb-1 block text-xs font-medium">
                    Nom del conjur / truc
                  </label>
                  <input
                    id="wizard-spell-name"
                    type="text"
                    value={spellName}
                    onChange={(e) => setSpellName(e.target.value)}
                    placeholder="Ex. Flama sagrada / Curar ferides"
                    className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="wizard-spell-lvl" className="mb-1 block text-xs font-medium">
                    Nivell
                  </label>
                  <select
                    id="wizard-spell-lvl"
                    value={spellLevel}
                    onChange={(e) => setSpellLevel(Number(e.target.value))}
                    className="rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1.5 text-xs"
                  >
                    <option value={0}>0 (Truc)</option>
                    {Array.from({ length: maxSpellCircle }, (_, i) => i + 1).map((lvl) => (
                      <option key={lvl} value={lvl}>
                        Nivell {lvl}
                      </option>
                    ))}
                  </select>
                </div>
                {spellLevel >= 1 &&
                  (activeSource.model === 'prepared' || activeSource.model === 'spellbook') && (
                    <label className="inline-flex items-center gap-1.5 pb-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={spellPrepared}
                        onChange={(e) => setSpellPrepared(e.target.checked)}
                      />
                      <span>Preparat</span>
                    </label>
                  )}
                <Button size="sm" variant="secondary" disabled={!spellName.trim()} onClick={handleAddSpell}>
                  <Plus className="h-3.5 w-3.5" />
                  Afegir conjur
                </Button>
              </div>

              {state.initialSpells.length > 0 && (
                <ul className="space-y-1.5 text-xs">
                  {state.initialSpells.map((sp) => (
                    <li
                      key={sp.id}
                      className="flex items-center justify-between gap-2 rounded border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] px-2.5 py-1.5"
                    >
                      <span>
                        <strong>{sp.name}</strong> ·{' '}
                        {sp.level === 0 ? 'Truc' : `Niv. ${sp.level}`}
                        {sp.prepared ? ' · Preparat' : ''}
                        {sp.inSpellbook ? ' · Grimori' : ''}
                      </span>
                      <button
                        type="button"
                        aria-label={`Eliminar conjur inicial ${sp.name}`}
                        onClick={() =>
                          onChange((prev) => ({
                            ...prev,
                            initialSpells: prev.initialSpells.filter((s) => s.id !== sp.id),
                          }))
                        }
                        className="rounded p-1 text-[var(--rol-status-danger-ink)] hover:bg-[var(--rol-status-danger-bg)] cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
