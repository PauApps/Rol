'use client';

import type {
  AbilityKey,
  Dnd5e2014AttackEntry,
  HitDieKey,
  RollMode,
  SkillId,
} from '@/domain/systems/dnd5e-2014';
import type { SheetAccessContext } from '../sheet-permissions';
import type { CharacterSheetDraft, CharacterSheetRecord } from '../types';
import { AbilityScoresGrid } from './AbilityScoresGrid';
import { AttacksCard } from './AttacksCard';
import { CombatVitalsCard } from './CombatVitalsCard';
import { SavingThrowsCard } from './SavingThrowsCard';
import { SkillsCard } from './SkillsCard';

interface CombatStatsTabProps {
  character: CharacterSheetRecord;
  draft: CharacterSheetDraft;
  access: SheetAccessContext;
  onUpdateDraft: (updater: (prev: CharacterSheetDraft) => CharacterSheetDraft) => void;
}

export function CombatStatsTab({
  character,
  draft,
  access,
  onUpdateDraft,
}: CombatStatsTabProps) {
  const { computed, sheetData } = character;

  function handleAbilityScoreChange(key: AbilityKey, nextScore: number | null) {
    onUpdateDraft((prev) => ({
      ...prev,
      abilities: { ...prev.abilities, [key]: nextScore },
    }));
  }

  function handleToggleSaveProf(ability: AbilityKey) {
    onUpdateDraft((prev) => {
      const exists = prev.savingThrows.proficient.includes(ability);
      return {
        ...prev,
        savingThrows: {
          ...prev.savingThrows,
          proficient: exists
            ? prev.savingThrows.proficient.filter((a) => a !== ability)
            : [...prev.savingThrows.proficient, ability],
        },
      };
    });
  }

  function handleSaveRollMode(ability: AbilityKey, mode: RollMode) {
    onUpdateDraft((prev) => ({
      ...prev,
      savingThrows: {
        ...prev.savingThrows,
        rollModes: { ...prev.savingThrows.rollModes, [ability]: mode },
      },
    }));
  }

  function handleSaveOverride(ability: AbilityKey, value: number | null) {
    onUpdateDraft((prev) => {
      const nextOverrides = { ...prev.savingThrows.overrides };
      if (value === null) {
        delete nextOverrides[ability];
      } else {
        nextOverrides[ability] = value;
      }
      return {
        ...prev,
        savingThrows: { ...prev.savingThrows, overrides: nextOverrides },
      };
    });
  }

  function handleSetSkillProfLevel(
    skillId: SkillId,
    level: 'none' | 'proficient' | 'expertise'
  ) {
    onUpdateDraft((prev) => {
      let proficient = prev.skills.proficient.filter((id) => id !== skillId);
      let expertise = prev.skills.expertise.filter((id) => id !== skillId);
      if (level === 'proficient') {
        proficient = [...proficient, skillId];
      } else if (level === 'expertise') {
        proficient = [...proficient, skillId];
        expertise = [...expertise, skillId];
      }
      return {
        ...prev,
        skills: { ...prev.skills, proficient, expertise },
      };
    });
  }

  function handleToggleHalfProf(next: boolean) {
    onUpdateDraft((prev) => ({
      ...prev,
      skills: { ...prev.skills, halfProficient: next },
    }));
  }

  function handleSkillRollMode(skillId: SkillId, mode: RollMode) {
    onUpdateDraft((prev) => ({
      ...prev,
      skills: {
        ...prev.skills,
        rollModes: { ...prev.skills.rollModes, [skillId]: mode },
      },
    }));
  }

  function handleSkillOverride(skillId: SkillId, value: number | null) {
    onUpdateDraft((prev) => {
      const nextOverrides = { ...prev.skills.overrides };
      if (value === null) {
        delete nextOverrides[skillId];
      } else {
        nextOverrides[skillId] = value;
      }
      return {
        ...prev,
        skills: { ...prev.skills, overrides: nextOverrides },
      };
    });
  }

  function handleHpChange(field: 'current' | 'max' | 'temporary', value: number | null) {
    onUpdateDraft((prev) => ({
      ...prev,
      hitPoints: { ...prev.hitPoints, [field]: value },
    }));
  }

  function handleDeathSaveChange(kind: 'successes' | 'failures', count: number) {
    onUpdateDraft((prev) => ({
      ...prev,
      hitPoints: {
        ...prev.hitPoints,
        deathSaves: { ...prev.hitPoints.deathSaves, [kind]: count },
      },
    }));
  }

  function handleHitDieSpent(dieKey: HitDieKey, spent: number) {
    onUpdateDraft((prev) => ({
      ...prev,
      hitPoints: {
        ...prev.hitPoints,
        hitDiceUsedByDie: { ...(prev.hitPoints.hitDiceUsedByDie ?? {}), [dieKey]: spent },
      },
    }));
  }

  function handleLegacyHitDiceUsed(spent: number) {
    onUpdateDraft((prev) => ({
      ...prev,
      hitPoints: { ...prev.hitPoints, hitDiceUsed: spent },
    }));
  }

  function handleSpeedChange(field: 'walk' | 'fly' | 'swim' | 'climb', value: number | null) {
    onUpdateDraft((prev) => ({
      ...prev,
      speed: { ...prev.speed, [field]: value },
    }));
  }

  function handleArmorClassChange(patch: Partial<CharacterSheetDraft['armorClass']>) {
    onUpdateDraft((prev) => ({
      ...prev,
      armorClass: { ...prev.armorClass, ...patch },
    }));
  }

  function handleInitiativeChange(patch: Partial<CharacterSheetDraft['initiative']>) {
    onUpdateDraft((prev) => ({
      ...prev,
      initiative: { ...prev.initiative, ...patch },
    }));
  }

  function handleAttacksChange(nextAttacks: Dnd5e2014AttackEntry[]) {
    onUpdateDraft((prev) => ({
      ...prev,
      attacks: nextAttacks,
    }));
  }

  return (
    <div
      role="tabpanel"
      id="panel-combat"
      aria-labelledby="tab-combat"
      className="space-y-6"
    >
      {/* Bloc superior: Les 6 característiques */}
      <AbilityScoresGrid
        computedAbilities={computed.abilities}
        savedAbilities={sheetData.abilities}
        draftAbilities={draft.abilities}
        access={access}
        onChangeScore={handleAbilityScoreChange}
      />

      {/* Distribució responsive en columnes (escriptori 12 cols, tauleta/mòbil apilat) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        <div className="space-y-6 lg:col-span-5">
          <SavingThrowsCard
            computedSavingThrows={computed.savingThrows}
            draftProficient={draft.savingThrows.proficient}
            draftRollModes={draft.savingThrows.rollModes}
            draftOverrides={draft.savingThrows.overrides}
            access={access}
            onToggleProficient={handleToggleSaveProf}
            onChangeRollMode={handleSaveRollMode}
            onChangeOverride={handleSaveOverride}
          />

          <CombatVitalsCard
            computed={computed}
            draft={draft}
            access={access}
            onChangeHp={handleHpChange}
            onChangeDeathSave={handleDeathSaveChange}
            onChangeHitDieSpent={handleHitDieSpent}
            onChangeLegacyHitDiceUsed={handleLegacyHitDiceUsed}
            onChangeSpeed={handleSpeedChange}
            onChangeArmorClass={handleArmorClassChange}
            onChangeInitiative={handleInitiativeChange}
          />
        </div>

        <div className="space-y-6 lg:col-span-7">
          <SkillsCard
            computedSkills={computed.skills}
            passives={computed.passives}
            draftProficient={draft.skills.proficient}
            draftExpertise={draft.skills.expertise}
            draftHalfProficient={draft.skills.halfProficient}
            draftRollModes={draft.skills.rollModes}
            draftOverrides={draft.skills.overrides}
            access={access}
            onSetProficiencyLevel={handleSetSkillProfLevel}
            onToggleHalfProficient={handleToggleHalfProf}
            onChangeRollMode={handleSkillRollMode}
            onChangeOverride={handleSkillOverride}
          />

          <AttacksCard
            computedAttacks={computed.combat.attacks}
            spellcasting={computed.spellcasting}
            classes={sheetData.raceAndClass.classes}
            savedAttacks={sheetData.attacks}
            draftAttacks={draft.attacks}
            access={access}
            onChangeAttacks={handleAttacksChange}
          />
        </div>
      </div>
    </div>
  );
}
