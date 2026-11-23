import type { GameSystemSectionDefinition } from '../types';
import {
  ABILITY_KEYS,
  DND5E_SKILLS,
  MAX_OFFICIAL_LEVEL_2014,
  MIN_OFFICIAL_LEVEL_2014,
  resolveClassId,
  type AbilityKey,
  type SkillId,
} from './catalog';
import type { RollMode } from './dice';

export type Dnd5e2014AbilityScores = Record<AbilityKey, number | null>;

export type ResourceRecovery = 'short_rest' | 'long_rest' | 'dawn' | 'other';

export type InventoryCategory =
  | 'weapon'
  | 'armor'
  | 'shield'
  | 'gear'
  | 'magic_item'
  | 'treasure'
  | 'custom';
export type ArmorType = 'light' | 'medium' | 'heavy';

export type SpellSourceType = 'class' | 'pact' | 'feature' | 'race' | 'item' | 'custom';

export interface Dnd5e2014ClassEntry {
  classId: string;
  customClassName?: string | null;
  subclassId?: string | null;
  customSubclassName?: string | null;
  level: number;
}

export interface Dnd5e2014AttackEntry {
  id: string;
  inventoryItemId: string | null;
  name: string;
  ability: AbilityKey | null;
  proficient: boolean;
  bonusOverride: number | null;
  attackBonus: string | null;
  damage: string | null;
  damageType: string | null;
  range: string | null;
  notes: string;
}

export interface Dnd5e2014InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  weight: number | null;
  equipped: boolean;
  armorType: ArmorType | null;
  baseAc: number | null;
  acBonus: number | null;
  requiresAttunement: boolean;
  attuned: boolean;
  weaponAbility: AbilityKey | null;
  weaponProficient: boolean;
  damage: string | null;
  damageType: string | null;
  weaponRange: string | null;
  weaponProperties: string;
  notes: string;
}

export interface Dnd5e2014TraitEntry {
  id: string;
  name: string;
  source: string | null;
  levelUnlocked: number | null;
  description: string;
}

export interface Dnd5e2014SpellEntry {
  id: string;
  level: number;
  name: string;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  school: string | null;
  sourceType: SpellSourceType;
  sourceClassId: string | null;
  alwaysPrepared: boolean;
  prepared: boolean;
  inSpellbook: boolean;
  ritual: boolean;
  concentration: boolean;
  notes: string;
}

export interface Dnd5e2014CustomResource {
  id: string;
  name: string;
  maxUses: number;
  recovery: ResourceRecovery;
  description: string;
}

export interface Dnd5e2014SessionNote {
  id: string;
  date: string;
  title: string;
  content: string;
}

export interface Dnd5e2014AsiEntry {
  level: number;
  notes: string;
}

export interface Dnd5e2014LevelHistoryEntry {
  id: string;
  level: number;
  classId: string;
  customClassName: string | null;
  subclassId: string | null;
  hpGain: number | null;
  notes: string;
  date: string;
}

/**
 * Universal raw data schema (v2) for any D&D 5e (2014) character.
 * Stores raw player/GM inputs ONLY. All modifiers, proficiency bonuses, AC,
 * skills, saving throws, spell DCs, slot maximums, and class resource maximums
 * are computed dynamically by the rules engine (`rules.ts`, `attacks.ts` & `resources.ts`).
 */
export interface Dnd5e2014SheetData extends Record<string, unknown> {
  generalInfo: {
    name: string;
    playerName: string | null;
    alignment: string | null;
    faith: string | null;
    age: string | null;
    size: string | null;
    senses: string | null;
    appearanceNotes: string;
  };
  raceAndClass: {
    race: string | null;
    subrace: string | null;
    classes: Dnd5e2014ClassEntry[];
  };
  abilities: Dnd5e2014AbilityScores;
  savingThrows: {
    proficient: AbilityKey[];
    overrides: Partial<Record<AbilityKey, number>>;
    rollModes: Partial<Record<AbilityKey, RollMode>>;
  };
  skills: {
    proficient: SkillId[];
    expertise: SkillId[];
    halfProficient: boolean;
    overrides: Partial<Record<SkillId, number>>;
    rollModes: Partial<Record<SkillId, RollMode>>;
  };
  proficiencies: {
    armor: string[];
    weapons: string[];
    tools: string[];
    languages: string[];
  };
  hitPoints: {
    max: number | null;
    current: number | null;
    temporary: number | null;
    hitDice: string | null;
    hitDiceUsed: number;
    deathSaves: {
      successes: number;
      failures: number;
    };
  };
  armorClass: {
    override: number | null;
    unarmoredFormula: 'none' | 'barbarian' | 'monk';
    notes: string;
  };
  initiative: {
    override: number | null;
    bonus: number;
  };
  speed: {
    walk: number | null;
    fly: number | null;
    swim: number | null;
    climb: number | null;
  };
  attacks: Dnd5e2014AttackEntry[];
  inventory: Dnd5e2014InventoryItem[];
  attunement: {
    limitOverride: number | null;
  };
  currency: {
    cp: number;
    sp: number;
    ep: number;
    gp: number;
    pp: number;
  };
  traitsAndFeatures: Dnd5e2014TraitEntry[];
  spellcasting: {
    abilityOverride: AbilityKey | null;
    saveDcOverride: number | null;
    attackBonusOverride: number | null;
    usesSpellbook: boolean;
    notes: string;
  };
  spells: Dnd5e2014SpellEntry[];
  spellSlotsUsed: Record<string, number>;
  spellSlotOverrides: Record<string, number>;
  resourceUsage: Record<string, number>;
  customResources: Dnd5e2014CustomResource[];
  progression: {
    totalLevel: number | null;
    experiencePoints: number;
    inspiration: boolean;
    abilityScoreImprovements: Dnd5e2014AsiEntry[];
    levelHistory: Dnd5e2014LevelHistoryEntry[];
  };
  background: {
    backgroundName: string | null;
    personalityTraits: string;
    ideals: string;
    bonds: string;
    flaws: string;
    backstory: string;
    sessionNotes: Dnd5e2014SessionNote[];
    additionalNotes: string;
  };
}

export const DND5E_2014_SECTIONS: GameSystemSectionDefinition[] = [
  { key: 'generalInfo', labelCa: 'Informació general', descriptionCa: 'Nom, aspecte i dades bàsiques.' },
  { key: 'raceAndClass', labelCa: 'Raça i classe', descriptionCa: 'Llinatge, classe, subclasse i nivells.' },
  { key: 'abilities', labelCa: 'Característiques', descriptionCa: 'Puntuacions base (FOR, DES, CON, INT, SAV, CAR).' },
  { key: 'savingThrows', labelCa: 'Salvacions', descriptionCa: 'Competències i excepcions de salvació.' },
  { key: 'skills', labelCa: 'Habilitats', descriptionCa: 'Les 18 habilitats, competències, expertesa i excepcions.' },
  { key: 'proficiencies', labelCa: 'Competències', descriptionCa: 'Armadures, armes, eines i idiomes.' },
  { key: 'hitPoints', labelCa: 'Punts de cop', descriptionCa: 'Vida màxima, actual, temporal i daus de cop.' },
  { key: 'armorClass', labelCa: "Classe d'armadura", descriptionCa: 'Protecció calculada i excepcions.' },
  { key: 'initiative', labelCa: 'Iniciativa', descriptionCa: 'Ordre d’actuació i bonificadors.' },
  { key: 'speed', labelCa: 'Velocitat', descriptionCa: 'Desplaçament base i especials.' },
  { key: 'attacks', labelCa: 'Atacs', descriptionCa: 'Armes i conjurs ofensius freqüents.' },
  { key: 'inventory', labelCa: 'Equipament i inventari', descriptionCa: 'Armes, armadures, escuts, objectes i pes.' },
  { key: 'currency', labelCa: 'Monedes', descriptionCa: 'PC, PP, PE, PO i platí.' },
  { key: 'traitsAndFeatures', labelCa: 'Trets i aptituds', descriptionCa: 'Trets racials, de classe i dots.' },
  { key: 'spells', labelCa: 'Màgia, conjurs i grimori', descriptionCa: 'Conjurs, espais de conjur i CD.' },
  { key: 'resources', labelCa: 'Recursos especials', descriptionCa: 'Usos de classe, subclasse i personalitzats.' },
  { key: 'progression', labelCa: 'Progressió i experiència', descriptionCa: 'Nivell, PE, millores i evolució.' },
  { key: 'background', labelCa: 'Història i diari', descriptionCa: 'Rerefons, trets, ideals, vincles, defectes i notes de sessió.' },
];

export function createEmptyDnd5e2014Sheet(characterName: string): Dnd5e2014SheetData {
  return {
    generalInfo: {
      name: characterName,
      playerName: null,
      alignment: null,
      faith: null,
      age: null,
      size: null,
      senses: null,
      appearanceNotes: '',
    },
    raceAndClass: {
      race: null,
      subrace: null,
      classes: [],
    },
    abilities: {
      str: null,
      dex: null,
      con: null,
      int: null,
      wis: null,
      cha: null,
    },
    savingThrows: {
      proficient: [],
      overrides: {},
      rollModes: {},
    },
    skills: {
      proficient: [],
      expertise: [],
      halfProficient: false,
      overrides: {},
      rollModes: {},
    },
    proficiencies: {
      armor: [],
      weapons: [],
      tools: [],
      languages: [],
    },
    hitPoints: {
      max: null,
      current: null,
      temporary: null,
      hitDice: null,
      hitDiceUsed: 0,
      deathSaves: {
        successes: 0,
        failures: 0,
      },
    },
    armorClass: {
      override: null,
      unarmoredFormula: 'none',
      notes: '',
    },
    initiative: {
      override: null,
      bonus: 0,
    },
    speed: {
      walk: null,
      fly: null,
      swim: null,
      climb: null,
    },
    attacks: [],
    inventory: [],
    attunement: {
      limitOverride: null,
    },
    currency: {
      cp: 0,
      sp: 0,
      ep: 0,
      gp: 0,
      pp: 0,
    },
    traitsAndFeatures: [],
    spellcasting: {
      abilityOverride: null,
      saveDcOverride: null,
      attackBonusOverride: null,
      usesSpellbook: false,
      notes: '',
    },
    spells: [],
    spellSlotsUsed: {},
    spellSlotOverrides: {},
    resourceUsage: {},
    customResources: [],
    progression: {
      totalLevel: null,
      experiencePoints: 0,
      inspiration: false,
      abilityScoreImprovements: [],
      levelHistory: [],
    },
    background: {
      backgroundName: null,
      personalityTraits: '',
      ideals: '',
      bonds: '',
      flaws: '',
      backstory: '',
      sessionNotes: [],
      additionalNotes: '',
    },
  };
}

function asObj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStr(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableStr(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function asNullableNum(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asNum(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asStrArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

function clampOfficialLevel(raw: number): number {
  return Math.min(MAX_OFFICIAL_LEVEL_2014, Math.max(MIN_OFFICIAL_LEVEL_2014, Math.floor(raw)));
}

const VALID_ABILITY_SET = new Set<string>(ABILITY_KEYS);
const VALID_SKILL_SET = new Set<string>(DND5E_SKILLS.map((s) => s.id));
const VALID_SPELL_SOURCE_SET = new Set<string>([
  'class',
  'pact',
  'feature',
  'race',
  'item',
  'custom',
]);

function normalizeRollModeMap<TKey extends string>(
  raw: unknown,
  validKeySet: Set<string>
): Partial<Record<TKey, RollMode>> {
  const obj = asObj(raw);
  const out: Partial<Record<TKey, RollMode>> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!validKeySet.has(k)) continue;
    if (v === 'advantage' || v === 'disadvantage' || v === 'normal') {
      out[k as TKey] = v;
    }
  }
  return out;
}

/**
 * Normalizes any persisted sheet payload (including Phase 1–2 v1 skeletons and earlier v2 sheets)
 * into a valid universal v2 D&D 5e (2014) sheet object without dropping user data.
 */
export function normalizeDnd5e2014Sheet(raw: unknown, fallbackName: string): Dnd5e2014SheetData {
  const base = createEmptyDnd5e2014Sheet(fallbackName);
  const src = asObj(raw);

  const generalInfo = asObj(src.generalInfo);
  base.generalInfo = {
    name: asStr(generalInfo.name, fallbackName) || fallbackName,
    playerName: asNullableStr(generalInfo.playerName),
    alignment: asNullableStr(generalInfo.alignment),
    faith: asNullableStr(generalInfo.faith),
    age: asNullableStr(generalInfo.age),
    size: asNullableStr(generalInfo.size),
    senses: asNullableStr(generalInfo.senses),
    appearanceNotes: asStr(generalInfo.appearanceNotes),
  };

  const raceAndClass = asObj(src.raceAndClass);
  const rawClasses = Array.isArray(raceAndClass.classes) ? raceAndClass.classes : [];
  base.raceAndClass = {
    race: asNullableStr(raceAndClass.race),
    subrace: asNullableStr(raceAndClass.subrace),
    classes: rawClasses
      .map((entry) => {
        const c = asObj(entry);
        const level = clampOfficialLevel(asNum(c.level, 1));
        // Handle both v2 (`classId`) and v1 (`name`)
        if (typeof c.classId === 'string' && c.classId.trim() !== '') {
          return {
            classId: c.classId.trim(),
            customClassName: asNullableStr(c.customClassName),
            subclassId: asNullableStr(c.subclassId),
            customSubclassName: asNullableStr(c.customSubclassName),
            level,
          };
        }
        const legacyName = asNullableStr(c.name);
        const resolvedId = legacyName ? resolveClassId(legacyName) : 'custom';
        return {
          classId: resolvedId,
          customClassName: resolvedId === 'custom' ? legacyName : null,
          subclassId: null,
          customSubclassName: asNullableStr(c.subclass),
          level,
        };
      })
      .filter((c) => c.classId !== 'custom' || Boolean(c.customClassName)),
  };

  const abilities = asObj(src.abilities);
  for (const key of ABILITY_KEYS) {
    base.abilities[key] = asNullableNum(abilities[key]);
  }

  const savingThrows = asObj(src.savingThrows);
  base.savingThrows.proficient = asStrArray(savingThrows.proficient).filter((k): k is AbilityKey =>
    VALID_ABILITY_SET.has(k)
  );
  const stOverrides = asObj(savingThrows.overrides);
  for (const key of ABILITY_KEYS) {
    const val = asNullableNum(stOverrides[key]);
    if (val !== null) base.savingThrows.overrides[key] = val;
  }
  base.savingThrows.rollModes = normalizeRollModeMap<AbilityKey>(
    savingThrows.rollModes,
    VALID_ABILITY_SET
  );

  const skills = asObj(src.skills);
  base.skills.proficient = asStrArray(skills.proficient).filter((k): k is SkillId =>
    VALID_SKILL_SET.has(k)
  );
  base.skills.expertise = asStrArray(skills.expertise).filter((k): k is SkillId =>
    VALID_SKILL_SET.has(k)
  );
  base.skills.halfProficient = asBool(skills.halfProficient, false);
  const skOverrides = asObj(skills.overrides);
  for (const skillId of VALID_SKILL_SET) {
    const val = asNullableNum(skOverrides[skillId]);
    if (val !== null) base.skills.overrides[skillId as SkillId] = val;
  }
  base.skills.rollModes = normalizeRollModeMap<SkillId>(skills.rollModes, VALID_SKILL_SET);

  const profs = asObj(src.proficiencies);
  base.proficiencies = {
    armor: asStrArray(profs.armor),
    weapons: asStrArray(profs.weapons),
    tools: asStrArray(profs.tools),
    languages: asStrArray(profs.languages),
  };

  const hp = asObj(src.hitPoints);
  const ds = asObj(hp.deathSaves);
  base.hitPoints = {
    max: asNullableNum(hp.max),
    current: asNullableNum(hp.current),
    temporary: asNullableNum(hp.temporary),
    hitDice: asNullableStr(hp.hitDice),
    hitDiceUsed: Math.max(0, Math.floor(asNum(hp.hitDiceUsed, 0))),
    deathSaves: {
      successes: Math.min(3, Math.max(0, Math.floor(asNum(ds.successes, 0)))),
      failures: Math.min(3, Math.max(0, Math.floor(asNum(ds.failures, 0)))),
    },
  };

  const ac = asObj(src.armorClass);
  const formula = ac.unarmoredFormula;
  base.armorClass = {
    override: asNullableNum(ac.override),
    unarmoredFormula: formula === 'barbarian' || formula === 'monk' ? formula : 'none',
    notes: asStr(ac.notes),
  };

  const init = asObj(src.initiative);
  base.initiative = {
    override: asNullableNum(init.override),
    bonus: asNum(init.bonus, 0),
  };

  const spd = asObj(src.speed);
  base.speed = {
    walk: asNullableNum(spd.walk),
    fly: asNullableNum(spd.fly),
    swim: asNullableNum(spd.swim),
    climb: asNullableNum(spd.climb),
  };

  if (Array.isArray(src.attacks)) {
    base.attacks = src.attacks.map((rawAtk, idx) => {
      const a = asObj(rawAtk);
      const ab =
        typeof a.ability === 'string' && VALID_ABILITY_SET.has(a.ability)
          ? (a.ability as AbilityKey)
          : null;
      return {
        id: asStr(a.id, `atk-${idx + 1}`),
        inventoryItemId: asNullableStr(a.inventoryItemId),
        name: asStr(a.name),
        ability: ab,
        proficient: asBool(a.proficient, true),
        bonusOverride: asNullableNum(a.bonusOverride),
        attackBonus: asNullableStr(a.attackBonus),
        damage: asNullableStr(a.damage),
        damageType: asNullableStr(a.damageType),
        range: asNullableStr(a.range),
        notes: asStr(a.notes),
      };
    });
  }

  if (Array.isArray(src.inventory)) {
    base.inventory = src.inventory.map((rawItem, idx) => {
      const item = asObj(rawItem);
      const cat = item.category;
      const armorT = item.armorType;
      const wAb =
        typeof item.weaponAbility === 'string' && VALID_ABILITY_SET.has(item.weaponAbility)
          ? (item.weaponAbility as AbilityKey)
          : null;
      const requiresAttunement = asBool(item.requiresAttunement, false);
      return {
        id: asStr(item.id, `item-${idx + 1}`),
        name: asStr(item.name),
        category:
          cat === 'weapon' ||
          cat === 'armor' ||
          cat === 'shield' ||
          cat === 'gear' ||
          cat === 'magic_item' ||
          cat === 'treasure' ||
          cat === 'custom'
            ? cat
            : 'gear',
        quantity: Math.max(0, asNum(item.quantity, 1)),
        weight: asNullableNum(item.weight),
        equipped: asBool(item.equipped, false),
        armorType: armorT === 'light' || armorT === 'medium' || armorT === 'heavy' ? armorT : null,
        baseAc: asNullableNum(item.baseAc),
        acBonus: asNullableNum(item.acBonus),
        requiresAttunement,
        attuned: requiresAttunement ? asBool(item.attuned, false) : false,
        weaponAbility: wAb,
        weaponProficient: asBool(item.weaponProficient, false),
        damage: asNullableStr(item.damage),
        damageType: asNullableStr(item.damageType),
        weaponRange: asNullableStr(item.weaponRange),
        weaponProperties: asStr(item.weaponProperties),
        notes: asStr(item.notes),
      };
    });
  }

  const attunementObj = asObj(src.attunement);
  const rawAttuneLimit = asNullableNum(attunementObj.limitOverride);
  base.attunement = {
    limitOverride: rawAttuneLimit !== null ? Math.max(0, Math.floor(rawAttuneLimit)) : null,
  };

  const curr = asObj(src.currency);
  base.currency = {
    cp: Math.max(0, Math.floor(asNum(curr.cp, 0))),
    sp: Math.max(0, Math.floor(asNum(curr.sp, 0))),
    ep: Math.max(0, Math.floor(asNum(curr.ep, 0))),
    gp: Math.max(0, Math.floor(asNum(curr.gp, 0))),
    pp: Math.max(0, Math.floor(asNum(curr.pp, 0))),
  };

  if (Array.isArray(src.traitsAndFeatures)) {
    base.traitsAndFeatures = src.traitsAndFeatures.map((rawT, idx) => {
      const t = asObj(rawT);
      return {
        id: asStr(t.id, `trait-${idx + 1}`),
        name: asStr(t.name),
        source: asNullableStr(t.source),
        levelUnlocked: asNullableNum(t.levelUnlocked),
        description: asStr(t.description),
      };
    });
  }

  const sc = asObj(src.spellcasting);
  base.spellcasting = {
    abilityOverride:
      typeof sc.abilityOverride === 'string' && VALID_ABILITY_SET.has(sc.abilityOverride)
        ? (sc.abilityOverride as AbilityKey)
        : null,
    saveDcOverride: asNullableNum(sc.saveDcOverride),
    attackBonusOverride: asNullableNum(sc.attackBonusOverride),
    usesSpellbook: asBool(sc.usesSpellbook, false),
    notes: asStr(sc.notes),
  };

  if (Array.isArray(src.spells)) {
    base.spells = src.spells.map((rawS, idx) => {
      const s = asObj(rawS);
      const rawSource = typeof s.sourceType === 'string' ? s.sourceType : 'class';
      return {
        id: asStr(s.id, `spell-${idx + 1}`),
        level: Math.min(9, Math.max(0, Math.floor(asNum(s.level, 0)))),
        name: asStr(s.name),
        castingTime: asStr(s.castingTime),
        range: asStr(s.range),
        components: asStr(s.components),
        duration: asStr(s.duration),
        school: asNullableStr(s.school),
        sourceType: VALID_SPELL_SOURCE_SET.has(rawSource)
          ? (rawSource as SpellSourceType)
          : 'class',
        sourceClassId: asNullableStr(s.sourceClassId),
        alwaysPrepared: asBool(s.alwaysPrepared, false),
        prepared: asBool(s.prepared, false),
        inSpellbook: asBool(s.inSpellbook, false),
        ritual: asBool(s.ritual, false),
        concentration: asBool(s.concentration, false),
        notes: asStr(s.notes),
      };
    });
  }

  // Handle v2 spellSlotsUsed OR migrate legacy v1 spellSlots: Record<string, { total, used }>
  const rawSlotsUsed = asObj(src.spellSlotsUsed);
  for (const [k, v] of Object.entries(rawSlotsUsed)) {
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      base.spellSlotsUsed[k] = Math.floor(v);
    }
  }
  const legacySlots = asObj(src.spellSlots);
  for (const [k, v] of Object.entries(legacySlots)) {
    const slotObj = asObj(v);
    if (typeof slotObj.used === 'number' && base.spellSlotsUsed[k] === undefined) {
      base.spellSlotsUsed[k] = Math.max(0, Math.floor(slotObj.used));
    }
  }

  const rawSlotOverrides = asObj(src.spellSlotOverrides);
  for (const [k, v] of Object.entries(rawSlotOverrides)) {
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      base.spellSlotOverrides[k] = Math.floor(v);
    }
  }

  const rawResourceUsage = asObj(src.resourceUsage);
  for (const [k, v] of Object.entries(rawResourceUsage)) {
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      base.resourceUsage[k] = Math.floor(v);
    }
  }

  if (Array.isArray(src.customResources)) {
    base.customResources = src.customResources.map((rawRes, idx) => {
      const r = asObj(rawRes);
      const rec = r.recovery;
      return {
        id: asStr(r.id, `custom-res-${idx + 1}`),
        name: asStr(r.name),
        maxUses: Math.max(0, Math.floor(asNum(r.maxUses, 1))),
        recovery:
          rec === 'short_rest' || rec === 'long_rest' || rec === 'dawn' || rec === 'other'
            ? rec
            : 'long_rest',
        description: asStr(r.description),
      };
    });
  }

  const prog = asObj(src.progression);
  const rawTotalLevel = asNullableNum(prog.totalLevel);
  const summedClassLevels = base.raceAndClass.classes.reduce((sum, c) => sum + c.level, 0);
  base.progression = {
    totalLevel:
      base.raceAndClass.classes.length > 0
        ? clampOfficialLevel(summedClassLevels)
        : rawTotalLevel !== null
          ? clampOfficialLevel(rawTotalLevel)
          : null,
    experiencePoints: Math.max(0, Math.floor(asNum(prog.experiencePoints, 0))),
    inspiration: asBool(prog.inspiration, false),
    abilityScoreImprovements: Array.isArray(prog.abilityScoreImprovements)
      ? prog.abilityScoreImprovements.map((rawAsi) => {
          const asi = asObj(rawAsi);
          return {
            level: clampOfficialLevel(asNum(asi.level, 4)),
            notes: asStr(asi.notes),
          };
        })
      : [],
    levelHistory: Array.isArray(prog.levelHistory)
      ? prog.levelHistory
          .map((rawEntry, idx) => {
            const h = asObj(rawEntry);
            return {
              id: asStr(h.id, `lh-${idx + 1}`),
              level: clampOfficialLevel(asNum(h.level, 1)),
              classId: asNullableStr(h.classId) ?? 'custom',
              customClassName: asNullableStr(h.customClassName),
              subclassId: asNullableStr(h.subclassId),
              hpGain: asNullableNum(h.hpGain),
              notes: asStr(h.notes),
              date: asStr(h.date),
            };
          })
          .sort((a, b) => a.level - b.level)
      : [],
  };

  const bg = asObj(src.background);
  base.background = {
    backgroundName: asNullableStr(bg.backgroundName),
    personalityTraits: asStr(bg.personalityTraits),
    ideals: asStr(bg.ideals),
    bonds: asStr(bg.bonds),
    flaws: asStr(bg.flaws),
    backstory: asStr(bg.backstory),
    sessionNotes: Array.isArray(bg.sessionNotes)
      ? bg.sessionNotes.map((rawNote, idx) => {
          const n = asObj(rawNote);
          return {
            id: asStr(n.id, `session-${idx + 1}`),
            date: asStr(n.date),
            title: asStr(n.title),
            content: asStr(n.content),
          };
        })
      : [],
    additionalNotes: asStr(bg.additionalNotes),
  };

  return base;
}
