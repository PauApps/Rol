'use client';

import { useState } from 'react';
import {
  ABILITY_LABELS_CA,
  ABILITY_SHORT_CA,
  DND5E_BACKGROUNDS,
  DND5E_LANGUAGES_CA,
  DND5E_SKILLS,
  getBackgroundEntry,
  getClassCreationRule,
  getClassEntry,
  getRaceEntry,
  getSubraceEntry,
  normalizeMatchText,
  type SkillId,
} from '@/domain/systems/dnd5e-2014';
import type { CampaignCreationConfig } from '@/domain/campaigns/creation-config';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { InputField, SelectField } from '@/components/ui/Field';
import {
  buildStarterInventoryList,
  getFixedSkillsFromRaceAndBackground,
  type CharacterWizardState,
} from './wizard-state';

interface StepBackgroundProficienciesProps {
  state: CharacterWizardState;
  config: CampaignCreationConfig;
  isGm: boolean;
  onChange: (updater: (prev: CharacterWizardState) => CharacterWizardState) => void;
}

export function StepBackgroundProficiencies({
  state,
  config,
  isGm,
  onChange,
}: StepBackgroundProficienciesProps) {
  const [newLangInput, setNewLangInput] = useState('');
  const [newToolInput, setNewToolInput] = useState('');

  const race = state.raceMode === 'catalog' ? getRaceEntry(state.raceId) : undefined;
  const subrace = getSubraceEntry(race, state.subraceId);
  const bg = state.backgroundMode === 'catalog' ? getBackgroundEntry(state.backgroundId) : undefined;
  const classMeta = state.classMode === 'official' ? getClassEntry(state.classId) : undefined;
  const classRule = state.classMode === 'official' ? getClassCreationRule(state.classId) : undefined;

  const fixedSkills = new Set(getFixedSkillsFromRaceAndBackground(state));
  const racialExtraLimit = subrace?.extraSkillChoices ?? race?.extraSkillChoices ?? 0;
  const classSkillLimit = classRule?.skillChoiceCount ?? 2;
  const eligibleClassSkills = classRule?.eligibleSkills ?? DND5E_SKILLS.map((s) => s.id);
  const extraLanguageSlots =
    (subrace?.extraLanguageChoices ?? race?.extraLanguageChoices ?? 0) +
    (bg?.extraLanguageChoices ?? 0);

  const allowCustomBg =
    config.allowedBackgrounds.length === 0 || config.freedomMode !== 'strict' || isGm;

  const isBgAllowed = (labelCa: string): boolean => {
    if (config.allowedBackgrounds.length === 0) return true;
    const bgObj = getBackgroundEntry(labelCa);
    return config.allowedBackgrounds.some(
      (a) =>
        normalizeMatchText(a) === normalizeMatchText(labelCa) ||
        (bgObj && getBackgroundEntry(a)?.id === bgObj.id)
    );
  };

  function toggleClassSkill(skillId: SkillId) {
    if (fixedSkills.has(skillId) || state.racialExtraSkills.includes(skillId)) return;
    onChange((prev) => {
      if (prev.classSkills.includes(skillId)) {
        return { ...prev, classSkills: prev.classSkills.filter((s) => s !== skillId) };
      }
      if (prev.classSkills.length >= classSkillLimit) {
        return prev;
      }
      return { ...prev, classSkills: [...prev.classSkills, skillId] };
    });
  }

  function toggleRacialExtraSkill(skillId: SkillId) {
    if (fixedSkills.has(skillId) || state.classSkills.includes(skillId)) return;
    onChange((prev) => {
      if (prev.racialExtraSkills.includes(skillId)) {
        return {
          ...prev,
          racialExtraSkills: prev.racialExtraSkills.filter((s) => s !== skillId),
        };
      }
      if (prev.racialExtraSkills.length >= racialExtraLimit) {
        return prev;
      }
      return { ...prev, racialExtraSkills: [...prev.racialExtraSkills, skillId] };
    });
  }

  function toggleExtraLanguage(lang: string) {
    if (race?.languages.includes(lang)) return;
    onChange((prev) => ({
      ...prev,
      extraLanguages: prev.extraLanguages.includes(lang)
        ? prev.extraLanguages.filter((l) => l !== lang)
        : [...prev.extraLanguages, lang],
    }));
  }

  return (
    <Card
      title="Pas 3 · Trasfons, habilitats i competències"
      subtitle="Les competències de raça, classe i antecedent s’integren automàticament sense duplicats."
    >
      <div className="space-y-5">
        {/* Selector de trasfons */}
        <div className="rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/35 p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--rol-ink-primary)]">
              Trasfons / Antecedent {config.requiredFields.includes('background') ? '*' : ''}
            </span>
            {allowCustomBg && (
              <button
                type="button"
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    backgroundMode: prev.backgroundMode === 'catalog' ? 'custom' : 'catalog',
                  }))
                }
                className="text-xs font-medium text-[var(--rol-accent-primary)] underline cursor-pointer"
              >
                {state.backgroundMode === 'catalog'
                  ? 'Introduir antecedent personalitzat'
                  : 'Triar del catàleg oficial'}
              </button>
            )}
          </div>

          {state.backgroundMode === 'catalog' ? (
            <SelectField
              label="Antecedent (PHB 2014)"
              htmlFor="wizard-bg-select"
              value={state.backgroundId}
              onChange={(e) => {
                const nextBgId = e.target.value;
                onChange((prev) => ({
                  ...prev,
                  backgroundId: nextBgId,
                  starterInventory: buildStarterInventoryList({
                    classId: prev.classId,
                    classMode: prev.classMode,
                    equipmentSelections: prev.equipmentSelections,
                    backgroundId: nextBgId,
                    backgroundMode: 'catalog',
                    previousStarter: prev.starterInventory,
                  }),
                }));
              }}
            >
              {DND5E_BACKGROUNDS.map((b) => {
                const allowed = isBgAllowed(b.labelCa);
                if (!allowed && config.freedomMode === 'strict' && !isGm) {
                  return null;
                }
                return (
                  <option key={b.id} value={b.id}>
                    {b.labelCa}
                    {!allowed ? ' (fora de recomanació)' : ''}
                  </option>
                );
              })}
            </SelectField>
          ) : (
            <InputField
              label="Nom de l’antecedent"
              htmlFor="wizard-custom-bg"
              type="text"
              value={state.customBackground}
              onChange={(e) =>
                onChange((prev) => ({ ...prev, customBackground: e.target.value }))
              }
              placeholder="Ex. Guàrdia de caravanes"
            />
          )}

          {bg && state.backgroundMode === 'catalog' && (
            <p className="text-xs text-[var(--rol-ink-secondary)]">
              <strong>Tret:</strong> {bg.featureName} — {bg.featureDescription}
            </p>
          )}
        </div>

        {/* Salvacions oficials (només lectura, derivades de classe) */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
            Tirades de salvació competents (atorgades per la classe)
          </p>
          <div className="flex flex-wrap gap-2">
            {classMeta ? (
              classMeta.savingThrows.map((ab) => (
                <Badge key={ab} tone="gold">
                  {ABILITY_LABELS_CA[ab]} ({ABILITY_SHORT_CA[ab]})
                </Badge>
              ))
            ) : (
              <span className="text-xs text-[var(--rol-ink-muted)]">
                Configurable posteriorment en classe personalitzada.
              </span>
            )}
          </div>
        </div>

        {/* Habilitats fixes + elecció de classe */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--rol-ink-primary)]">
              Habilitats de classe ({state.classSkills.length} / {classSkillLimit})
            </h3>
            {fixedSkills.size > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[var(--rol-ink-muted)]">Fixes (raça/trasfons):</span>
                {Array.from(fixedSkills).map((sid) => {
                  const sEntry = DND5E_SKILLS.find((s) => s.id === sid);
                  return (
                    <Badge key={sid} tone="success">
                      {sEntry?.labelCa ?? sid}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {eligibleClassSkills.map((sid) => {
              const sEntry = DND5E_SKILLS.find((s) => s.id === sid);
              const isFixed = fixedSkills.has(sid);
              const isInRacialExtra = state.racialExtraSkills.includes(sid);
              const checked = state.classSkills.includes(sid);
              const disabled =
                isFixed ||
                isInRacialExtra ||
                (!checked && state.classSkills.length >= classSkillLimit);

              return (
                <label
                  key={sid}
                  className={`flex items-center gap-2 rounded-[var(--rol-radius-sm)] border px-2.5 py-1.5 text-xs ${
                    isFixed
                      ? 'border-[var(--rol-status-success-border)] bg-[var(--rol-status-success-bg)]/50 text-[var(--rol-status-success-ink)]'
                      : checked
                        ? 'border-[var(--rol-accent-primary)] bg-[var(--rol-accent-primary)]/10 font-semibold text-[var(--rol-ink-primary)]'
                        : 'border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] text-[var(--rol-ink-secondary)]'
                  } ${disabled && !checked && !isFixed ? 'opacity-50' : 'cursor-pointer'}`}
                >
                  <input
                    type="checkbox"
                    checked={isFixed || checked}
                    disabled={disabled}
                    onChange={() => toggleClassSkill(sid)}
                  />
                  <span className="truncate">
                    {sEntry?.labelCa ?? sid}{' '}
                    <span className="text-[10px] text-[var(--rol-ink-muted)]">
                      ({sEntry ? ABILITY_SHORT_CA[sEntry.ability] : ''})
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Habilitats extra racials (Humà variant / Mig-elf) */}
        {racialExtraLimit > 0 && (
          <div className="space-y-2 border-t border-[var(--rol-border-subtle)] pt-3">
            <h3 className="text-sm font-semibold text-[var(--rol-ink-primary)]">
              Habilitats racials addicionals ({state.racialExtraSkills.length} / {racialExtraLimit})
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DND5E_SKILLS.map((sEntry) => {
                const blocked =
                  fixedSkills.has(sEntry.id) || state.classSkills.includes(sEntry.id);
                const checked = state.racialExtraSkills.includes(sEntry.id);
                const disabled =
                  blocked || (!checked && state.racialExtraSkills.length >= racialExtraLimit);
                return (
                  <label
                    key={sEntry.id}
                    className={`flex items-center gap-1.5 rounded border px-2 py-1 text-xs ${
                      checked
                        ? 'border-[var(--rol-accent-gold)] bg-[var(--rol-accent-gold-soft)]/40 font-semibold'
                        : 'border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)]'
                    } ${disabled && !checked ? 'opacity-45' : 'cursor-pointer'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleRacialExtraSkill(sEntry.id)}
                    />
                    <span className="truncate">{sEntry.labelCa}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Armadures, armes, eines i idiomes */}
        <div className="grid gap-4 border-t border-[var(--rol-border-subtle)] pt-4 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
              Armadures, armes i eines
            </p>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {[
                ...(race?.armorProficiencies ?? []),
                ...(subrace?.armorProficiencies ?? []),
                ...(classRule?.armorProficiencies ?? []),
              ].map((a) => (
                <Badge key={`arm-${a}`} tone="neutral">
                  {a}
                </Badge>
              ))}
              {[
                ...(race?.weaponProficiencies ?? []),
                ...(subrace?.weaponProficiencies ?? []),
                ...(classRule?.weaponProficiencies ?? []),
              ].map((w) => (
                <Badge key={`wpn-${w}`} tone="neutral">
                  {w}
                </Badge>
              ))}
              {[
                ...(bg?.toolProficiencies ?? []),
                ...(classRule?.toolProficiencies ?? []),
                ...state.extraToolProfs,
              ].map((t) => (
                <Badge key={`tool-${t}`} tone="gold">
                  {t}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newToolInput}
                onChange={(e) => setNewToolInput(e.target.value)}
                placeholder="Afegir eina o competència…"
                aria-label="Afegir eina addicional"
                className="flex-1 rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] px-2.5 py-1 text-xs"
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={!newToolInput.trim()}
                onClick={() => {
                  const val = newToolInput.trim();
                  if (!val) return;
                  onChange((prev) => ({
                    ...prev,
                    extraToolProfs: prev.extraToolProfs.includes(val)
                      ? prev.extraToolProfs
                      : [...prev.extraToolProfs, val],
                  }));
                  setNewToolInput('');
                }}
              >
                Afegir
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
              Idiomes ({race?.languages.join(', ') || 'Comú'}
              {extraLanguageSlots > 0 ? ` + ${extraLanguageSlots} addicional(s)` : ''})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DND5E_LANGUAGES_CA.map((lang) => {
                const isFixed = race?.languages.includes(lang) ?? false;
                const checked = isFixed || state.extraLanguages.includes(lang);
                return (
                  <button
                    key={lang}
                    type="button"
                    disabled={isFixed}
                    aria-pressed={checked}
                    onClick={() => toggleExtraLanguage(lang)}
                    className={`rounded-full border px-2 py-0.5 text-[11px] cursor-pointer disabled:opacity-75 ${
                      checked
                        ? 'border-[var(--rol-accent-gold)] bg-[var(--rol-accent-gold-soft)]/50 font-semibold text-[var(--rol-ink-primary)]'
                        : 'border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] text-[var(--rol-ink-secondary)]'
                    }`}
                  >
                    {lang}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newLangInput}
                onChange={(e) => setNewLangInput(e.target.value)}
                placeholder="Altre idioma…"
                aria-label="Afegir altre idioma"
                className="flex-1 rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] px-2.5 py-1 text-xs"
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={!newLangInput.trim()}
                onClick={() => {
                  const val = newLangInput.trim();
                  if (!val) return;
                  onChange((prev) => ({
                    ...prev,
                    extraLanguages: prev.extraLanguages.includes(val)
                      ? prev.extraLanguages
                      : [...prev.extraLanguages, val],
                  }));
                  setNewLangInput('');
                }}
              >
                Afegir
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
