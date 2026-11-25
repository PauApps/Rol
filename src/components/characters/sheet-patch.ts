import {
  ABILITY_KEYS,
  HIT_DIE_KEYS,
  SKILL_IDS,
  SPELL_SLOT_KEYS,
  getAllowedOfficialWeaponAbilities,
  type AbilityKey,
  type Dnd5e2014AttackEntry,
  type Dnd5e2014CustomResource,
  type Dnd5e2014HitDiceUsedByDie,
  type Dnd5e2014InventoryItem,
  type Dnd5e2014SpellEntry,
  type Dnd5e2014SpellcastingSourceOverride,
  type Dnd5e2014TraitEntry,
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
    spellcasting: {
      abilityOverride: s.spellcasting.abilityOverride,
      saveDcOverride: s.spellcasting.saveDcOverride,
      attackBonusOverride: s.spellcasting.attackBonusOverride,
      sourceOverrides: structuredClone(s.spellcasting.sourceOverrides ?? {}),
      usesSpellbook: s.spellcasting.usesSpellbook,
      notes: s.spellcasting.notes,
    },
    spells: s.spells.map((sp) => ({ ...sp })),
    spellSlotsUsed: { ...s.spellSlotsUsed },
    spellSlotOverrides: { ...s.spellSlotOverrides },
    resourceUsage: { ...s.resourceUsage },
    customResources: s.customResources.map((r) => ({ ...r })),
    traitsAndFeatures: s.traitsAndFeatures.map((t) => ({ ...t })),
    inventory: s.inventory.map((i) => ({ ...i })),
    attunement: {
      limitOverride: s.attunement?.limitOverride ?? null,
    },
    currency: { ...s.currency },
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

function sameSpellEntry(a: Dnd5e2014SpellEntry, b: Dnd5e2014SpellEntry): boolean {
  return (
    a.id === b.id &&
    a.level === b.level &&
    a.name === b.name &&
    a.castingTime === b.castingTime &&
    a.range === b.range &&
    a.components === b.components &&
    a.duration === b.duration &&
    a.school === b.school &&
    a.sourceType === b.sourceType &&
    a.sourceClassId === b.sourceClassId &&
    a.alwaysPrepared === b.alwaysPrepared &&
    a.prepared === b.prepared &&
    a.inSpellbook === b.inSpellbook &&
    a.ritual === b.ritual &&
    a.concentration === b.concentration &&
    a.notes === b.notes
  );
}

function sameSpellsArray(
  a: readonly Dnd5e2014SpellEntry[],
  b: readonly Dnd5e2014SpellEntry[]
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!sameSpellEntry(a[i], b[i])) return false;
  }
  return true;
}

function sameTraitEntry(a: Dnd5e2014TraitEntry, b: Dnd5e2014TraitEntry): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.source === b.source &&
    a.levelUnlocked === b.levelUnlocked &&
    a.description === b.description
  );
}

function sameTraitsArray(
  a: readonly Dnd5e2014TraitEntry[],
  b: readonly Dnd5e2014TraitEntry[]
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!sameTraitEntry(a[i], b[i])) return false;
  }
  return true;
}

function sameCustomResource(a: Dnd5e2014CustomResource, b: Dnd5e2014CustomResource): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.maxUses === b.maxUses &&
    a.recovery === b.recovery &&
    a.description === b.description
  );
}

function sameCustomResourcesArray(
  a: readonly Dnd5e2014CustomResource[],
  b: readonly Dnd5e2014CustomResource[]
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!sameCustomResource(a[i], b[i])) return false;
  }
  return true;
}

function sameInventoryItem(a: Dnd5e2014InventoryItem, b: Dnd5e2014InventoryItem): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.category === b.category &&
    a.quantity === b.quantity &&
    a.weight === b.weight &&
    a.equipped === b.equipped &&
    a.armorType === b.armorType &&
    a.baseAc === b.baseAc &&
    a.acBonus === b.acBonus &&
    a.requiresAttunement === b.requiresAttunement &&
    a.attuned === b.attuned &&
    a.weaponAbility === b.weaponAbility &&
    a.weaponAbilityOverride === b.weaponAbilityOverride &&
    a.weaponProficient === b.weaponProficient &&
    a.damage === b.damage &&
    a.damageType === b.damageType &&
    a.weaponRange === b.weaponRange &&
    a.weaponProperties === b.weaponProperties &&
    a.notes === b.notes
  );
}

function sameInventoryArray(
  a: readonly Dnd5e2014InventoryItem[],
  b: readonly Dnd5e2014InventoryItem[]
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!sameInventoryItem(a[i], b[i])) return false;
  }
  return true;
}

function normalizeSourceOverride(
  val: Dnd5e2014SpellcastingSourceOverride | undefined
): { abilityOverride: AbilityKey | null; saveDcOverride: number | null; attackBonusOverride: number | null } | null {
  if (!val) return null;
  const abilityOverride = val.abilityOverride ?? null;
  const saveDcOverride = val.saveDcOverride ?? null;
  const attackBonusOverride = val.attackBonusOverride ?? null;
  if (abilityOverride === null && saveDcOverride === null && attackBonusOverride === null) {
    return null;
  }
  return { abilityOverride, saveDcOverride, attackBonusOverride };
}

function sameNormalizedSourceOverride(
  a: { abilityOverride: AbilityKey | null; saveDcOverride: number | null; attackBonusOverride: number | null } | null,
  b: { abilityOverride: AbilityKey | null; saveDcOverride: number | null; attackBonusOverride: number | null } | null
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.abilityOverride === b.abilityOverride &&
    a.saveDcOverride === b.saveDcOverride &&
    a.attackBonusOverride === b.attackBonusOverride
  );
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

  for (const prev of baseAttacks) {
    if (prev.kind === 'gm_custom' && !canGmCustom) {
      result.push({ ...prev });
    } else if (prev.inventoryItemId !== null) {
      // Keep existing weapon_override only if still retained in draftAttacks
      if (draftAttacks.some((d) => d.id === prev.id)) {
        result.push({ ...prev });
      }
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

function sanitizeSpellsForActor(
  baseSpells: readonly Dnd5e2014SpellEntry[],
  draftSpells: readonly Dnd5e2014SpellEntry[],
  access: SheetAccessContext
): Dnd5e2014SpellEntry[] {
  if (access.isGm) {
    return draftSpells.map((sp) => ({ ...sp }));
  }
  const baseById = new Map(baseSpells.map((s) => [s.id, s]));
  return draftSpells.map((sp) => {
    const prev = baseById.get(sp.id);
    return {
      ...sp,
      // Only GM can alter `alwaysPrepared`
      alwaysPrepared: prev ? prev.alwaysPrepared : false,
    };
  });
}

function sanitizeInventoryForActor(
  base: CharacterSheetRecord,
  draftInventory: readonly Dnd5e2014InventoryItem[],
  access: SheetAccessContext
): Dnd5e2014InventoryItem[] {
  if (access.isGm) {
    return draftInventory.map((item) => ({
      ...item,
      attuned: item.requiresAttunement ? item.attuned : false,
    }));
  }

  const baseById = new Map(base.sheetData.inventory.map((i) => [i.id, i]));
  const canWeaponProf = canEditSheetField('inventory.weaponProficient', access);
  const canWeaponAbilityOverride = canEditSheetField('inventory.weaponAbilityOverride', access);
  const classes = base.sheetData.raceAndClass.classes;

  return draftInventory.map((item) => {
    const prev = baseById.get(item.id);
    const weaponProficient = canWeaponProf
      ? item.weaponProficient
      : (prev?.weaponProficient ?? false);
    const weaponAbilityOverride = canWeaponAbilityOverride
      ? item.weaponAbilityOverride
      : (prev?.weaponAbilityOverride ?? null);

    let weaponAbility = item.weaponAbility;
    if (item.category === 'weapon' && weaponAbility !== null) {
      const allowed = getAllowedOfficialWeaponAbilities(item, classes);
      if (!allowed.includes(weaponAbility) && !canWeaponAbilityOverride) {
        weaponAbility =
          prev && prev.weaponAbility !== null && allowed.includes(prev.weaponAbility)
            ? prev.weaponAbility
            : null;
      }
    } else if (item.category !== 'weapon') {
      weaponAbility = null;
    }

    return {
      ...item,
      attuned: item.requiresAttunement ? item.attuned : false,
      weaponAbility,
      weaponAbilityOverride,
      weaponProficient,
    };
  });
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

  // 9. Spellcasting config & protected overrides
  const scPatch: Record<string, unknown> = {};
  if (
    canEditSheetField('spellcasting.usesSpellbook', access) &&
    draft.spellcasting.usesSpellbook !== base.sheetData.spellcasting.usesSpellbook
  ) {
    scPatch.usesSpellbook = draft.spellcasting.usesSpellbook;
  }
  if (
    canEditSheetField('spellcasting.notes', access) &&
    draft.spellcasting.notes !== base.sheetData.spellcasting.notes
  ) {
    scPatch.notes = draft.spellcasting.notes;
  }
  if (
    canEditSheetField('spellcasting.abilityOverride', access) &&
    draft.spellcasting.abilityOverride !== base.sheetData.spellcasting.abilityOverride
  ) {
    scPatch.abilityOverride = draft.spellcasting.abilityOverride;
  }
  if (
    canEditSheetField('spellcasting.saveDcOverride', access) &&
    draft.spellcasting.saveDcOverride !== base.sheetData.spellcasting.saveDcOverride
  ) {
    scPatch.saveDcOverride = draft.spellcasting.saveDcOverride;
  }
  if (
    canEditSheetField('spellcasting.attackBonusOverride', access) &&
    draft.spellcasting.attackBonusOverride !== base.sheetData.spellcasting.attackBonusOverride
  ) {
    scPatch.attackBonusOverride = draft.spellcasting.attackBonusOverride;
  }
  if (canEditSheetField('spellcasting.sourceOverrides', access)) {
    const baseSrc = base.sheetData.spellcasting.sourceOverrides ?? {};
    const draftSrc = draft.spellcasting.sourceOverrides ?? {};
    const allClassIds = new Set([...Object.keys(baseSrc), ...Object.keys(draftSrc)]);
    const srcDiff: Record<string, Dnd5e2014SpellcastingSourceOverride | null> = {};
    for (const classId of allClassIds) {
      const normPrev = normalizeSourceOverride(baseSrc[classId]);
      const normNext = normalizeSourceOverride(draftSrc[classId]);
      if (!sameNormalizedSourceOverride(normPrev, normNext)) {
        srcDiff[classId] = normNext;
      }
    }
    if (Object.keys(srcDiff).length > 0) {
      scPatch.sourceOverrides = srcDiff;
    }
  }
  if (Object.keys(scPatch).length > 0) {
    sheetPatch.spellcasting = scPatch;
    changedLabels.push('Conjuració');
  }

  // 10. Spells
  if (canEditSheetField('spells', access)) {
    const sanitizedSpells = sanitizeSpellsForActor(base.sheetData.spells, draft.spells, access);
    if (!sameSpellsArray(base.sheetData.spells, sanitizedSpells)) {
      sheetPatch.spells = sanitizedSpells;
      changedLabels.push('Conjurs');
    }
  }

  // 11. Spell slots used & overrides
  if (canEditSheetField('spellSlotsUsed', access)) {
    const slotsUsedPatch: Record<string, number> = {};
    for (const key of SPELL_SLOT_KEYS) {
      const nextVal = Math.max(0, Math.floor(draft.spellSlotsUsed[key] ?? 0));
      const prevVal = Math.max(0, Math.floor(base.sheetData.spellSlotsUsed[key] ?? 0));
      if (nextVal !== prevVal) {
        slotsUsedPatch[key] = nextVal;
      }
    }
    if (Object.keys(slotsUsedPatch).length > 0) {
      sheetPatch.spellSlotsUsed = slotsUsedPatch;
      changedLabels.push('Espais de conjur');
    }
  }
  if (canEditSheetField('spellSlotOverrides', access)) {
    const slotOverridesPatch: Record<string, number | null> = {};
    for (const key of SPELL_SLOT_KEYS) {
      const nextVal = draft.spellSlotOverrides[key] ?? null;
      const prevVal = base.sheetData.spellSlotOverrides[key] ?? null;
      if (nextVal !== prevVal) {
        slotOverridesPatch[key] = nextVal;
      }
    }
    if (Object.keys(slotOverridesPatch).length > 0) {
      sheetPatch.spellSlotOverrides = slotOverridesPatch;
      changedLabels.push('Overrides d’espais');
    }
  }

  // 12. Resource usage & protected custom resources
  if (canEditSheetField('resourceUsage', access)) {
    const resUsagePatch: Record<string, number> = {};
    const allResKeys = new Set([
      ...Object.keys(base.sheetData.resourceUsage ?? {}),
      ...Object.keys(draft.resourceUsage ?? {}),
    ]);
    for (const key of allResKeys) {
      const nextVal = Math.max(0, Math.floor(draft.resourceUsage[key] ?? 0));
      const prevVal = Math.max(0, Math.floor(base.sheetData.resourceUsage[key] ?? 0));
      if (nextVal !== prevVal) {
        resUsagePatch[key] = nextVal;
      }
    }
    if (Object.keys(resUsagePatch).length > 0) {
      sheetPatch.resourceUsage = resUsagePatch;
      changedLabels.push('Ús de recursos');
    }
  }
  if (
    canEditSheetField('customResources', access) &&
    !sameCustomResourcesArray(base.sheetData.customResources, draft.customResources)
  ) {
    sheetPatch.customResources = draft.customResources.map((r) => ({ ...r }));
    changedLabels.push('Recursos personalitzats');
  }

  // 13. Traits and features
  if (
    canEditSheetField('traitsAndFeatures', access) &&
    !sameTraitsArray(base.sheetData.traitsAndFeatures, draft.traitsAndFeatures)
  ) {
    sheetPatch.traitsAndFeatures = draft.traitsAndFeatures.map((t) => ({ ...t }));
    changedLabels.push('Trets i aptituds');
  }

  // 14. Inventory
  if (canEditSheetField('inventory', access)) {
    const sanitizedInventory = sanitizeInventoryForActor(base, draft.inventory, access);
    if (!sameInventoryArray(base.sheetData.inventory, sanitizedInventory)) {
      sheetPatch.inventory = sanitizedInventory;
      changedLabels.push('Inventari');
    }
  }

  // 15. Attunement limit override (protected)
  if (
    canEditSheetField('attunement.limitOverride', access) &&
    draft.attunement.limitOverride !== (base.sheetData.attunement?.limitOverride ?? null)
  ) {
    sheetPatch.attunement = { limitOverride: draft.attunement.limitOverride };
    changedLabels.push('Límit de sintonització');
  }

  // 16. Currency
  const currencyPatch: Record<string, number> = {};
  for (const coin of ['cp', 'sp', 'ep', 'gp', 'pp'] as const) {
    if (
      canEditSheetField(`currency.${coin}`, access) &&
      draft.currency[coin] !== base.sheetData.currency[coin]
    ) {
      currencyPatch[coin] = draft.currency[coin];
    }
  }
  if (Object.keys(currencyPatch).length > 0) {
    sheetPatch.currency = currencyPatch;
    changedLabels.push('Monedes');
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
