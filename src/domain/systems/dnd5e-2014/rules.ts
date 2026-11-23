import {
  ABILITY_KEYS,
  ABILITY_LABELS_CA,
  ABILITY_SHORT_CA,
  DND5E_SKILLS,
  FULL_CASTER_SLOTS_2014,
  MAX_OFFICIAL_LEVEL_2014,
  MIN_OFFICIAL_LEVEL_2014,
  PACT_MAGIC_SLOTS_2014,
  XP_THRESHOLDS_2014,
  getClassEntry,
  getSubclassEntry,
  type AbilityKey,
  type CasterProgression,
  type SkillId,
} from './catalog';
import { computeCharacterResources, type ComputedCharacterResource } from './resources';
import type { Dnd5e2014SheetData } from './schema';

export type SkillProficiencyLevel = 'none' | 'half' | 'proficient' | 'expertise';

export interface ComputedSavingThrow {
  ability: AbilityKey;
  labelCa: string;
  shortCa: string;
  proficient: boolean;
  abilityMod: number;
  proficiencyApplied: number;
  override: number | null;
  total: number;
}

export interface ComputedSkill {
  id: SkillId;
  labelCa: string;
  ability: AbilityKey;
  abilityShortCa: string;
  proficiencyLevel: SkillProficiencyLevel;
  abilityMod: number;
  proficiencyApplied: number;
  override: number | null;
  total: number;
}

export interface ComputedArmorClass {
  value: number;
  isOverridden: boolean;
  sourceDescription: string;
}

export interface ComputedSpellSlotLevel {
  level: number;
  total: number;
  used: number;
  available: number;
}

export interface ComputedPactMagicSlots {
  count: number;
  slotLevel: number;
  used: number;
  available: number;
}

export interface ComputedSpellcasting {
  ability: AbilityKey | null;
  abilityLabelCa: string | null;
  saveDc: number | null;
  attackBonus: number | null;
  usesSpellbook: boolean;
  effectiveCasterLevel: number;
  slots: ComputedSpellSlotLevel[];
  pactMagic: ComputedPactMagicSlots | null;
}

export interface ComputedProgression {
  totalLevel: number;
  experiencePoints: number;
  currentLevelMinXp: number | null;
  nextLevel: number | null;
  nextLevelXp: number | null;
  xpToNextLevel: number | null;
  progressPercent: number;
  isMaxLevel: boolean;
  unlockedAsiCount: number;
  unlockedAsiDetails: Array<{ classLabel: string; level: number }>;
}

export interface ComputedInventorySummary {
  totalItemsCount: number;
  totalWeight: number;
  equippedArmorName: string | null;
  equippedShieldName: string | null;
}

export interface ComputedDnd5e2014Snapshot {
  totalLevel: number;
  proficiencyBonus: number;
  abilities: Record<
    AbilityKey,
    {
      score: number | null;
      modifier: number | null;
      labelCa: string;
      shortCa: string;
    }
  >;
  savingThrows: ComputedSavingThrow[];
  skills: ComputedSkill[];
  passives: {
    perception: number;
    investigation: number;
    insight: number;
  };
  combat: {
    armorClass: ComputedArmorClass;
    initiative: number;
    hitDiceDisplay: string | null;
  };
  spellcasting: ComputedSpellcasting | null;
  resources: ComputedCharacterResource[];
  progression: ComputedProgression;
  inventorySummary: ComputedInventorySummary;
}

/**
 * Official D&D 5e (2014) ability modifier formula: floor((score - 10) / 2).
 */
export function calculateAbilityModifier(score: number | null): number | null {
  if (score === null || !Number.isFinite(score)) {
    return null;
  }
  return Math.floor((score - 10) / 2);
}

/**
 * Official D&D 5e (2014) proficiency bonus: +2 (1-4), +3 (5-8), +4 (9-12), +5 (13-16), +6 (17-20).
 * Strictly capped at level 20 (+6) per official rules; does not extrapolate above level 20.
 * Extension point: a future homebrew epic-level rule option could override this ceiling explicitly.
 */
export function calculateProficiencyBonus(level: number): number {
  const safeLevel = Math.min(
    MAX_OFFICIAL_LEVEL_2014,
    Math.max(MIN_OFFICIAL_LEVEL_2014, Math.floor(level))
  );
  return Math.floor((safeLevel - 1) / 4) + 2;
}

export function calculateTotalLevel(sheet: Dnd5e2014SheetData): number {
  const rawTotal =
    sheet.raceAndClass.classes.length > 0
      ? sheet.raceAndClass.classes.reduce(
          (sum, entry) => sum + Math.max(MIN_OFFICIAL_LEVEL_2014, Math.floor(entry.level)),
          0
        )
      : Math.max(MIN_OFFICIAL_LEVEL_2014, Math.floor(sheet.progression.totalLevel ?? 1));

  // Official D&D 5e (2014) progression caps at level 20 (future homebrew epic-level extension hook).
  return Math.min(MAX_OFFICIAL_LEVEL_2014, Math.max(MIN_OFFICIAL_LEVEL_2014, rawTotal));
}

export function computeAbilityModifiers(
  sheet: Dnd5e2014SheetData
): Record<AbilityKey, number | null> {
  return {
    str: calculateAbilityModifier(sheet.abilities.str),
    dex: calculateAbilityModifier(sheet.abilities.dex),
    con: calculateAbilityModifier(sheet.abilities.con),
    int: calculateAbilityModifier(sheet.abilities.int),
    wis: calculateAbilityModifier(sheet.abilities.wis),
    cha: calculateAbilityModifier(sheet.abilities.cha),
  };
}

export function computeSavingThrows(
  sheet: Dnd5e2014SheetData,
  abilityMods: Record<AbilityKey, number | null>,
  proficiencyBonus: number
): ComputedSavingThrow[] {
  const proficientSet = new Set<AbilityKey>(sheet.savingThrows.proficient);

  return ABILITY_KEYS.map((ability) => {
    const proficient = proficientSet.has(ability);
    const abilityMod = abilityMods[ability] ?? 0;
    const proficiencyApplied = proficient ? proficiencyBonus : 0;
    const rawOverride = sheet.savingThrows.overrides[ability];
    const override = typeof rawOverride === 'number' && Number.isFinite(rawOverride) ? rawOverride : null;
    const total = override !== null ? override : abilityMod + proficiencyApplied;

    return {
      ability,
      labelCa: ABILITY_LABELS_CA[ability],
      shortCa: ABILITY_SHORT_CA[ability],
      proficient,
      abilityMod,
      proficiencyApplied,
      override,
      total,
    };
  });
}

export function computeSkills(
  sheet: Dnd5e2014SheetData,
  abilityMods: Record<AbilityKey, number | null>,
  proficiencyBonus: number
): ComputedSkill[] {
  const proficientSet = new Set<SkillId>(sheet.skills.proficient);
  const expertiseSet = new Set<SkillId>(sheet.skills.expertise);
  const halfProficient = Boolean(sheet.skills.halfProficient);

  return DND5E_SKILLS.map((skill) => {
    const isExpertise = expertiseSet.has(skill.id);
    const isProficient = isExpertise || proficientSet.has(skill.id);
    const proficiencyLevel: SkillProficiencyLevel = isExpertise
      ? 'expertise'
      : isProficient
        ? 'proficient'
        : halfProficient
          ? 'half'
          : 'none';

    const proficiencyApplied = isExpertise
      ? proficiencyBonus * 2
      : isProficient
        ? proficiencyBonus
        : halfProficient
          ? Math.floor(proficiencyBonus / 2)
          : 0;

    const abilityMod = abilityMods[skill.ability] ?? 0;
    const rawOverride = sheet.skills.overrides[skill.id];
    const override = typeof rawOverride === 'number' && Number.isFinite(rawOverride) ? rawOverride : null;
    const total = override !== null ? override : abilityMod + proficiencyApplied;

    return {
      id: skill.id,
      labelCa: skill.labelCa,
      ability: skill.ability,
      abilityShortCa: ABILITY_SHORT_CA[skill.ability],
      proficiencyLevel,
      abilityMod,
      proficiencyApplied,
      override,
      total,
    };
  });
}

export function computeArmorClass(
  sheet: Dnd5e2014SheetData,
  abilityMods: Record<AbilityKey, number | null>
): ComputedArmorClass {
  if (sheet.armorClass.override !== null && Number.isFinite(sheet.armorClass.override)) {
    return {
      value: sheet.armorClass.override,
      isOverridden: true,
      sourceDescription: sheet.armorClass.notes || 'Valor personalitzat / homebrew',
    };
  }

  const dexMod = abilityMods.dex ?? 0;
  const equippedArmors = sheet.inventory.filter(
    (item) => item.equipped && item.category === 'armor' && item.baseAc !== null
  );
  const equippedShield = sheet.inventory.find(
    (item) => item.equipped && item.category === 'shield'
  );
  const shieldBonus = equippedShield ? (equippedShield.acBonus ?? 2) : 0;

  if (equippedArmors.length > 0) {
    let bestValue = -Infinity;
    let bestLabel = 'Armadura equipada';

    for (const armor of equippedArmors) {
      const base = armor.baseAc ?? 10;
      const bonus = armor.acBonus ?? 0;
      let ac = base + bonus;
      if (armor.armorType === 'light') {
        ac += dexMod;
      } else if (armor.armorType === 'medium') {
        ac += Math.min(2, dexMod);
      }
      if (ac > bestValue) {
        bestValue = ac;
        bestLabel = armor.name;
      }
    }

    const total = bestValue + shieldBonus;
    return {
      value: total,
      isOverridden: false,
      sourceDescription: equippedShield ? `${bestLabel} + ${equippedShield.name}` : bestLabel,
    };
  }

  // Unarmored AC formulas (2014)
  if (sheet.armorClass.unarmoredFormula === 'barbarian') {
    const conMod = abilityMods.con ?? 0;
    const total = 10 + dexMod + conMod + shieldBonus;
    return {
      value: total,
      isOverridden: false,
      sourceDescription: equippedShield
        ? `Defensa sense armadura (Bàrbar) + ${equippedShield.name}`
        : 'Defensa sense armadura (Bàrbar)',
    };
  }

  if (sheet.armorClass.unarmoredFormula === 'monk' && shieldBonus === 0) {
    const wisMod = abilityMods.wis ?? 0;
    return {
      value: 10 + dexMod + wisMod,
      isOverridden: false,
      sourceDescription: 'Defensa sense armadura (Monjo)',
    };
  }

  const base = 10 + dexMod + shieldBonus;
  return {
    value: base,
    isOverridden: false,
    sourceDescription: equippedShield ? `Sense armadura + ${equippedShield.name}` : 'Sense armadura (10 + DES)',
  };
}

export function computeSpellcasting(
  sheet: Dnd5e2014SheetData,
  abilityMods: Record<AbilityKey, number | null>,
  proficiencyBonus: number
): ComputedSpellcasting | null {
  let effectiveCasterLevel = 0;
  let warlockLevel = 0;
  let usesSpellbook = sheet.spellcasting.usesSpellbook;
  let inferredAbility: AbilityKey | null = null;
  let nonPactCasters = 0;

  const casterDetails: Array<{ prog: CasterProgression; level: number; ability: AbilityKey | null }> =
    [];

  for (const cls of sheet.raceAndClass.classes) {
    const classMeta = getClassEntry(cls.classId);
    const subclassMeta = getSubclassEntry(cls.subclassId);
    const prog = subclassMeta?.casterProgression ?? classMeta?.casterProgression ?? 'none';
    const ability = subclassMeta?.spellcastingAbility ?? classMeta?.spellcastingAbility ?? null;
    const level = Math.max(1, Math.floor(cls.level));

    if (classMeta?.usesSpellbook) {
      usesSpellbook = true;
    }

    if (prog !== 'none') {
      if (!inferredAbility && ability) {
        inferredAbility = ability;
      }
      if (prog === 'pact') {
        warlockLevel += level;
      } else {
        nonPactCasters += 1;
        casterDetails.push({ prog, level, ability });
      }
    }
  }

  // Single-class vs multiclass caster level calculation per PHB 2014
  for (const item of casterDetails) {
    if (item.prog === 'full') {
      effectiveCasterLevel += item.level;
    } else if (item.prog === 'half') {
      if (nonPactCasters === 1) {
        effectiveCasterLevel += item.level >= 2 ? Math.ceil(item.level / 2) : 0;
      } else {
        effectiveCasterLevel += Math.floor(item.level / 2);
      }
    } else if (item.prog === 'third') {
      if (nonPactCasters === 1) {
        effectiveCasterLevel += item.level >= 3 ? Math.ceil(item.level / 3) : 0;
      } else {
        effectiveCasterLevel += Math.floor(item.level / 3);
      }
    }
  }

  const hasOverrides =
    sheet.spellcasting.abilityOverride !== null ||
    sheet.spellcasting.saveDcOverride !== null ||
    sheet.spellcasting.attackBonusOverride !== null ||
    Object.keys(sheet.spellSlotOverrides).length > 0;

  if (
    effectiveCasterLevel === 0 &&
    warlockLevel === 0 &&
    !hasOverrides &&
    sheet.spells.length === 0
  ) {
    return null;
  }

  const ability = sheet.spellcasting.abilityOverride ?? inferredAbility;
  const spellMod = ability ? (abilityMods[ability] ?? 0) : 0;
  const saveDc =
    sheet.spellcasting.saveDcOverride !== null
      ? sheet.spellcasting.saveDcOverride
      : ability
        ? 8 + proficiencyBonus + spellMod
        : null;
  const attackBonus =
    sheet.spellcasting.attackBonusOverride !== null
      ? sheet.spellcasting.attackBonusOverride
      : ability
        ? proficiencyBonus + spellMod
        : null;

  const slotTotals =
    effectiveCasterLevel > 0
      ? FULL_CASTER_SLOTS_2014[Math.min(20, effectiveCasterLevel) - 1]
      : [0, 0, 0, 0, 0, 0, 0, 0, 0];

  const slots: ComputedSpellSlotLevel[] = [];
  for (let slotLevel = 1; slotLevel <= 9; slotLevel++) {
    const key = String(slotLevel);
    const total = sheet.spellSlotOverrides[key] ?? slotTotals[slotLevel - 1] ?? 0;
    const used = Math.min(total, Math.max(0, sheet.spellSlotsUsed[key] ?? 0));
    if (total > 0 || used > 0) {
      slots.push({
        level: slotLevel,
        total,
        used,
        available: Math.max(0, total - used),
      });
    }
  }

  let pactMagic: ComputedPactMagicSlots | null = null;
  if (warlockLevel > 0) {
    const pactRow = PACT_MAGIC_SLOTS_2014[Math.min(20, warlockLevel) - 1];
    const count = sheet.spellSlotOverrides.pact ?? pactRow.count;
    const used = Math.min(count, Math.max(0, sheet.spellSlotsUsed.pact ?? 0));
    pactMagic = {
      count,
      slotLevel: pactRow.slotLevel,
      used,
      available: Math.max(0, count - used),
    };
  }

  return {
    ability,
    abilityLabelCa: ability ? ABILITY_LABELS_CA[ability] : null,
    saveDc,
    attackBonus,
    usesSpellbook,
    effectiveCasterLevel,
    slots,
    pactMagic,
  };
}

export function computeProgression(
  sheet: Dnd5e2014SheetData,
  totalLevel: number
): ComputedProgression {
  const safeLevel = Math.min(
    MAX_OFFICIAL_LEVEL_2014,
    Math.max(MIN_OFFICIAL_LEVEL_2014, Math.floor(totalLevel))
  );
  const xp = Math.max(0, Math.floor(sheet.progression.experiencePoints ?? 0));
  const isMaxLevel = safeLevel >= MAX_OFFICIAL_LEVEL_2014;

  const currentLevelMinXp = XP_THRESHOLDS_2014[safeLevel - 1] ?? 0;
  const nextLevel = isMaxLevel ? null : safeLevel + 1;
  const nextLevelXp = isMaxLevel ? null : (XP_THRESHOLDS_2014[safeLevel] ?? null);
  const xpToNextLevel = nextLevelXp !== null ? Math.max(0, nextLevelXp - xp) : null;

  let progressPercent = 100;
  if (!isMaxLevel && nextLevelXp !== null && nextLevelXp > currentLevelMinXp) {
    const span = nextLevelXp - currentLevelMinXp;
    const gained = Math.max(0, xp - currentLevelMinXp);
    progressPercent = Math.min(100, Math.round((gained / span) * 100));
  }

  const unlockedAsiDetails: Array<{ classLabel: string; level: number }> = [];
  for (const cls of sheet.raceAndClass.classes) {
    const classMeta = getClassEntry(cls.classId);
    const classLabel = cls.customClassName?.trim() || classMeta?.labelCa || cls.classId;
    const asiLevels = classMeta?.asiLevels ?? [4, 8, 12, 16, 19];
    for (const asiLvl of asiLevels) {
      if (cls.level >= asiLvl) {
        unlockedAsiDetails.push({ classLabel, level: asiLvl });
      }
    }
  }

  return {
    totalLevel: safeLevel,
    experiencePoints: xp,
    currentLevelMinXp,
    nextLevel,
    nextLevelXp,
    xpToNextLevel,
    progressPercent,
    isMaxLevel,
    unlockedAsiCount: unlockedAsiDetails.length,
    unlockedAsiDetails,
  };
}

function buildHitDiceDisplay(sheet: Dnd5e2014SheetData): string | null {
  if (sheet.hitPoints.hitDice) {
    return sheet.hitPoints.hitDice;
  }
  const parts: string[] = [];
  for (const cls of sheet.raceAndClass.classes) {
    const meta = getClassEntry(cls.classId);
    if (meta) {
      parts.push(`${cls.level}d${meta.hitDie}`);
    }
  }
  return parts.length > 0 ? parts.join(' + ') : null;
}

export function computeDnd5e2014Sheet(sheet: Dnd5e2014SheetData): ComputedDnd5e2014Snapshot {
  const totalLevel = calculateTotalLevel(sheet);
  const proficiencyBonus = calculateProficiencyBonus(totalLevel);
  const abilityMods = computeAbilityModifiers(sheet);
  const savingThrows = computeSavingThrows(sheet, abilityMods, proficiencyBonus);
  const skills = computeSkills(sheet, abilityMods, proficiencyBonus);

  const skillById = new Map(skills.map((s) => [s.id, s]));
  const armorClass = computeArmorClass(sheet, abilityMods);
  const initiative =
    sheet.initiative.override !== null && Number.isFinite(sheet.initiative.override)
      ? sheet.initiative.override
      : (abilityMods.dex ?? 0) + (sheet.initiative.bonus ?? 0);

  const spellcasting = computeSpellcasting(sheet, abilityMods, proficiencyBonus);
  const resources = computeCharacterResources(sheet, abilityMods, proficiencyBonus);
  const progression = computeProgression(sheet, totalLevel);

  const totalItemsCount = sheet.inventory.reduce((sum, item) => sum + Math.max(0, item.quantity), 0);
  const totalWeight = sheet.inventory.reduce(
    (sum, item) => sum + (item.weight ?? 0) * Math.max(0, item.quantity),
    0
  );
  const equippedArmor = sheet.inventory.find((i) => i.equipped && i.category === 'armor');
  const equippedShield = sheet.inventory.find((i) => i.equipped && i.category === 'shield');

  return {
    totalLevel,
    proficiencyBonus,
    abilities: {
      str: { score: sheet.abilities.str, modifier: abilityMods.str, labelCa: ABILITY_LABELS_CA.str, shortCa: ABILITY_SHORT_CA.str },
      dex: { score: sheet.abilities.dex, modifier: abilityMods.dex, labelCa: ABILITY_LABELS_CA.dex, shortCa: ABILITY_SHORT_CA.dex },
      con: { score: sheet.abilities.con, modifier: abilityMods.con, labelCa: ABILITY_LABELS_CA.con, shortCa: ABILITY_SHORT_CA.con },
      int: { score: sheet.abilities.int, modifier: abilityMods.int, labelCa: ABILITY_LABELS_CA.int, shortCa: ABILITY_SHORT_CA.int },
      wis: { score: sheet.abilities.wis, modifier: abilityMods.wis, labelCa: ABILITY_LABELS_CA.wis, shortCa: ABILITY_SHORT_CA.wis },
      cha: { score: sheet.abilities.cha, modifier: abilityMods.cha, labelCa: ABILITY_LABELS_CA.cha, shortCa: ABILITY_SHORT_CA.cha },
    },
    savingThrows,
    skills,
    passives: {
      perception: 10 + (skillById.get('perception')?.total ?? 0),
      investigation: 10 + (skillById.get('investigation')?.total ?? 0),
      insight: 10 + (skillById.get('insight')?.total ?? 0),
    },
    combat: {
      armorClass,
      initiative,
      hitDiceDisplay: buildHitDiceDisplay(sheet),
    },
    spellcasting,
    resources,
    progression,
    inventorySummary: {
      totalItemsCount,
      totalWeight: Math.round(totalWeight * 100) / 100,
      equippedArmorName: equippedArmor?.name ?? null,
      equippedShieldName: equippedShield?.name ?? null,
    },
  };
}
