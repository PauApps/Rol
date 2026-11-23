import { computeAttacks, type ComputedAttack } from './attacks';
import {
  ABILITY_KEYS,
  ABILITY_LABELS_CA,
  ABILITY_SHORT_CA,
  DEFAULT_ATTUNEMENT_LIMIT_2014,
  DND5E_SKILLS,
  FULL_CASTER_SLOTS_2014,
  MAX_OFFICIAL_LEVEL_2014,
  MIN_OFFICIAL_LEVEL_2014,
  PACT_MAGIC_SLOTS_2014,
  XP_THRESHOLDS_2014,
  getClassEntry,
  getHitDieAverageGain,
  getSubclassEntry,
  resolveEffectiveClassSpellcasting,
  type AbilityKey,
  type CasterProgression,
  type SkillId,
  type SpellcastingModel,
} from './catalog';
import type { RollMode } from './dice';
import { computeCharacterResources, type ComputedCharacterResource } from './resources';
import {
  HIT_DIE_SIZES,
  hitDieSizeToKey,
  sumHitDiceUsedByDie,
  type Dnd5e2014SheetData,
  type HitDieKey,
  type HitDieSize,
} from './schema';

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
  rollMode: RollMode;
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
  rollMode: RollMode;
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

export interface ComputedSpellcastingSource {
  classId: string;
  classLabelCa: string;
  subclassId: string | null;
  subclassLabelCa: string | null;
  classLevel: number;
  progression: CasterProgression;
  model: SpellcastingModel;
  ability: AbilityKey | null;
  abilityLabelCa: string | null;
  saveDc: number | null;
  attackBonus: number | null;
  usesSpellbook: boolean;
  maxClassSpellLevel: number;
  preparedLimit: number | null;
  preparedCount: number;
  alwaysPreparedCount: number;
  spellbookCount: number;
  knownCount: number;
  exceedsPreparedLimit: boolean;
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
  sources: ComputedSpellcastingSource[];
  specialSpellsCount: number;
  totalSpellbookCount: number;
  totalPreparedCount: number;
}

export interface ComputedClassProgression {
  classId: string;
  classLabelCa: string;
  subclassLabelCa: string | null;
  level: number;
  hitDie: 6 | 8 | 10 | 12 | null;
  averageHpPerLevel: number | null;
  subclassUnlocked: boolean;
  subclassLevel: number | null;
  unlockedAsiLevels: number[];
  nextAsiLevel: number | null;
}

export type ProgressionMilestoneCategory =
  | 'proficiency_bonus'
  | 'subclass'
  | 'asi'
  | 'spell_circle'
  | 'class_feature';

export interface ComputedProgressionMilestone {
  scope: 'character' | 'class';
  classId: string | null;
  classLabelCa: string | null;
  targetTotalLevel: number;
  targetClassLevel: number | null;
  levelsRemaining: number;
  category: ProgressionMilestoneCategory;
  titleCa: string;
  descriptionCa: string;
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
  maxLevelMessageCa: string | null;
  unlockedAsiCount: number;
  unlockedAsiDetails: Array<{ classLabel: string; level: number }>;
  classProgressions: ComputedClassProgression[];
  upcomingMilestones: ComputedProgressionMilestone[];
}

export interface ComputedAttunementSummary {
  attunedCount: number;
  maxSlots: number;
  availableSlots: number;
  isOverridden: boolean;
  attunedItemIds: string[];
  attunedItemNames: string[];
}

export interface ComputedInventorySummary {
  totalItemsCount: number;
  totalWeight: number;
  equippedArmorName: string | null;
  equippedShieldName: string | null;
  attunement: ComputedAttunementSummary;
}

export interface ComputedHitDiePoolEntry {
  dieSize: HitDieSize;
  dieKey: HitDieKey;
  total: number;
  used: number | null;
  available: number | null;
  maxSpendableNow: number;
}

export interface ComputedHitDiceSummary {
  display: string | null;
  total: number;
  used: number;
  available: number;
  hasUnallocatedLegacyUsage: boolean;
  unallocatedUsed: number;
  byDie: ComputedHitDiePoolEntry[];
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
    totalHitDice: number;
    availableHitDice: number;
    hitDicePool: ComputedHitDiceSummary;
    attacks: ComputedAttack[];
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
    const override =
      typeof rawOverride === 'number' && Number.isFinite(rawOverride) ? rawOverride : null;
    const total = override !== null ? override : abilityMod + proficiencyApplied;
    const rollMode: RollMode = sheet.savingThrows.rollModes?.[ability] ?? 'normal';

    return {
      ability,
      labelCa: ABILITY_LABELS_CA[ability],
      shortCa: ABILITY_SHORT_CA[ability],
      proficient,
      abilityMod,
      proficiencyApplied,
      override,
      total,
      rollMode,
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
    const override =
      typeof rawOverride === 'number' && Number.isFinite(rawOverride) ? rawOverride : null;
    const total = override !== null ? override : abilityMod + proficiencyApplied;
    const rollMode: RollMode = sheet.skills.rollModes?.[skill.id] ?? 'normal';

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
      rollMode,
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
    sourceDescription: equippedShield
      ? `Sense armadura + ${equippedShield.name}`
      : 'Sense armadura (10 + DES)',
  };
}

function highestSlotLevel(slotsRow: readonly number[] | undefined): number {
  if (!slotsRow) return 0;
  for (let i = slotsRow.length - 1; i >= 0; i--) {
    if (slotsRow[i] > 0) return i + 1;
  }
  return 0;
}

function getMaxClassSpellLevel(progression: CasterProgression, classLevel: number): number {
  const safeClassLevel = Math.min(20, Math.max(1, Math.floor(classLevel)));
  if (progression === 'full') {
    return highestSlotLevel(FULL_CASTER_SLOTS_2014[safeClassLevel - 1]);
  }
  if (progression === 'half') {
    if (safeClassLevel < 2) return 0;
    return highestSlotLevel(FULL_CASTER_SLOTS_2014[Math.ceil(safeClassLevel / 2) - 1]);
  }
  if (progression === 'third') {
    if (safeClassLevel < 3) return 0;
    return highestSlotLevel(FULL_CASTER_SLOTS_2014[Math.floor((safeClassLevel + 2) / 3) - 1]);
  }
  if (progression === 'pact') {
    if (safeClassLevel >= 17) return 9;
    if (safeClassLevel >= 15) return 8;
    if (safeClassLevel >= 13) return 7;
    if (safeClassLevel >= 11) return 6;
    return PACT_MAGIC_SLOTS_2014[safeClassLevel - 1].slotLevel;
  }
  return 0;
}

function calculateClassPreparedLimit(
  classId: string,
  model: SpellcastingModel,
  classLevel: number,
  abilityMod: number
): number | null {
  if (model !== 'prepared' && model !== 'spellbook') {
    return null;
  }
  if (classId === 'cleric' || classId === 'druid' || classId === 'wizard') {
    return Math.max(1, abilityMod + classLevel);
  }
  if (classId === 'paladin') {
    if (classLevel < 2) return null;
    return Math.max(1, abilityMod + Math.floor(classLevel / 2));
  }
  return null;
}

export function computeSpellcasting(
  sheet: Dnd5e2014SheetData,
  abilityMods: Record<AbilityKey, number | null>,
  proficiencyBonus: number
): ComputedSpellcasting | null {
  let effectiveCasterLevel = 0;
  let warlockLevel = 0;
  let usesSpellbook = sheet.spellcasting.usesSpellbook;
  let nonPactCasters = 0;

  const casterDetails: Array<{ prog: CasterProgression; level: number }> = [];
  const sources: ComputedSpellcastingSource[] = [];

  for (const cls of sheet.raceAndClass.classes) {
    const classMeta = getClassEntry(cls.classId);
    const subclassMeta = getSubclassEntry(cls.subclassId);
    const level = Math.min(MAX_OFFICIAL_LEVEL_2014, Math.max(MIN_OFFICIAL_LEVEL_2014, Math.floor(cls.level)));
    const resolved = resolveEffectiveClassSpellcasting(cls.classId, cls.subclassId, level);

    if (resolved.usesSpellbook) {
      usesSpellbook = true;
    }

    if (!resolved.isActiveCaster) {
      continue;
    }

    const srcOverride = sheet.spellcasting.sourceOverrides?.[cls.classId];
    const effectiveAbility =
      srcOverride?.abilityOverride ?? sheet.spellcasting.abilityOverride ?? resolved.ability;
    const abilityMod = effectiveAbility ? (abilityMods[effectiveAbility] ?? 0) : 0;

    const saveDc =
      srcOverride?.saveDcOverride !== undefined && srcOverride.saveDcOverride !== null
        ? srcOverride.saveDcOverride
        : sheet.spellcasting.saveDcOverride !== null
          ? sheet.spellcasting.saveDcOverride
          : effectiveAbility
            ? 8 + proficiencyBonus + abilityMod
            : null;
    const attackBonus =
      srcOverride?.attackBonusOverride !== undefined && srcOverride.attackBonusOverride !== null
        ? srcOverride.attackBonusOverride
        : sheet.spellcasting.attackBonusOverride !== null
          ? sheet.spellcasting.attackBonusOverride
          : effectiveAbility
            ? proficiencyBonus + abilityMod
            : null;

    sources.push({
      classId: cls.classId,
      classLabelCa: cls.customClassName?.trim() || classMeta?.labelCa || cls.classId,
      subclassId: cls.subclassId ?? null,
      subclassLabelCa: cls.customSubclassName?.trim() || subclassMeta?.labelCa || null,
      classLevel: level,
      progression: resolved.progression,
      model: resolved.model,
      ability: effectiveAbility,
      abilityLabelCa: effectiveAbility ? ABILITY_LABELS_CA[effectiveAbility] : null,
      saveDc,
      attackBonus,
      usesSpellbook: resolved.usesSpellbook,
      maxClassSpellLevel: getMaxClassSpellLevel(resolved.progression, level),
      preparedLimit: calculateClassPreparedLimit(cls.classId, resolved.model, level, abilityMod),
      preparedCount: 0,
      alwaysPreparedCount: 0,
      spellbookCount: 0,
      knownCount: 0,
      exceedsPreparedLimit: false,
    });

    if (resolved.progression === 'pact') {
      warlockLevel += level;
    } else {
      nonPactCasters += 1;
      casterDetails.push({ prog: resolved.progression, level });
    }
  }

  // Single-class vs multiclass caster level calculation per PHB 2014 p. 164-165
  for (const item of casterDetails) {
    if (item.prog === 'full') {
      effectiveCasterLevel += item.level;
    } else if (item.prog === 'half') {
      effectiveCasterLevel +=
        nonPactCasters === 1 ? Math.ceil(item.level / 2) : Math.floor(item.level / 2);
    } else if (item.prog === 'third') {
      effectiveCasterLevel +=
        nonPactCasters === 1
          ? Math.floor((item.level + 2) / 3)
          : Math.floor(item.level / 3);
    }
  }

  // Attribute each spell to its source class (or special source) without conflating spellbook vs prepared
  const sourceByClassId = new Map(sources.map((s) => [s.classId, s]));
  const spellbookSource = sources.find((s) => s.usesSpellbook);
  const warlockSource = sources.find((s) => s.progression === 'pact');
  let specialSpellsCount = 0;

  for (const spell of sheet.spells) {
    if (spell.sourceType !== 'class' && spell.sourceType !== 'pact') {
      specialSpellsCount += 1;
      continue;
    }

    let target: ComputedSpellcastingSource | undefined;
    if (spell.sourceClassId && sourceByClassId.has(spell.sourceClassId)) {
      target = sourceByClassId.get(spell.sourceClassId);
    } else if (spell.sourceType === 'pact' && warlockSource) {
      target = warlockSource;
    } else if (sources.length === 1) {
      target = sources[0];
    } else if (spell.inSpellbook && spellbookSource) {
      target = spellbookSource;
    } else {
      target = sources[0];
    }

    if (!target) {
      continue;
    }

    if (spell.inSpellbook) {
      target.spellbookCount += 1;
    }

    if (spell.level >= 1) {
      if (spell.alwaysPrepared) {
        target.alwaysPreparedCount += 1;
      } else if (spell.prepared) {
        target.preparedCount += 1;
      }

      if (target.model === 'known' || target.model === 'pact') {
        target.knownCount += 1;
      }
    }
  }

  for (const src of sources) {
    src.exceedsPreparedLimit = src.preparedLimit !== null && src.preparedCount > src.preparedLimit;
  }

  const hasOverrides =
    sheet.spellcasting.abilityOverride !== null ||
    sheet.spellcasting.saveDcOverride !== null ||
    sheet.spellcasting.attackBonusOverride !== null ||
    Object.keys(sheet.spellcasting.sourceOverrides ?? {}).length > 0 ||
    Object.keys(sheet.spellSlotOverrides).length > 0;

  if (
    sources.length === 0 &&
    !hasOverrides &&
    sheet.spells.length === 0
  ) {
    return null;
  }

  const primarySource = sources.find((s) => s.progression !== 'pact') ?? sources[0];
  const ability = primarySource?.ability ?? sheet.spellcasting.abilityOverride ?? null;
  const spellMod = ability ? (abilityMods[ability] ?? 0) : 0;
  const saveDc =
    primarySource?.saveDc ??
    (sheet.spellcasting.saveDcOverride !== null
      ? sheet.spellcasting.saveDcOverride
      : ability
        ? 8 + proficiencyBonus + spellMod
        : null);
  const attackBonus =
    primarySource?.attackBonus ??
    (sheet.spellcasting.attackBonusOverride !== null
      ? sheet.spellcasting.attackBonusOverride
      : ability
        ? proficiencyBonus + spellMod
        : null);

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

  const totalSpellbookCount = sources.reduce((sum, s) => sum + s.spellbookCount, 0);
  const totalPreparedCount = sources.reduce((sum, s) => sum + s.preparedCount, 0);

  return {
    ability,
    abilityLabelCa: ability ? ABILITY_LABELS_CA[ability] : null,
    saveDc,
    attackBonus,
    usesSpellbook,
    effectiveCasterLevel,
    slots,
    pactMagic,
    sources,
    specialSpellsCount,
    totalSpellbookCount,
    totalPreparedCount,
  };
}

function getNewSpellCircleUnlocksForClass(
  progression: CasterProgression
): Array<{ level: number; titleCa: string; descriptionCa: string }> {
  if (progression === 'full') {
    return [3, 5, 7, 9, 11, 13, 15, 17].map((lvl) => {
      const circle = Math.ceil(lvl / 2);
      return {
        level: lvl,
        titleCa: `Espais de conjur de cercle ${circle}`,
        descriptionCa: `Desbloqueja espais i conjurs de ${circle}è nivell en assolir el nivell ${lvl} de classe.`,
      };
    });
  }
  if (progression === 'half') {
    return [
      { level: 2, circle: 1 },
      { level: 5, circle: 2 },
      { level: 9, circle: 3 },
      { level: 13, circle: 4 },
      { level: 17, circle: 5 },
    ].map(({ level, circle }) => ({
      level,
      titleCa: `Espais de conjur de cercle ${circle}`,
      descriptionCa: `Accés a conjurs de ${circle}r/è cercle al nivell ${level} de classe.`,
    }));
  }
  if (progression === 'third') {
    return [
      { level: 3, circle: 1 },
      { level: 7, circle: 2 },
      { level: 13, circle: 3 },
      { level: 19, circle: 4 },
    ].map(({ level, circle }) => ({
      level,
      titleCa: `Espais de conjur de cercle ${circle}`,
      descriptionCa: `Accés a conjurs de ${circle}r/è cercle al nivell ${level} de classe.`,
    }));
  }
  if (progression === 'pact') {
    return [
      { level: 3, titleCa: 'Espais de Pacte nivell 2', descriptionCa: 'Els espais de Pacte passen a 2n cercle.' },
      { level: 5, titleCa: 'Espais de Pacte nivell 3', descriptionCa: 'Els espais de Pacte passen a 3r cercle.' },
      { level: 7, titleCa: 'Espais de Pacte nivell 4', descriptionCa: 'Els espais de Pacte passen a 4t cercle.' },
      { level: 9, titleCa: 'Espais de Pacte nivell 5', descriptionCa: 'Els espais de Pacte passen a 5è cercle.' },
      { level: 11, titleCa: 'Arcanum místic (6è cercle)', descriptionCa: 'Un llançament diari de conjur de 6è cercle.' },
      { level: 13, titleCa: 'Arcanum místic (7è cercle)', descriptionCa: 'Un llançament diari de conjur de 7è cercle.' },
      { level: 15, titleCa: 'Arcanum místic (8è cercle)', descriptionCa: 'Un llançament diari de conjur de 8è cercle.' },
      { level: 17, titleCa: 'Arcanum místic (9è cercle)', descriptionCa: 'Un llançament diari de conjur de 9è cercle.' },
    ];
  }
  return [];
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
  const maxLevelMessageCa = isMaxLevel
    ? 'S’ha assolit el nivell màxim oficial (20) de D&D 5e (2014).'
    : null;

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

  const remainingCharacterLevels = MAX_OFFICIAL_LEVEL_2014 - safeLevel;
  const unlockedAsiDetails: Array<{ classLabel: string; level: number }> = [];
  const classProgressions: ComputedClassProgression[] = [];
  const upcomingMilestones: ComputedProgressionMilestone[] = [];

  if (!isMaxLevel) {
    for (const threshold of [5, 9, 13, 17]) {
      if (threshold > safeLevel) {
        upcomingMilestones.push({
          scope: 'character',
          classId: null,
          classLabelCa: null,
          targetTotalLevel: threshold,
          targetClassLevel: null,
          levelsRemaining: threshold - safeLevel,
          category: 'proficiency_bonus',
          titleCa: `Bonificació de competència +${calculateProficiencyBonus(threshold)}`,
          descriptionCa: `En assolir el nivell total ${threshold}, la bonificació de competència puja a +${calculateProficiencyBonus(threshold)}.`,
        });
      }
    }
  }

  for (const cls of sheet.raceAndClass.classes) {
    const classLevel = Math.min(
      MAX_OFFICIAL_LEVEL_2014,
      Math.max(MIN_OFFICIAL_LEVEL_2014, Math.floor(cls.level))
    );
    const classMeta = getClassEntry(cls.classId);
    const subclassMeta = getSubclassEntry(cls.subclassId);
    const classLabel = cls.customClassName?.trim() || classMeta?.labelCa || cls.classId;
    const subclassLabel = cls.customSubclassName?.trim() || subclassMeta?.labelCa || null;
    const asiLevels = classMeta?.asiLevels ?? [4, 8, 12, 16, 19];

    const unlockedAsiForClass: number[] = [];
    for (const asiLvl of asiLevels) {
      if (classLevel >= asiLvl) {
        unlockedAsiForClass.push(asiLvl);
        unlockedAsiDetails.push({ classLabel, level: asiLvl });
      }
    }

    const maxReachableClassLevel = Math.min(
      MAX_OFFICIAL_LEVEL_2014,
      classLevel + remainingCharacterLevels
    );
    const nextAsiLevel =
      asiLevels.find((lvl) => lvl > classLevel && lvl <= maxReachableClassLevel) ?? null;

    classProgressions.push({
      classId: cls.classId,
      classLabelCa: classLabel,
      subclassLabelCa: subclassLabel,
      level: classLevel,
      hitDie: classMeta?.hitDie ?? null,
      averageHpPerLevel: classMeta ? getHitDieAverageGain(classMeta.hitDie) : null,
      subclassUnlocked: classMeta ? classLevel >= classMeta.subclassLevel : true,
      subclassLevel: classMeta?.subclassLevel ?? null,
      unlockedAsiLevels: unlockedAsiForClass,
      nextAsiLevel,
    });

    if (isMaxLevel || !classMeta) {
      continue;
    }

    // Subclass unlock milestone
    if (
      classLevel < classMeta.subclassLevel &&
      classMeta.subclassLevel <= maxReachableClassLevel
    ) {
      const delta = classMeta.subclassLevel - classLevel;
      upcomingMilestones.push({
        scope: 'class',
        classId: cls.classId,
        classLabelCa: classLabel,
        targetTotalLevel: safeLevel + delta,
        targetClassLevel: classMeta.subclassLevel,
        levelsRemaining: delta,
        category: 'subclass',
        titleCa: `Elecció de subclasse de ${classLabel}`,
        descriptionCa: `Al nivell ${classMeta.subclassLevel} de ${classLabel} desbloqueges la teva especialització oficial.`,
      });
    }

    // ASI milestones
    for (const asiLvl of asiLevels) {
      if (asiLvl > classLevel && asiLvl <= maxReachableClassLevel) {
        const delta = asiLvl - classLevel;
        upcomingMilestones.push({
          scope: 'class',
          classId: cls.classId,
          classLabelCa: classLabel,
          targetTotalLevel: safeLevel + delta,
          targetClassLevel: asiLvl,
          levelsRemaining: delta,
          category: 'asi',
          titleCa: `Millora de característica o dot (${classLabel} ${asiLvl})`,
          descriptionCa: '+2 a una característica o +1 a dues (màx. 20) o tria un dot segons regles de campanya.',
        });
      }
    }

    // Spell circle milestones
    const effectiveCasterProg =
      subclassMeta?.casterProgression ?? classMeta.casterProgression;
    for (const circleUnlock of getNewSpellCircleUnlocksForClass(effectiveCasterProg)) {
      if (circleUnlock.level > classLevel && circleUnlock.level <= maxReachableClassLevel) {
        const delta = circleUnlock.level - classLevel;
        upcomingMilestones.push({
          scope: 'class',
          classId: cls.classId,
          classLabelCa: classLabel,
          targetTotalLevel: safeLevel + delta,
          targetClassLevel: circleUnlock.level,
          levelsRemaining: delta,
          category: 'spell_circle',
          titleCa: `${circleUnlock.titleCa} (${classLabel} ${circleUnlock.level})`,
          descriptionCa: circleUnlock.descriptionCa,
        });
      }
    }

    // Key class feature milestones
    for (const feature of classMeta.keyFeatureMilestones) {
      if (feature.level > classLevel && feature.level <= maxReachableClassLevel) {
        const delta = feature.level - classLevel;
        upcomingMilestones.push({
          scope: 'class',
          classId: cls.classId,
          classLabelCa: classLabel,
          targetTotalLevel: safeLevel + delta,
          targetClassLevel: feature.level,
          levelsRemaining: delta,
          category: 'class_feature',
          titleCa: `${feature.titleCa} (${classLabel} ${feature.level})`,
          descriptionCa: feature.descriptionCa,
        });
      }
    }
  }

  upcomingMilestones.sort((a, b) => a.levelsRemaining - b.levelsRemaining);

  return {
    totalLevel: safeLevel,
    experiencePoints: xp,
    currentLevelMinXp,
    nextLevel,
    nextLevelXp,
    xpToNextLevel,
    progressPercent,
    isMaxLevel,
    maxLevelMessageCa,
    unlockedAsiCount: unlockedAsiDetails.length,
    unlockedAsiDetails,
    classProgressions,
    upcomingMilestones,
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

export function computeHitDiceSummary(
  sheet: Dnd5e2014SheetData,
  totalLevel: number
): ComputedHitDiceSummary {
  const totalsBySize = new Map<HitDieSize, number>();
  for (const cls of sheet.raceAndClass.classes) {
    const meta = getClassEntry(cls.classId);
    if (meta) {
      const lvl = Math.min(
        MAX_OFFICIAL_LEVEL_2014,
        Math.max(MIN_OFFICIAL_LEVEL_2014, Math.floor(cls.level))
      );
      totalsBySize.set(meta.hitDie, (totalsBySize.get(meta.hitDie) ?? 0) + lvl);
    }
  }

  const usedByDie = sheet.hitPoints.hitDiceUsedByDie ?? null;
  const totalUsed =
    usedByDie !== null
      ? sumHitDiceUsedByDie(usedByDie)
      : Math.max(0, Math.floor(sheet.hitPoints.hitDiceUsed ?? 0));
  const totalAvailable = Math.max(0, totalLevel - totalUsed);
  const hasUnallocatedLegacyUsage = usedByDie === null && totalUsed > 0;

  const byDie: ComputedHitDiePoolEntry[] = [];
  for (const dieSize of HIT_DIE_SIZES) {
    const dieTotal = totalsBySize.get(dieSize);
    if (!dieTotal) continue;
    const dieKey = hitDieSizeToKey(dieSize);
    if (usedByDie !== null) {
      const used = Math.min(dieTotal, Math.max(0, Math.floor(usedByDie[dieKey] ?? 0)));
      const available = Math.max(0, dieTotal - used);
      byDie.push({
        dieSize,
        dieKey,
        total: dieTotal,
        used,
        available,
        maxSpendableNow: available,
      });
    } else {
      byDie.push({
        dieSize,
        dieKey,
        total: dieTotal,
        used: null,
        available: null,
        maxSpendableNow: Math.min(dieTotal, totalAvailable),
      });
    }
  }

  return {
    display: buildHitDiceDisplay(sheet),
    total: totalLevel,
    used: totalUsed,
    available: totalAvailable,
    hasUnallocatedLegacyUsage,
    unallocatedUsed: hasUnallocatedLegacyUsage ? totalUsed : 0,
    byDie,
  };
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
  const attacks = computeAttacks(sheet, abilityMods, proficiencyBonus, spellcasting);
  const hitDicePool = computeHitDiceSummary(sheet, totalLevel);

  const resources = computeCharacterResources(sheet, abilityMods, proficiencyBonus);
  const progression = computeProgression(sheet, totalLevel);

  const totalItemsCount = sheet.inventory.reduce((sum, item) => sum + Math.max(0, item.quantity), 0);
  const totalWeight = sheet.inventory.reduce(
    (sum, item) => sum + (item.weight ?? 0) * Math.max(0, item.quantity),
    0
  );
  const equippedArmor = sheet.inventory.find((i) => i.equipped && i.category === 'armor');
  const equippedShield = sheet.inventory.find((i) => i.equipped && i.category === 'shield');

  const attunedItems = sheet.inventory.filter((i) => i.requiresAttunement && i.attuned);
  const maxAttunementSlots = sheet.attunement?.limitOverride ?? DEFAULT_ATTUNEMENT_LIMIT_2014;

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
      hitDiceDisplay: hitDicePool.display,
      totalHitDice: hitDicePool.total,
      availableHitDice: hitDicePool.available,
      hitDicePool,
      attacks,
    },
    spellcasting,
    resources,
    progression,
    inventorySummary: {
      totalItemsCount,
      totalWeight: Math.round(totalWeight * 100) / 100,
      equippedArmorName: equippedArmor?.name ?? null,
      equippedShieldName: equippedShield?.name ?? null,
      attunement: {
        attunedCount: attunedItems.length,
        maxSlots: maxAttunementSlots,
        availableSlots: Math.max(0, maxAttunementSlots - attunedItems.length),
        isOverridden: sheet.attunement?.limitOverride !== null && sheet.attunement?.limitOverride !== undefined,
        attunedItemIds: attunedItems.map((i) => i.id),
        attunedItemNames: attunedItems.map((i) => i.name),
      },
    },
  };
}
