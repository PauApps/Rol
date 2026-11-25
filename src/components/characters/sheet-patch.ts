import {
  ABILITY_KEYS,
  HIT_DIE_KEYS,
  SKILL_IDS,
  type AbilityKey,
  type Dnd5e2014AttackEntry,
  type Dnd5e2014HitDiceUsedByDie,
  type RollMode,
  type SkillId,
} from '@/domain/systems/dnd5e-2014';
import { canEditSheetField, type SheetAccessContext } from './sheet-permissions';
import type { CharacterSheetDraft, CharacterSheetRecord } from './types';

export function createDraftFromCharacter(record: CharacterSheetRecord): CharacterSheetDraft {
  const s = record.sheetData;
  return {
    name: record.name,
    abilities: { ...s.abilities },
    savingThrows: {
      proficient: [...s.savingThrows.proficient],
      rollModes: { ...s.savingThrows.rollModes },
      overrides: { ...s.savingThrows.overrides },
    },
    skills: {
      proficient: [...s.skills.proficient],
      expertise: [...s.skills.expertise],
      halfProficient: s.skills.halfProficient,
      rollModes: { ...s.skills.rollModes },
      overrides: { ...s.skills.overrides },
    },
    hitPoints: {
      max: s.hitPoints.max,
      current: s.hitPoints.current,
      temporary: s.hitPoints.temporary,
      hitDiceUsed: s.hitPoints.hitDiceUsed,
      hitDiceUsedByDie: s.hitPoints.hitDiceUsedByDie ? { ...s.hitPoints.hitDiceUsedByDie } : null,
      deathSaves: {
        successes: s.hitPoints.deathSaves.successes,
        failures: s.hitPoints.deathSaves.failures,
      },
    },
    armorClass: {
      unarmoredFormula: s.armorClass.unarmoredFormula,
      notes: s.armorClass.notes,
      override: s.armorClass.override,
    },
    initiative: {
      bonus: s.initiative.bonus,
      override: s.initiative.override,
    },
    speed: {
      walk: s.speed.walk,
      fly: s.speed.fly,
      swim: s.speed.swim,
      climb: s.speed.climb,
    },
    attacks: s.attacks.map((atk) => ({ ...atk })),
  };
}

function sameStringSet(a: readonly string[], b: readonly string[]): boolean {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size !== setB.size) return false;
  for (const item of setA) {
    if (!setB.has(item)) return false;
  }
  return true;
}

function sameAttackEntry(a: Dnd5e2014AttackEntry, b: Dnd5e2014AttackEntry): boolean {
  return (
    a.id === b.id &&
    a.inventoryItemId === b.inventoryItemId &&
    a.kind === b.kind &&
    a.spellSourceClassId === b.spellSourceClassId &&
    a.name === b.name &&
    a.ability === b.ability &&
    a.abilityOverride === b.abilityOverride &&
    a.proficient === b.proficient &&
    a.proficientOverride === b.proficientOverride &&
    a.bonusOverride === b.bonusOverride &&
    a.attackBonus === b.attackBonus &&
    a.damage === b.damage &&
    a.damageType === b.damageType &&
    a.range === b.range &&
    a.notes === b.notes
  );
}

function sameAttacksArray(
  a: readonly Dnd5e2014AttackEntry[],
  b: readonly Dnd5e2014AttackEntry[]
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!sameAttackEntry(a[i], b[i])) return false;
  }
  return true;
}

function sanitizeAttacksForActor(
  baseAttacks: readonly Dnd5e2014AttackEntry[],
  draftAttacks: readonly Dnd5e2014AttackEntry[],
  access: SheetAccessContext
): Dnd5e2014AttackEntry[] {
  if (access.isGm) {
    return draftAttacks.map((atk) => ({ ...atk }));
  }

  const baseById = new Map(baseAttacks.map((a) => [a.id, a]));
  const canAbilityOverride = canEditSheetField('attacks.ability', access);
  const canProfOverride = canEditSheetField('attacks.proficient', access);
  const canBonusOverride = canEditSheetField('attacks.bonusOverride', access);
  const canTextBonus = canEditSheetField('attacks.attackBonus', access);
  const canGmCustom = canEditSheetField('attacks.gmCustom', access);

  const result: Dnd5e2014AttackEntry[] = [];

  // Preserve locked GM custom attacks & inventory weapon overrides untouched when player lacks override permissions
  for (const prev of baseAttacks) {
    if (prev.kind === 'gm_custom' && !canGmCustom) {
      result.push({ ...prev });
    } else if (prev.inventoryItemId !== null) {
      result.push({ ...prev });
    }
  }

  for (const atk of draftAttacks) {
    if (atk.inventoryItemId !== null) {
      continue;
    }
    if (atk.kind === 'gm_custom') {
      if (canGmCustom) {
        result.push({ ...atk });
      }
      continue;
    }

    const prev = baseById.get(atk.id);
    const abilityOverride = canAbilityOverride ? atk.abilityOverride : (prev?.abilityOverride ?? null);
    const proficientOverride = canProfOverride
      ? atk.proficientOverride
      : (prev?.proficientOverride ?? null);
    const bonusOverride = canBonusOverride ? atk.bonusOverride : (prev?.bonusOverride ?? null);
    const attackBonus = canTextBonus ? atk.attackBonus : (prev?.attackBonus ?? null);

    let safeAbility: AbilityKey | null = atk.ability;
    let safeProficient = atk.proficient;

    if (atk.kind === 'special') {
      if (!canAbilityOverride) {
        safeAbility = prev?.kind === 'special' ? prev.ability : null;
      }
      if (!canProfOverride) {
        safeProficient = prev?.kind === 'special' ? prev.proficient : false;
      }
    } else if (atk.kind === 'spell') {
      if (!canAbilityOverride) {
        safeAbility = null;
      }
      if (!canProfOverride) {
        safeProficient = false;
      }
    } else if (atk.kind === 'unarmed') {
      if (!canProfOverride) {
        safeProficient = false;
      }
    }

    result.push({
      ...atk,
      ability: safeAbility,
      abilityOverride,
      proficient: safeProficient,
      proficientOverride,
      bonusOverride,
      attackBonus,
    });
  }

  return result;
}

export interface BuiltCharacterSheetPatch {
  payload: Record<string, unknown>;
  hasChanges: boolean;
  changedLabels: string[];
}

/**
 * Builds a minimal PATCH payload containing strictly modified and authorized fields,
 * never overwriting untouched sheet sections or inventing legacy hit dice splits.
 */
export function buildCharacterSheetPatch(
  base: CharacterSheetRecord,
  draft: CharacterSheetDraft,
  access: SheetAccessContext
): BuiltCharacterSheetPatch {
  const payload: Record<string, unknown> = {};
  const sheetPatch: Record<string, unknown> = {};
  const changedLabels: string[] = [];

  const trimmedName = draft.name.trim();
  if (canEditSheetField('name', access) && trimmedName.length > 0 && trimmedName !== base.name) {
    payload.name = trimmedName;
    changedLabels.push('Nom');
  }

  // 1. Abilities
  const abilitiesPatch: Partial<Record<AbilityKey, number | null>> = {};
  for (const key of ABILITY_KEYS) {
    if (
      canEditSheetField(`abilities.${key}`, access) &&
      draft.abilities[key] !== base.sheetData.abilities[key]
    ) {
      abilitiesPatch[key] = draft.abilities[key];
    }
  }
  if (Object.keys(abilitiesPatch).length > 0) {
    sheetPatch.abilities = abilitiesPatch;
    changedLabels.push('Característiques');
  }

  // 2. Saving throws
  const stPatch: Record<string, unknown> = {};
  if (
    canEditSheetField('savingThrows.proficient', access) &&
    !sameStringSet(base.sheetData.savingThrows.proficient, draft.savingThrows.proficient)
  ) {
    stPatch.proficient = Array.from(new Set(draft.savingThrows.proficient));
  }
  if (canEditSheetField('savingThrows.rollModes', access)) {
    const rollModesPatch: Partial<Record<AbilityKey, RollMode>> = {};
    for (const key of ABILITY_KEYS) {
      const nextMode = draft.savingThrows.rollModes[key] ?? 'normal';
      const prevMode = base.sheetData.savingThrows.rollModes[key] ?? 'normal';
      if (nextMode !== prevMode) {
        rollModesPatch[key] = nextMode;
      }
    }
    if (Object.keys(rollModesPatch).length > 0) {
      stPatch.rollModes = rollModesPatch;
    }
  }
  if (canEditSheetField('savingThrows.overrides', access)) {
    const overridesPatch: Partial<Record<AbilityKey, number | null>> = {};
    for (const key of ABILITY_KEYS) {
      const nextVal = draft.savingThrows.overrides[key] ?? null;
      const prevVal = base.sheetData.savingThrows.overrides[key] ?? null;
      if (nextVal !== prevVal) {
        overridesPatch[key] = nextVal;
      }
    }
    if (Object.keys(overridesPatch).length > 0) {
      stPatch.overrides = overridesPatch;
    }
  }
  if (Object.keys(stPatch).length > 0) {
    sheetPatch.savingThrows = stPatch;
    changedLabels.push('Salvacions');
  }

  // 3. Skills
  const skPatch: Record<string, unknown> = {};
  if (
    canEditSheetField('skills.proficient', access) &&
    !sameStringSet(base.sheetData.skills.proficient, draft.skills.proficient)
  ) {
    skPatch.proficient = Array.from(new Set(draft.skills.proficient));
  }
  if (
    canEditSheetField('skills.expertise', access) &&
    !sameStringSet(base.sheetData.skills.expertise, draft.skills.expertise)
  ) {
    skPatch.expertise = Array.from(new Set(draft.skills.expertise));
  }
  if (
    canEditSheetField('skills.halfProficient', access) &&
    draft.skills.halfProficient !== base.sheetData.skills.halfProficient
  ) {
    skPatch.halfProficient = draft.skills.halfProficient;
  }
  if (canEditSheetField('skills.rollModes', access)) {
    const rollModesPatch: Partial<Record<SkillId, RollMode>> = {};
    for (const skillId of SKILL_IDS) {
      const nextMode = draft.skills.rollModes[skillId] ?? 'normal';
      const prevMode = base.sheetData.skills.rollModes[skillId] ?? 'normal';
      if (nextMode !== prevMode) {
        rollModesPatch[skillId] = nextMode;
      }
    }
    if (Object.keys(rollModesPatch).length > 0) {
      skPatch.rollModes = rollModesPatch;
    }
  }
  if (canEditSheetField('skills.overrides', access)) {
    const overridesPatch: Partial<Record<SkillId, number | null>> = {};
    for (const skillId of SKILL_IDS) {
      const nextVal = draft.skills.overrides[skillId] ?? null;
      const prevVal = base.sheetData.skills.overrides[skillId] ?? null;
      if (nextVal !== prevVal) {
        overridesPatch[skillId] = nextVal;
      }
    }
    if (Object.keys(overridesPatch).length > 0) {
      skPatch.overrides = overridesPatch;
    }
  }
  if (Object.keys(skPatch).length > 0) {
    sheetPatch.skills = skPatch;
    changedLabels.push('Habilitats');
  }

  // 4. Hit Points, Hit Dice, and Death Saves
  const hpPatch: Record<string, unknown> = {};
  for (const hpKey of ['max', 'current', 'temporary'] as const) {
    if (
      canEditSheetField(`hitPoints.${hpKey}`, access) &&
      draft.hitPoints[hpKey] !== base.sheetData.hitPoints[hpKey]
    ) {
      hpPatch[hpKey] = draft.hitPoints[hpKey];
    }
  }
  if (canEditSheetField('hitPoints.deathSaves', access)) {
    const dsPatch: Record<string, number> = {};
    if (draft.hitPoints.deathSaves.successes !== base.sheetData.hitPoints.deathSaves.successes) {
      dsPatch.successes = draft.hitPoints.deathSaves.successes;
    }
    if (draft.hitPoints.deathSaves.failures !== base.sheetData.hitPoints.deathSaves.failures) {
      dsPatch.failures = draft.hitPoints.deathSaves.failures;
    }
    if (Object.keys(dsPatch).length > 0) {
      hpPatch.deathSaves = dsPatch;
    }
  }

  const baseByDie = base.sheetData.hitPoints.hitDiceUsedByDie;
  if (baseByDie !== null) {
    if (
      canEditSheetField('hitPoints.hitDiceUsedByDie', access) &&
      canEditSheetField('hitPoints.hitDiceUsed', access) &&
      draft.hitPoints.hitDiceUsedByDie !== null
    ) {
      const byDieDiff: Dnd5e2014HitDiceUsedByDie = {};
      for (const dieKey of HIT_DIE_KEYS) {
        const nextVal = Math.max(0, Math.floor(draft.hitPoints.hitDiceUsedByDie[dieKey] ?? 0));
        const prevVal = Math.max(0, Math.floor(baseByDie[dieKey] ?? 0));
        if (nextVal !== prevVal) {
          byDieDiff[dieKey] = nextVal;
        }
      }
      if (Object.keys(byDieDiff).length > 0) {
        hpPatch.hitDiceUsedByDie = byDieDiff;
      }
    }
  } else if (
    canEditSheetField('hitPoints.hitDiceUsed', access) &&
    draft.hitPoints.hitDiceUsed !== base.sheetData.hitPoints.hitDiceUsed
  ) {
    // Legacy sheet with unallocated split: never invent hitDiceUsedByDie
    hpPatch.hitDiceUsed = draft.hitPoints.hitDiceUsed;
  }

  if (Object.keys(hpPatch).length > 0) {
    sheetPatch.hitPoints = hpPatch;
    changedLabels.push('Punts i daus de cop');
  }

  // 5. Armor Class
  const acPatch: Record<string, unknown> = {};
  if (
    canEditSheetField('armorClass.unarmoredFormula', access) &&
    draft.armorClass.unarmoredFormula !== base.sheetData.armorClass.unarmoredFormula
  ) {
    acPatch.unarmoredFormula = draft.armorClass.unarmoredFormula;
  }
  if (
    canEditSheetField('armorClass.notes', access) &&
    draft.armorClass.notes !== base.sheetData.armorClass.notes
  ) {
    acPatch.notes = draft.armorClass.notes;
  }
  if (
    canEditSheetField('armorClass.override', access) &&
    draft.armorClass.override !== base.sheetData.armorClass.override
  ) {
    acPatch.override = draft.armorClass.override;
  }
  if (Object.keys(acPatch).length > 0) {
    sheetPatch.armorClass = acPatch;
    changedLabels.push("Classe d'armadura");
  }

  // 6. Initiative
  const initPatch: Record<string, unknown> = {};
  if (
    canEditSheetField('initiative.bonus', access) &&
    draft.initiative.bonus !== base.sheetData.initiative.bonus
  ) {
    initPatch.bonus = draft.initiative.bonus;
  }
  if (
    canEditSheetField('initiative.override', access) &&
    draft.initiative.override !== base.sheetData.initiative.override
  ) {
    initPatch.override = draft.initiative.override;
  }
  if (Object.keys(initPatch).length > 0) {
    sheetPatch.initiative = initPatch;
    changedLabels.push('Iniciativa');
  }

  // 7. Speed
  const speedPatch: Record<string, number | null> = {};
  for (const spdKey of ['walk', 'fly', 'swim', 'climb'] as const) {
    if (
      canEditSheetField(`speed.${spdKey}`, access) &&
      draft.speed[spdKey] !== base.sheetData.speed[spdKey]
    ) {
      speedPatch[spdKey] = draft.speed[spdKey];
    }
  }
  if (Object.keys(speedPatch).length > 0) {
    sheetPatch.speed = speedPatch;
    changedLabels.push('Velocitat');
  }

  // 8. Attacks
  if (canEditSheetField('attacks', access)) {
    const sanitizedAttacks = sanitizeAttacksForActor(
      base.sheetData.attacks,
      draft.attacks,
      access
    );
    if (!sameAttacksArray(base.sheetData.attacks, sanitizedAttacks)) {
      sheetPatch.attacks = sanitizedAttacks;
      changedLabels.push('Atacs');
    }
  }

  if (Object.keys(sheetPatch).length > 0) {
    payload.sheetPatch = sheetPatch;
  }

  return {
    payload,
    hasChanges: changedLabels.length > 0,
    changedLabels,
  };
}
