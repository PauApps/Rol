'use client';

import {
  DND5E_ALIGNMENTS_CA,
  DND5E_CLASSES,
  DND5E_RACES,
  DND5E_SUBCLASSES,
  getClassEntry,
  getRaceEntry,
  normalizeMatchText,
  resolveClassId,
} from '@/domain/systems/dnd5e-2014';
import type { CampaignCreationConfig } from '@/domain/campaigns/creation-config';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { InputField, SelectField, TextareaField } from '@/components/ui/Field';
import {
  buildDefaultEquipmentSelections,
  buildStarterInventoryList,
  type CharacterWizardState,
} from './wizard-state';

export interface CampaignMemberOption {
  id: string;
  displayName: string;
}

interface StepIdentityProps {
  state: CharacterWizardState;
  config: CampaignCreationConfig;
  isGm: boolean;
  members: readonly CampaignMemberOption[];
  onChange: (updater: (prev: CharacterWizardState) => CharacterWizardState) => void;
}

export function StepIdentity({
  state,
  config,
  isGm,
  members,
  onChange,
}: StepIdentityProps) {
  const selectedRace = getRaceEntry(state.raceId);
  const selectedClass = getClassEntry(state.classId);
  const availableSubclasses = DND5E_SUBCLASSES.filter((s) => s.classId === state.classId);
  const subclassUnlocked =
    state.classMode === 'official' &&
    selectedClass !== undefined &&
    state.level >= selectedClass.subclassLevel;

  const isRaceAllowed = (labelOrId: string): boolean => {
    if (config.allowedRaces.length === 0) return true;
    const entry = getRaceEntry(labelOrId);
    return config.allowedRaces.some(
      (a) =>
        normalizeMatchText(a) === normalizeMatchText(labelOrId) ||
        (entry && getRaceEntry(a)?.id === entry.id)
    );
  };

  const isClassAllowed = (classId: string, labelCa: string): boolean => {
    if (config.allowedClasses.length === 0) return true;
    return config.allowedClasses.some((a) => {
      const resolved = resolveClassId(a);
      if (resolved !== 'custom' && resolved === classId) return true;
      return normalizeMatchText(a) === normalizeMatchText(labelCa);
    });
  };

  const levelLocked = config.freedomMode === 'strict' && !isGm;
  const allowCustomRace =
    config.allowedRaces.length === 0 || config.freedomMode !== 'strict' || isGm;
  const allowCustomClass =
    config.allowedClasses.length === 0 || config.freedomMode !== 'strict' || isGm;

  return (
    <Card
      title="Pas 1 · Identitat del personatge"
      subtitle="Defineix el nom, la raça, la classe i el nivell inicial segons les regles de la campanya."
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField
            label="Nom del personatge *"
            htmlFor="wizard-char-name"
            type="text"
            required
            maxLength={100}
            value={state.name}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="Ex. Lyra Ventargent"
          />

          {isGm ? (
            <SelectField
              label="Assignar a jugador (opcional)"
              htmlFor="wizard-char-owner"
              value={state.memberId ?? ''}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  memberId: e.target.value || null,
                }))
              }
            >
              <option value="">Sense jugador (Personatge del GM)</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </SelectField>
          ) : (
            <SelectField
              label={`Alineament${config.requiredFields.includes('alignment') ? ' *' : ''}`}
              htmlFor="wizard-char-alignment"
              value={state.alignment}
              onChange={(e) =>
                onChange((prev) => ({ ...prev, alignment: e.target.value }))
              }
            >
              <option value="">Sense especificar</option>
              {DND5E_ALIGNMENTS_CA.map((al) => (
                <option key={al} value={al}>
                  {al}
                </option>
              ))}
            </SelectField>
          )}
        </div>

        {isGm && (
          <SelectField
            label={`Alineament${config.requiredFields.includes('alignment') ? ' *' : ''}`}
            htmlFor="wizard-char-alignment"
            value={state.alignment}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, alignment: e.target.value }))
            }
          >
            <option value="">Sense especificar</option>
            {DND5E_ALIGNMENTS_CA.map((al) => (
              <option key={al} value={al}>
                {al}
              </option>
            ))}
          </SelectField>
        )}

        {/* Raça i Subraça */}
        <div className="rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/35 p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--rol-ink-primary)]">
              Raça i llinatge {config.requiredFields.includes('race') ? '*' : ''}
            </span>
            {allowCustomRace && (
              <button
                type="button"
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    raceMode: prev.raceMode === 'catalog' ? 'custom' : 'catalog',
                    flexibleRacialAbilities: [],
                  }))
                }
                className="text-xs font-medium text-[var(--rol-accent-primary)] underline cursor-pointer"
              >
                {state.raceMode === 'catalog' ? 'Introduir raça personalitzada' : 'Triar del catàleg D&D 5e'}
              </button>
            )}
          </div>

          {state.raceMode === 'catalog' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Raça (PHB 2014)"
                htmlFor="wizard-race-select"
                value={state.raceId}
                onChange={(e) => {
                  const nextRace = getRaceEntry(e.target.value);
                  onChange((prev) => ({
                    ...prev,
                    raceId: e.target.value,
                    subraceId: nextRace?.subraces[0]?.id ?? '',
                    flexibleRacialAbilities: [],
                    racialExtraSkills: [],
                  }));
                }}
              >
                {DND5E_RACES.map((r) => {
                  const allowed = isRaceAllowed(r.labelCa);
                  if (!allowed && config.freedomMode === 'strict' && !isGm) {
                    return null;
                  }
                  return (
                    <option key={r.id} value={r.id}>
                      {r.labelCa}
                      {!allowed ? ' (fora de recomanació)' : ''}
                    </option>
                  );
                })}
              </SelectField>

              {selectedRace && selectedRace.subraces.length > 0 ? (
                <SelectField
                  label="Subraça / Llinatge"
                  htmlFor="wizard-subrace-select"
                  value={state.subraceId}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      subraceId: e.target.value,
                      flexibleRacialAbilities: [],
                      racialExtraSkills: [],
                    }))
                  }
                >
                  {selectedRace.subraces.map((sr) => (
                    <option key={sr.id} value={sr.id}>
                      {sr.labelCa}
                    </option>
                  ))}
                </SelectField>
              ) : (
                <div className="flex items-end pb-2 text-xs text-[var(--rol-ink-muted)]">
                  Aquesta raça no té subraces diferenciades al manual bàsic.
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <InputField
                label="Nom de la raça"
                htmlFor="wizard-custom-race"
                type="text"
                value={state.customRace}
                onChange={(e) =>
                  onChange((prev) => ({ ...prev, customRace: e.target.value }))
                }
                placeholder="Ex. Genasi d’aigua"
              />
              <InputField
                label="Subraça (opcional)"
                htmlFor="wizard-custom-subrace"
                type="text"
                value={state.customSubrace}
                onChange={(e) =>
                  onChange((prev) => ({ ...prev, customSubrace: e.target.value }))
                }
              />
            </div>
          )}

          {state.raceMode === 'catalog' && selectedRace && (
            <div className="flex flex-wrap gap-1.5 text-xs">
              <Badge tone="neutral">Mida: {selectedRace.size}</Badge>
              <Badge tone="neutral">Velocitat: {selectedRace.speedWalk} m</Badge>
              {selectedRace.senses && <Badge tone="gold">{selectedRace.senses}</Badge>}
            </div>
          )}
        </div>

        {/* Classe, Subclasse i Nivell */}
        <div className="rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/35 p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--rol-ink-primary)]">
              Classe i nivell inicial *
            </span>
            {allowCustomClass && (
              <button
                type="button"
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    classMode: prev.classMode === 'official' ? 'custom' : 'official',
                  }))
                }
                className="text-xs font-medium text-[var(--rol-accent-primary)] underline cursor-pointer"
              >
                {state.classMode === 'official' ? 'Usar classe personalitzada' : 'Triar classe oficial'}
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {state.classMode === 'official' ? (
              <>
                <SelectField
                  label="Classe oficial (12)"
                  htmlFor="wizard-class-select"
                  value={state.classId}
                  onChange={(e) => {
                    const nextClassId = e.target.value;
                    const nextMeta = getClassEntry(nextClassId);
                    const nextSubList = DND5E_SUBCLASSES.filter((s) => s.classId === nextClassId);
                    const nextSelections = buildDefaultEquipmentSelections(nextClassId);
                    onChange((prev) => ({
                      ...prev,
                      classId: nextClassId,
                      subclassId:
                        nextMeta && prev.level >= nextMeta.subclassLevel
                          ? (nextSubList[0]?.id ?? '')
                          : '',
                      classSkills: [],
                      fightingStyleId: null,
                      initialSpells: [],
                      equipmentSelections: nextSelections,
                      starterInventory: buildStarterInventoryList({
                        classId: nextClassId,
                        classMode: 'official',
                        equipmentSelections: nextSelections,
                        backgroundId: prev.backgroundId,
                        backgroundMode: prev.backgroundMode,
                      }),
                    }));
                  }}
                >
                  {DND5E_CLASSES.map((c) => {
                    const allowed = isClassAllowed(c.id, c.labelCa);
                    if (!allowed && config.freedomMode === 'strict' && !isGm) {
                      return null;
                    }
                    return (
                      <option key={c.id} value={c.id}>
                        {c.labelCa} (d{c.hitDie})
                        {!allowed ? ' — fora de llista' : ''}
                      </option>
                    );
                  })}
                </SelectField>

                <SelectField
                  label={
                    subclassUnlocked
                      ? 'Subclasse'
                      : `Subclasse (desbl. niv. ${selectedClass?.subclassLevel ?? 3})`
                  }
                  htmlFor="wizard-subclass-select"
                  disabled={!subclassUnlocked}
                  value={subclassUnlocked ? state.subclassId : ''}
                  onChange={(e) =>
                    onChange((prev) => ({ ...prev, subclassId: e.target.value }))
                  }
                >
                  {!subclassUnlocked ? (
                    <option value="">Disponible al nivell {selectedClass?.subclassLevel ?? 3}</option>
                  ) : (
                    <>
                      <option value="">Sense subclasse definida</option>
                      {availableSubclasses.map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {sc.labelCa}
                        </option>
                      ))}
                    </>
                  )}
                </SelectField>
              </>
            ) : (
              <>
                <InputField
                  label="Nom classe personalitzada"
                  htmlFor="wizard-custom-class"
                  type="text"
                  value={state.customClassName}
                  onChange={(e) =>
                    onChange((prev) => ({ ...prev, customClassName: e.target.value }))
                  }
                />
                <InputField
                  label="Subclasse (opcional)"
                  htmlFor="wizard-custom-subclass"
                  type="text"
                  value={state.customSubclassName}
                  onChange={(e) =>
                    onChange((prev) => ({ ...prev, customSubclassName: e.target.value }))
                  }
                />
              </>
            )}

            <InputField
              label="Nivell inicial (1–20)"
              htmlFor="wizard-level-input"
              type="number"
              min={1}
              max={20}
              disabled={levelLocked}
              hint={
                levelLocked
                  ? `Fixat a nivell ${config.startingLevel} pel mode estricte.`
                  : `Nivell recomanat de campanya: ${config.startingLevel}.`
              }
              value={state.level}
              onChange={(e) => {
                const lvl = Math.min(20, Math.max(1, Math.trunc(Number(e.target.value) || 1)));
                onChange((prev) => {
                  const meta = getClassEntry(prev.classId);
                  const subOk = meta && lvl >= meta.subclassLevel;
                  const subList = DND5E_SUBCLASSES.filter((s) => s.classId === prev.classId);
                  return {
                    ...prev,
                    level: lvl,
                    subclassId: subOk ? (prev.subclassId || subList[0]?.id || '') : '',
                  };
                });
              }}
            />
          </div>
        </div>

        {(config.requiredFields.includes('appearanceNotes') ||
          config.requiredFields.includes('backstory')) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {config.requiredFields.includes('appearanceNotes') && (
              <TextareaField
                label="Descripció i aspecte *"
                htmlFor="wizard-appearance"
                rows={2}
                value={state.appearanceNotes}
                onChange={(e) =>
                  onChange((prev) => ({ ...prev, appearanceNotes: e.target.value }))
                }
                placeholder="Camp requerit per aquesta campanya…"
              />
            )}
            {config.requiredFields.includes('backstory') && (
              <TextareaField
                label="Història personal *"
                htmlFor="wizard-backstory"
                rows={2}
                value={state.backstory}
                onChange={(e) =>
                  onChange((prev) => ({ ...prev, backstory: e.target.value }))
                }
                placeholder="Camp requerit per aquesta campanya…"
              />
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
