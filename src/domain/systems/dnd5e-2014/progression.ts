import {
  ABILITY_LABELS_CA,
  ABILITY_SHORT_CA,
  MAX_OFFICIAL_LEVEL_2014,
  MIN_OFFICIAL_LEVEL_2014,
  getClassEntry,
  getHitDieAverageGain,
  getSubclassEntry,
  normalizeMatchText,
  DND5E_SUBCLASSES,
  type AbilityKey,
  type ClassFeatureMilestone,
  type SkillId,
  type SubclassCatalogEntry,
} from './catalog';
import { DND5E_CLASS_CREATION_RULES } from './creation-catalog';
import { computeCharacterResources } from './resources';
import {
  calculateAbilityModifier,
  calculateProficiencyBonus,
  calculateTotalLevel,
  computeDnd5e2014Sheet,
  computeProgression,
  computeSpellcasting,
  type ComputedSpellcasting,
} from './rules';
import {
  type Dnd5e2014AbilityScores,
  type Dnd5e2014ClassEntry,
  type Dnd5e2014LevelHistoryEntry,
  type Dnd5e2014SheetData,
  type Dnd5e2014SpellEntry,
  type Dnd5e2014TraitEntry,
} from './schema';
import type { Dnd5e2014SheetPatchInput } from './validation';

/**
 * Official D&D 5e (2014) PHB p. 163 multiclass ability score minimums (13).
 * Each outer array item represents a class requirement group:
 * all entries inside an alternative branch? Here:
 * - Fighter requires STR 13 OR DEX 13 (`mode: 'anyOf'`).
 * - All other classes require ALL listed abilities at >= 13 (`mode: 'allOf'`).
 */
export interface MulticlassRequirementRule {
  mode: 'allOf' | 'anyOf';
  abilities: readonly AbilityKey[];
  minimum: 13;
}

export const MULTICLASS_PREREQUISITES_2014: Record<string, MulticlassRequirementRule> = {
  barbarian: { mode: 'allOf', abilities: ['str'], minimum: 13 },
  bard: { mode: 'allOf', abilities: ['cha'], minimum: 13 },
  cleric: { mode: 'allOf', abilities: ['wis'], minimum: 13 },
  druid: { mode: 'allOf', abilities: ['wis'], minimum: 13 },
  fighter: { mode: 'anyOf', abilities: ['str', 'dex'], minimum: 13 },
  monk: { mode: 'allOf', abilities: ['dex', 'wis'], minimum: 13 },
  paladin: { mode: 'allOf', abilities: ['str', 'cha'], minimum: 13 },
  ranger: { mode: 'allOf', abilities: ['dex', 'wis'], minimum: 13 },
  rogue: { mode: 'allOf', abilities: ['dex'], minimum: 13 },
  sorcerer: { mode: 'allOf', abilities: ['cha'], minimum: 13 },
  warlock: { mode: 'allOf', abilities: ['cha'], minimum: 13 },
  wizard: { mode: 'allOf', abilities: ['int'], minimum: 13 },
};

export interface MulticlassProficiencyGrant {
  armor: readonly string[];
  weapons: readonly string[];
  tools: readonly string[];
  extraSkillCount: number;
  skillPool: readonly SkillId[];
}

/**
 * Official D&D 5e (2014) PHB p. 164 proficiencies gained when multiclassing into a class.
 */
export const MULTICLASS_PROFICIENCIES_2014: Record<string, MulticlassProficiencyGrant> = {
  barbarian: {
    armor: ['Escuts'],
    weapons: ['Armes senzilles', 'Armes marcials'],
    tools: [],
    extraSkillCount: 0,
    skillPool: [],
  },
  bard: {
    armor: ['Armadures lleugeres'],
    weapons: [],
    tools: ['Un instrument musical a escollir'],
    extraSkillCount: 1,
    skillPool: DND5E_CLASS_CREATION_RULES.bard.eligibleSkills,
  },
  cleric: {
    armor: ['Armadures lleugeres', 'Armadures mitjanes', 'Escuts'],
    weapons: [],
    tools: [],
    extraSkillCount: 0,
    skillPool: [],
  },
  druid: {
    armor: ['Armadures lleugeres', 'Armadures mitjanes', 'Escuts (no metàl·lics)'],
    weapons: [],
    tools: [],
    extraSkillCount: 0,
    skillPool: [],
  },
  fighter: {
    armor: ['Armadures lleugeres', 'Armadures mitjanes', 'Escuts'],
    weapons: ['Armes senzilles', 'Armes marcials'],
    tools: [],
    extraSkillCount: 0,
    skillPool: [],
  },
  monk: {
    armor: [],
    weapons: ['Armes senzilles', 'Espasa curta'],
    tools: [],
    extraSkillCount: 0,
    skillPool: [],
  },
  paladin: {
    armor: ['Armadures lleugeres', 'Armadures mitjanes', 'Escuts'],
    weapons: ['Armes senzilles', 'Armes marcials'],
    tools: [],
    extraSkillCount: 0,
    skillPool: [],
  },
  ranger: {
    armor: ['Armadures lleugeres', 'Armadures mitjanes', 'Escuts'],
    weapons: ['Armes senzilles', 'Armes marcials'],
    tools: [],
    extraSkillCount: 1,
    skillPool: DND5E_CLASS_CREATION_RULES.ranger.eligibleSkills,
  },
  rogue: {
    armor: ['Armadures lleugeres'],
    weapons: [],
    tools: ['Eines de lladre'],
    extraSkillCount: 1,
    skillPool: DND5E_CLASS_CREATION_RULES.rogue.eligibleSkills,
  },
  sorcerer: { armor: [], weapons: [], tools: [], extraSkillCount: 0, skillPool: [] },
  warlock: {
    armor: ['Armadures lleugeres'],
    weapons: ['Armes senzilles'],
    tools: [],
    extraSkillCount: 0,
    skillPool: [],
  },
  wizard: { armor: [], weapons: [], tools: [], extraSkillCount: 0, skillPool: [] },
};

export function formatMulticlassRequirementCa(classId: string): string {
  const rule = MULTICLASS_PREREQUISITES_2014[classId];
  if (!rule) return 'Sense requisit oficial definit';
  const joined = rule.abilities
    .map((ab) => `${ABILITY_SHORT_CA[ab]} ${rule.minimum}`)
    .join(rule.mode === 'anyOf' ? ' o ' : ' i ');
  return joined;
}

export function validateMulticlassPrerequisites(
  classes: readonly Dnd5e2014ClassEntry[],
  abilities: Dnd5e2014AbilityScores
): { eligible: boolean; unmetRequirements: string[] } {
  if (classes.length <= 1) {
    return { eligible: true, unmetRequirements: [] };
  }

  const unmetRequirements: string[] = [];

  for (const cls of classes) {
    if (cls.classId === 'custom') continue;
    const rule = MULTICLASS_PREREQUISITES_2014[cls.classId];
    if (!rule) continue;
    const classMeta = getClassEntry(cls.classId);
    const labelCa = classMeta?.labelCa ?? cls.classId;

    if (rule.mode === 'anyOf') {
      const ok = rule.abilities.some((ab) => (abilities[ab] ?? 0) >= rule.minimum);
      if (!ok) {
        unmetRequirements.push(
          `${labelCa} requereix ${formatMulticlassRequirementCa(cls.classId)} per a multiclasse (actual: ${rule.abilities
            .map((ab) => `${ABILITY_SHORT_CA[ab]} ${abilities[ab] ?? '—'}`)
            .join(', ')}).`
        );
      }
    } else {
      const missing = rule.abilities.filter((ab) => (abilities[ab] ?? 0) < rule.minimum);
      if (missing.length > 0) {
        unmetRequirements.push(
          `${labelCa} requereix ${formatMulticlassRequirementCa(cls.classId)} per a multiclasse (manca ${missing
            .map((ab) => `${ABILITY_LABELS_CA[ab]} ${rule.minimum}`)
            .join(' i ')}).`
        );
      }
    }
  }

  return {
    eligible: unmetRequirements.length === 0,
    unmetRequirements,
  };
}

export type LevelUpErrorCode =
  | 'LEVEL_UP_NO_CLASS'
  | 'LEVEL_UP_MAX_LEVEL_REACHED'
  | 'LEVEL_UP_SKIP_FORBIDDEN'
  | 'INSUFFICIENT_XP_FOR_LEVEL_UP'
  | 'STALE_LEVEL_UP_STATE'
  | 'LEVEL_UP_XP_MUTATION_FORBIDDEN';

export interface LevelUpEligibilityResult {
  allowed: boolean;
  code: LevelUpErrorCode | null;
  reason: string | null;
  currentLevel: number;
  nextLevel: number | null;
  currentXp: number;
  requiredXpForNextLevel: number | null;
  xpMissing: number;
}

/**
 * Evaluates whether a character is officially eligible to advance +1 level under D&D 5e (2014) rules:
 * - XP is cumulative (never spent on level-up).
 * - Only single-step advances (`currentLevel + 1`, capped at 20) are allowed.
 * - Cumulative XP must meet or exceed the official threshold (`XP_THRESHOLDS_2014` via `computeProgression`).
 */
export function evaluateLevelUpEligibility(
  sheet: Dnd5e2014SheetData,
  options?: {
    targetLevel?: number;
    expectedCurrentLevel?: number;
  }
): LevelUpEligibilityResult {
  const currentLevel = calculateTotalLevel(sheet);
  const prog = computeProgression(sheet, currentLevel);
  const currentXp = prog.experiencePoints;

  if (
    options?.expectedCurrentLevel !== undefined &&
    options.expectedCurrentLevel !== currentLevel
  ) {
    return {
      allowed: false,
      code: 'STALE_LEVEL_UP_STATE',
      reason: `L’estat del personatge ha canviat (nivell actual ${currentLevel}, esperat ${options.expectedCurrentLevel}). Recarrega la fitxa abans de tornar-ho a intentar.`,
      currentLevel,
      nextLevel: prog.nextLevel,
      currentXp,
      requiredXpForNextLevel: prog.nextLevelXp,
      xpMissing: prog.xpToNextLevel ?? 0,
    };
  }

  if (sheet.raceAndClass.classes.length === 0) {
    return {
      allowed: false,
      code: 'LEVEL_UP_NO_CLASS',
      reason: 'Assigna primer una classe inicial abans de pujar de nivell.',
      currentLevel,
      nextLevel: null,
      currentXp,
      requiredXpForNextLevel: null,
      xpMissing: 0,
    };
  }

  if (
    prog.isMaxLevel ||
    (options?.targetLevel !== undefined && options.targetLevel > MAX_OFFICIAL_LEVEL_2014)
  ) {
    return {
      allowed: false,
      code: 'LEVEL_UP_MAX_LEVEL_REACHED',
      reason:
        prog.maxLevelMessageCa ??
        'El personatge ja ha assolit el nivell màxim oficial (20) de D&D 5e (2014).',
      currentLevel,
      nextLevel: null,
      currentXp,
      requiredXpForNextLevel: null,
      xpMissing: 0,
    };
  }

  const nextLevel = prog.nextLevel!;
  const requiredXp = prog.nextLevelXp!;

  if (options?.targetLevel !== undefined && options.targetLevel !== nextLevel) {
    if (options.targetLevel > nextLevel) {
      return {
        allowed: false,
        code: 'LEVEL_UP_SKIP_FORBIDDEN',
        reason: `Només es pot pujar un nivell per operació (de nivell ${currentLevel} a ${nextLevel}); no es permet saltar al nivell ${options.targetLevel}.`,
        currentLevel,
        nextLevel,
        currentXp,
        requiredXpForNextLevel: requiredXp,
        xpMissing: Math.max(0, requiredXp - currentXp),
      };
    }
    return {
      allowed: false,
      code: 'STALE_LEVEL_UP_STATE',
      reason: `El personatge ja es troba al nivell ${currentLevel}; aquesta operació de pujada al nivell ${options.targetLevel} ha quedat obsoleta.`,
      currentLevel,
      nextLevel,
      currentXp,
      requiredXpForNextLevel: requiredXp,
      xpMissing: Math.max(0, requiredXp - currentXp),
    };
  }

  if (currentXp < requiredXp) {
    const xpMissing = requiredXp - currentXp;
    return {
      allowed: false,
      code: 'INSUFFICIENT_XP_FOR_LEVEL_UP',
      reason: `Calen ${requiredXp.toLocaleString('ca-ES')} PE acumulats per pujar al nivell ${nextLevel} (actuals: ${currentXp.toLocaleString('ca-ES')} PE; en falten ${xpMissing.toLocaleString('ca-ES')} PE).`,
      currentLevel,
      nextLevel,
      currentXp,
      requiredXpForNextLevel: requiredXp,
      xpMissing,
    };
  }

  return {
    allowed: true,
    code: null,
    reason: null,
    currentLevel,
    nextLevel,
    currentXp,
    requiredXpForNextLevel: requiredXp,
    xpMissing: 0,
  };
}

export interface LevelUpSelection {
  mode: 'existing' | 'multiclass';
  classId: string;
  customClassName?: string;
  subclassId?: string | null;
  customSubclassName?: string | null;
}

export interface LevelUpResourceDelta {
  key: string;
  name: string;
  beforeMax: number | null;
  afterMax: number | null;
  unlimitedAfter: boolean;
  isNew: boolean;
}

export interface LevelUpPreview {
  canLevelUp: boolean;
  blockReason: string | null;
  eligibilityCode: LevelUpErrorCode | null;
  currentTotalLevel: number;
  nextTotalLevel: number;
  currentClassLevel: number;
  nextClassLevel: number;
  classLabelCa: string;
  xp: {
    currentXp: number;
    requiredXpForNextLevel: number | null;
    xpMissing: number;
    hasEnoughXp: boolean;
  };
  isMulticlassAddition: boolean;
  multiclassCheck: {
    eligible: boolean;
    unmetRequirements: string[];
    gainedProficiencies: MulticlassProficiencyGrant | null;
  };
  proficiencyBonusBefore: number;
  proficiencyBonusAfter: number;
  proficiencyBonusIncreased: boolean;
  hp: {
    hitDie: 6 | 8 | 10 | 12 | null;
    conModifier: number;
    hillDwarfBonus: number;
    averageGain: number;
    minGain: number;
    maxGain: number;
  };
  subclassUnlock: {
    unlocksNow: boolean;
    needsSelection: boolean;
    subclassLevel: number | null;
    availableSubclasses: readonly SubclassCatalogEntry[];
  };
  asiUnlock: {
    unlocksNow: boolean;
    asiLevel: number | null;
  };
  unlockedClassFeatures: readonly ClassFeatureMilestone[];
  spellcastingDelta: {
    before: ComputedSpellcasting | null;
    after: ComputedSpellcasting | null;
    gainedSlots: Array<{ level: number; before: number; after: number }>;
    pactChanged: boolean;
    preparedLimitDelta: number | null;
  };
  resourceDelta: readonly LevelUpResourceDelta[];
}

function isHillDwarfRace(subrace: string | null): boolean {
  if (!subrace) return false;
  const norm = normalizeMatchText(subrace);
  return norm.includes('turons') || norm.includes('hill');
}

function buildSimulatedSheetWithClassLevel(
  sheet: Dnd5e2014SheetData,
  selection: LevelUpSelection
): Dnd5e2014SheetData {
  const next = structuredClone(sheet);
  if (selection.mode === 'existing') {
    const idx = next.raceAndClass.classes.findIndex((c) => c.classId === selection.classId);
    if (idx >= 0) {
      const curr = next.raceAndClass.classes[idx];
      next.raceAndClass.classes[idx] = {
        ...curr,
        level: curr.level + 1,
        subclassId:
          selection.subclassId !== undefined ? selection.subclassId : (curr.subclassId ?? null),
        customSubclassName:
          selection.customSubclassName !== undefined
            ? selection.customSubclassName
            : (curr.customSubclassName ?? null),
      };
    }
  } else {
    next.raceAndClass.classes.push({
      classId: selection.classId,
      customClassName:
        selection.classId === 'custom'
          ? (selection.customClassName?.trim() || 'Classe personalitzada')
          : null,
      subclassId: selection.subclassId ?? null,
      customSubclassName: selection.customSubclassName ?? null,
      level: 1,
    });
  }
  next.progression.totalLevel = next.raceAndClass.classes.reduce((sum, c) => sum + c.level, 0);
  return next;
}

export function previewLevelUp(
  sheet: Dnd5e2014SheetData,
  selection: LevelUpSelection
): LevelUpPreview {
  const eligibility = evaluateLevelUpEligibility(sheet);
  const currentTotalLevel = calculateTotalLevel(sheet);
  const classMeta = getClassEntry(selection.classId);
  const existingEntry =
    selection.mode === 'existing'
      ? sheet.raceAndClass.classes.find((c) => c.classId === selection.classId)
      : undefined;

  const isMulticlassAddition =
    selection.mode === 'multiclass' && sheet.raceAndClass.classes.length > 0;
  const duplicateOfficial =
    selection.mode === 'multiclass' &&
    selection.classId !== 'custom' &&
    sheet.raceAndClass.classes.some((c) => c.classId === selection.classId);

  let blockReason: string | null = eligibility.allowed ? null : eligibility.reason;
  if (!blockReason && selection.mode === 'existing' && !existingEntry) {
    blockReason = 'La classe seleccionada no forma part del personatge actual.';
  } else if (!blockReason && duplicateOfficial) {
    blockReason = 'Aquesta classe oficial ja existeix al personatge; puja-la des del selector existent.';
  } else if (
    !blockReason &&
    selection.mode === 'multiclass' &&
    selection.classId === 'custom' &&
    !selection.customClassName?.trim()
  ) {
    blockReason = 'Cal indicar un nom per a la classe personalitzada.';
  }

  const nextTotalLevel = Math.min(MAX_OFFICIAL_LEVEL_2014, currentTotalLevel + 1);
  const currentClassLevel = existingEntry?.level ?? 0;
  const nextClassLevel = currentClassLevel + 1;
  const classLabelCa =
    existingEntry?.customClassName?.trim() ||
    selection.customClassName?.trim() ||
    classMeta?.labelCa ||
    selection.classId;

  const simulated = blockReason
    ? sheet
    : buildSimulatedSheetWithClassLevel(sheet, selection);

  const mcCheck = validateMulticlassPrerequisites(simulated.raceAndClass.classes, simulated.abilities);
  const gainedProficiencies = isMulticlassAddition
    ? (MULTICLASS_PROFICIENCIES_2014[selection.classId] ?? null)
    : null;

  const conMod = calculateAbilityModifier(sheet.abilities.con) ?? 0;
  const hillDwarfBonus = isHillDwarfRace(sheet.raceAndClass.subrace) ? 1 : 0;
  const hitDie = classMeta?.hitDie ?? null;
  const avgBase = hitDie ? getHitDieAverageGain(hitDie) : 5;
  const averageGain = Math.max(1, avgBase + conMod + hillDwarfBonus);
  const maxGain = Math.max(1, (hitDie ?? 8) + conMod + hillDwarfBonus);

  const subclassLevel = classMeta?.subclassLevel ?? null;
  const unlocksNow =
    subclassLevel !== null && nextClassLevel === subclassLevel;
  const hasSubclassAlready = Boolean(
    existingEntry?.subclassId || existingEntry?.customSubclassName
  );
  const needsSelection =
    subclassLevel !== null && nextClassLevel >= subclassLevel && !hasSubclassAlready;
  const availableSubclasses = DND5E_SUBCLASSES.filter((s) => s.classId === selection.classId);

  const asiUnlockNow = classMeta ? classMeta.asiLevels.includes(nextClassLevel) : false;
  const unlockedClassFeatures = classMeta
    ? classMeta.keyFeatureMilestones.filter((m) => m.level === nextClassLevel)
    : [];

  const profBefore = calculateProficiencyBonus(Math.max(MIN_OFFICIAL_LEVEL_2014, currentTotalLevel));
  const profAfter = calculateProficiencyBonus(Math.max(MIN_OFFICIAL_LEVEL_2014, nextTotalLevel));

  const beforeSnap = computeDnd5e2014Sheet(sheet);
  const afterMods = beforeSnap.abilities;
  const modRecord: Record<AbilityKey, number | null> = {
    str: afterMods.str.modifier,
    dex: afterMods.dex.modifier,
    con: afterMods.con.modifier,
    int: afterMods.int.modifier,
    wis: afterMods.wis.modifier,
    cha: afterMods.cha.modifier,
  };

  const spellBefore = beforeSnap.spellcasting;
  const spellAfter = computeSpellcasting(simulated, modRecord, profAfter);
  const gainedSlots: Array<{ level: number; before: number; after: number }> = [];
  for (let lvl = 1; lvl <= 9; lvl++) {
    const beforeCount = spellBefore?.slots.find((s) => s.level === lvl)?.total ?? 0;
    const afterCount = spellAfter?.slots.find((s) => s.level === lvl)?.total ?? 0;
    if (afterCount !== beforeCount) {
      gainedSlots.push({ level: lvl, before: beforeCount, after: afterCount });
    }
  }

  const pactBefore = spellBefore?.pactMagic;
  const pactAfter = spellAfter?.pactMagic;
  const pactChanged =
    Boolean(pactAfter) &&
    (!pactBefore ||
      pactBefore.count !== pactAfter!.count ||
      pactBefore.slotLevel !== pactAfter!.slotLevel);

  const srcBefore = spellBefore?.sources.find((s) => s.classId === selection.classId);
  const srcAfter = spellAfter?.sources.find((s) => s.classId === selection.classId);
  const preparedLimitDelta =
    srcAfter && srcAfter.preparedLimit !== null
      ? srcAfter.preparedLimit - (srcBefore?.preparedLimit ?? 0)
      : null;

  const resBeforeMap = new Map(beforeSnap.resources.map((r) => [r.key, r]));
  const resAfter = computeCharacterResources(simulated, modRecord, profAfter);
  const resourceDelta: LevelUpResourceDelta[] = [];
  for (const r of resAfter) {
    const prev = resBeforeMap.get(r.key);
    if (!prev) {
      resourceDelta.push({
        key: r.key,
        name: r.name,
        beforeMax: null,
        afterMax: r.totalUses,
        unlimitedAfter: r.unlimited,
        isNew: true,
      });
    } else if (prev.totalUses !== r.totalUses || prev.unlimited !== r.unlimited) {
      resourceDelta.push({
        key: r.key,
        name: r.name,
        beforeMax: prev.totalUses,
        afterMax: r.totalUses,
        unlimitedAfter: r.unlimited,
        isNew: false,
      });
    }
  }

  return {
    canLevelUp: blockReason === null,
    blockReason,
    eligibilityCode: eligibility.code,
    currentTotalLevel,
    nextTotalLevel,
    currentClassLevel,
    nextClassLevel,
    classLabelCa,
    xp: {
      currentXp: eligibility.currentXp,
      requiredXpForNextLevel: eligibility.requiredXpForNextLevel,
      xpMissing: eligibility.xpMissing,
      hasEnoughXp: eligibility.code !== 'INSUFFICIENT_XP_FOR_LEVEL_UP',
    },
    isMulticlassAddition,
    multiclassCheck: {
      eligible: mcCheck.eligible,
      unmetRequirements: mcCheck.unmetRequirements,
      gainedProficiencies,
    },
    proficiencyBonusBefore: profBefore,
    proficiencyBonusAfter: profAfter,
    proficiencyBonusIncreased: profAfter > profBefore,
    hp: {
      hitDie,
      conModifier: conMod,
      hillDwarfBonus,
      averageGain,
      minGain: 1,
      maxGain,
    },
    subclassUnlock: {
      unlocksNow,
      needsSelection,
      subclassLevel,
      availableSubclasses,
    },
    asiUnlock: {
      unlocksNow: asiUnlockNow,
      asiLevel: asiUnlockNow ? nextClassLevel : null,
    },
    unlockedClassFeatures,
    spellcastingDelta: {
      before: spellBefore,
      after: spellAfter,
      gainedSlots,
      pactChanged,
      preparedLimitDelta,
    },
    resourceDelta,
  };
}

export interface LevelUpApplyInput {
  selection: LevelUpSelection;
  hpMode: 'average' | 'custom';
  customHpGain?: number | null;
  subclassId?: string | null;
  customSubclassName?: string | null;
  asiChoice?: 'none' | 'asi_plus2' | 'asi_plus1_plus1' | 'feat';
  asiAbility1?: AbilityKey | null;
  asiAbility2?: AbilityKey | null;
  featName?: string;
  featDescription?: string;
  addUnlockedFeatures?: boolean;
  multiclassSkillId?: SkillId | null;
  newSpells?: Dnd5e2014SpellEntry[];
  notes?: string;
  date?: string;
  isGm?: boolean;
}

export function buildLevelUpPatch(
  sheet: Dnd5e2014SheetData,
  input: LevelUpApplyInput
): { patch: Dnd5e2014SheetPatchInput; errors: string[] } {
  const errors: string[] = [];
  const effectiveSelection: LevelUpSelection = {
    ...input.selection,
    subclassId:
      input.subclassId !== undefined ? input.subclassId : input.selection.subclassId,
    customSubclassName:
      input.customSubclassName !== undefined
        ? input.customSubclassName
        : input.selection.customSubclassName,
  };
  const preview = previewLevelUp(sheet, effectiveSelection);

  if (!preview.canLevelUp) {
    return {
      patch: {},
      errors: [preview.blockReason ?? 'No es pot pujar de nivell aquest personatge.'],
    };
  }

  if (preview.isMulticlassAddition && !preview.multiclassCheck.eligible && !input.isGm) {
    errors.push(...preview.multiclassCheck.unmetRequirements);
  }

  const hpGain =
    input.hpMode === 'average'
      ? preview.hp.averageGain
      : Math.trunc(Number(input.customHpGain ?? 0));
  if (!Number.isFinite(hpGain) || hpGain < 1) {
    errors.push('L’increment de punts de cop ha de ser com a mínim 1.');
  } else if (!input.isGm && hpGain > preview.hp.maxGain) {
    errors.push(`L’increment de PV no pot superar el màxim del dau (${preview.hp.maxGain}).`);
  }

  // Validate ASI / Feat if unlocked
  const abilitiesPatch: Partial<Record<AbilityKey, number>> = {};
  let asiSummaryNote = '';
  const asiChoice = input.asiChoice ?? 'none';

  if (preview.asiUnlock.unlocksNow && asiChoice !== 'none') {
    if (asiChoice === 'asi_plus2') {
      const ab = input.asiAbility1;
      if (!ab) {
        errors.push('Selecciona la característica a millorar en +2.');
      } else {
        const curr = sheet.abilities[ab] ?? 10;
        if (curr >= 20 && !input.isGm) {
          errors.push(`${ABILITY_LABELS_CA[ab]} ja està al màxim oficial de 20.`);
        } else {
          const nextVal = input.isGm ? curr + 2 : Math.min(20, curr + 2);
          abilitiesPatch[ab] = nextVal;
          asiSummaryNote = `ASI +2 ${ABILITY_SHORT_CA[ab]} (${curr}→${nextVal})`;
        }
      }
    } else if (asiChoice === 'asi_plus1_plus1') {
      const a1 = input.asiAbility1;
      const a2 = input.asiAbility2;
      if (!a1 || !a2 || a1 === a2) {
        errors.push('Selecciona dues característiques diferents per repartir +1 i +1.');
      } else {
        const c1 = sheet.abilities[a1] ?? 10;
        const c2 = sheet.abilities[a2] ?? 10;
        if ((c1 >= 20 || c2 >= 20) && !input.isGm) {
          errors.push('Una de les característiques seleccionades ja és a 20.');
        } else {
          abilitiesPatch[a1] = input.isGm ? c1 + 1 : Math.min(20, c1 + 1);
          abilitiesPatch[a2] = input.isGm ? c2 + 1 : Math.min(20, c2 + 1);
          asiSummaryNote = `ASI +1 ${ABILITY_SHORT_CA[a1]} / +1 ${ABILITY_SHORT_CA[a2]}`;
        }
      }
    } else if (asiChoice === 'feat') {
      const featName = input.featName?.trim() ?? '';
      if (!featName) {
        errors.push('Indica el nom del dot que substitueix l’ASI.');
      } else {
        asiSummaryNote = `Dot: ${featName}`;
      }
    }
  }

  if (errors.length > 0) {
    return { patch: {}, errors };
  }

  const simulated = buildSimulatedSheetWithClassLevel(sheet, effectiveSelection);
  const nextClasses = simulated.raceAndClass.classes;
  const subMeta = getSubclassEntry(effectiveSelection.subclassId ?? null);

  const patch: Dnd5e2014SheetPatchInput = {
    raceAndClass: {
      classes: nextClasses,
    },
    hitPoints: {
      max: (sheet.hitPoints.max ?? 0) + hpGain,
      current:
        sheet.hitPoints.current !== null
          ? sheet.hitPoints.current + hpGain
          : (sheet.hitPoints.max ?? 0) + hpGain,
    },
  };

  if (Object.keys(abilitiesPatch).length > 0) {
    patch.abilities = abilitiesPatch;
  }

  // Progression: totalLevel, levelHistory, and abilityScoreImprovements
  const today = input.date?.trim() || new Date().toISOString().slice(0, 10);
  const historyNoteParts: string[] = [];
  if (asiSummaryNote) historyNoteParts.push(asiSummaryNote);
  if (input.notes?.trim()) historyNoteParts.push(input.notes.trim());

  const newHistoryEntry: Dnd5e2014LevelHistoryEntry = {
    id: `lh-${preview.nextTotalLevel}-${Date.now()}`,
    level: preview.nextTotalLevel,
    classId: effectiveSelection.classId,
    customClassName:
      effectiveSelection.classId === 'custom'
        ? (effectiveSelection.customClassName?.trim() || 'Classe personalitzada')
        : null,
    subclassId: effectiveSelection.subclassId ?? null,
    hpGain,
    notes: historyNoteParts.join(' · '),
    date: today,
  };

  const nextAsiEntries =
    preview.asiUnlock.unlocksNow && asiSummaryNote
      ? [
          ...sheet.progression.abilityScoreImprovements,
          { level: preview.nextTotalLevel, notes: asiSummaryNote },
        ]
      : undefined;

  patch.progression = {
    totalLevel: preview.nextTotalLevel,
    levelHistory: [...sheet.progression.levelHistory, newHistoryEntry],
    ...(nextAsiEntries ? { abilityScoreImprovements: nextAsiEntries } : {}),
  };

  // Multiclass proficiencies (only if adding a new class)
  if (preview.isMulticlassAddition && preview.multiclassCheck.gainedProficiencies) {
    const mc = preview.multiclassCheck.gainedProficiencies;
    const armor = Array.from(new Set([...sheet.proficiencies.armor, ...mc.armor]));
    const weapons = Array.from(new Set([...sheet.proficiencies.weapons, ...mc.weapons]));
    const tools = Array.from(new Set([...sheet.proficiencies.tools, ...mc.tools]));
    const profPatch: NonNullable<Dnd5e2014SheetPatchInput['proficiencies']> = {};
    if (armor.length !== sheet.proficiencies.armor.length) profPatch.armor = armor;
    if (weapons.length !== sheet.proficiencies.weapons.length) profPatch.weapons = weapons;
    if (tools.length !== sheet.proficiencies.tools.length) profPatch.tools = tools;
    if (Object.keys(profPatch).length > 0) {
      patch.proficiencies = profPatch;
    }

    if (
      mc.extraSkillCount > 0 &&
      input.multiclassSkillId &&
      mc.skillPool.includes(input.multiclassSkillId) &&
      !sheet.skills.proficient.includes(input.multiclassSkillId)
    ) {
      patch.skills = {
        proficient: [...sheet.skills.proficient, input.multiclassSkillId],
      };
    }
  }

  // Unlocked traits & feat
  const traitsToAppend: Dnd5e2014TraitEntry[] = [];
  if (input.addUnlockedFeatures !== false && preview.unlockedClassFeatures.length > 0) {
    for (const feat of preview.unlockedClassFeatures) {
      const alreadyExists = sheet.traitsAndFeatures.some(
        (t) => normalizeMatchText(t.name) === normalizeMatchText(feat.titleCa)
      );
      if (!alreadyExists) {
        traitsToAppend.push({
          id: `trait-lvl-${preview.nextTotalLevel}-${traitsToAppend.length + 1}`,
          name: feat.titleCa,
          source: subMeta
            ? `${preview.classLabelCa} (${subMeta.labelCa})`
            : preview.classLabelCa,
          levelUnlocked: preview.nextClassLevel,
          description: feat.descriptionCa,
        });
      }
    }
  }
  if (preview.asiUnlock.unlocksNow && asiChoice === 'feat' && input.featName?.trim()) {
    traitsToAppend.push({
      id: `feat-lvl-${preview.nextTotalLevel}-${Date.now()}`,
      name: input.featName.trim(),
      source: 'Dot',
      levelUnlocked: preview.nextTotalLevel,
      description: input.featDescription?.trim() ?? '',
    });
  }
  if (traitsToAppend.length > 0) {
    patch.traitsAndFeatures = [...sheet.traitsAndFeatures, ...traitsToAppend];
  }

  if (input.newSpells && input.newSpells.length > 0) {
    patch.spells = [...sheet.spells, ...input.newSpells];
  }

  if (effectiveSelection.classId === 'wizard' && !sheet.spellcasting.usesSpellbook) {
    patch.spellcasting = { usesSpellbook: true };
  }

  return { patch, errors: [] };
}
