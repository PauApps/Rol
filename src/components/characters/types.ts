import type {
  AbilityKey,
  ArmorType,
  ComputedDnd5e2014Snapshot,
  Dnd5e2014AbilityScores,
  Dnd5e2014AsiEntry,
  Dnd5e2014AttackEntry,
  Dnd5e2014CustomResource,
  Dnd5e2014HitDiceUsedByDie,
  Dnd5e2014InventoryItem,
  Dnd5e2014LevelHistoryEntry,
  Dnd5e2014SessionNote,
  Dnd5e2014SheetData,
  Dnd5e2014SpellEntry,
  Dnd5e2014SpellcastingSourceOverride,
  Dnd5e2014TraitEntry,
  InventoryCategory,
  NormalizedCharacterFieldPermissions,
  ResourceRecovery,
  RollMode,
  SkillId,
  SpellSourceType,
  SpellcastingModel,
} from '@/domain/systems/dnd5e-2014';

export type CharacterTabId = 'combat' | 'magic' | 'inventory' | 'story' | 'progression';

export interface CharacterTabDefinition {
  id: CharacterTabId;
  label: string;
  shortLabel: string;
  plannedIncrement: string | null;
}

export const CHARACTER_TABS: readonly CharacterTabDefinition[] = [
  {
    id: 'combat',
    label: 'Característiques i combat',
    shortLabel: 'Combat',
    plannedIncrement: null,
  },
  {
    id: 'magic',
    label: 'Màgia i habilitats',
    shortLabel: 'Màgia',
    plannedIncrement: null,
  },
  {
    id: 'inventory',
    label: 'Equipament i inventari',
    shortLabel: 'Inventari',
    plannedIncrement: null,
  },
  {
    id: 'story',
    label: 'Història i diari',
    shortLabel: 'Història',
    plannedIncrement: null,
  },
  {
    id: 'progression',
    label: 'Progressió i evolució',
    shortLabel: 'Progressió',
    plannedIncrement: null,
  },
] as const;

export const RECOVERY_LABELS_CA: Record<ResourceRecovery, string> = {
  short_rest: 'Descans curt',
  long_rest: 'Descans llarg',
  dawn: 'A l’alba',
  other: 'Altre / manual',
};

export const SPELL_MODEL_LABELS_CA: Record<SpellcastingModel, string> = {
  prepared: 'Conjurs preparats',
  known: 'Conjurs coneguts',
  spellbook: 'Grimori + preparats',
  pact: 'Màgia de Pacte',
  none: 'Sense màgia',
};

export const SPELL_SOURCE_TYPE_LABELS_CA: Record<SpellSourceType, string> = {
  class: 'Classe',
  pact: 'Pacte',
  feature: 'Tret / Dot',
  race: 'Raça',
  item: 'Objecte màgic',
  custom: 'Altre',
};

export const INVENTORY_CATEGORY_LABELS_CA: Record<InventoryCategory, string> = {
  weapon: 'Armes',
  armor: 'Armadures',
  shield: 'Escuts',
  gear: 'Equipament',
  magic_item: 'Objectes màgics',
  treasure: 'Tresors',
  custom: 'Altres objectes',
};

export const ARMOR_TYPE_LABELS_CA: Record<ArmorType, string> = {
  light: 'Lleugera',
  medium: 'Mitjana',
  heavy: 'Pesada',
};

export interface CharacterSheetRecord {
  id: string;
  campaignId: string;
  memberId: string | null;
  ownerDisplayName: string | null;
  systemId: string;
  name: string;
  schemaVersion: number;
  sheetData: Dnd5e2014SheetData;
  computed: ComputedDnd5e2014Snapshot;
  customFields: Record<string, unknown>;
  isMine: boolean;
  canEdit: boolean;
  editableFields: string[];
  authorizedOverrideFields: string[];
  createdAt: string;
  updatedAt: string;
  gmNotes?: string;
  fieldPermissions?: NormalizedCharacterFieldPermissions;
}

export interface CharacterCampaignContext {
  id: string;
  name: string;
  systemId: string;
  systemName: string;
  virtualDiceEnabled: boolean;
  canManage: boolean;
  accessRole: 'gm' | 'player' | 'guest';
  members?: ReadonlyArray<{ id: string; displayName: string }>;
}

export interface CharacterSheetDraft {
  name: string;
  abilities: Dnd5e2014AbilityScores;
  savingThrows: {
    proficient: AbilityKey[];
    rollModes: Partial<Record<AbilityKey, RollMode>>;
    overrides: Partial<Record<AbilityKey, number>>;
  };
  skills: {
    proficient: SkillId[];
    expertise: SkillId[];
    halfProficient: boolean;
    rollModes: Partial<Record<SkillId, RollMode>>;
    overrides: Partial<Record<SkillId, number>>;
  };
  hitPoints: {
    max: number | null;
    current: number | null;
    temporary: number | null;
    hitDiceUsed: number;
    hitDiceUsedByDie: Dnd5e2014HitDiceUsedByDie | null;
    deathSaves: {
      successes: number;
      failures: number;
    };
  };
  armorClass: {
    unarmoredFormula: 'none' | 'barbarian' | 'monk';
    notes: string;
    override: number | null;
  };
  initiative: {
    bonus: number;
    override: number | null;
  };
  speed: {
    walk: number | null;
    fly: number | null;
    swim: number | null;
    climb: number | null;
  };
  attacks: Dnd5e2014AttackEntry[];
  spellcasting: {
    abilityOverride: AbilityKey | null;
    saveDcOverride: number | null;
    attackBonusOverride: number | null;
    sourceOverrides: Record<string, Dnd5e2014SpellcastingSourceOverride>;
    usesSpellbook: boolean;
    notes: string;
  };
  spells: Dnd5e2014SpellEntry[];
  spellSlotsUsed: Record<string, number>;
  spellSlotOverrides: Record<string, number>;
  resourceUsage: Record<string, number>;
  customResources: Dnd5e2014CustomResource[];
  traitsAndFeatures: Dnd5e2014TraitEntry[];
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
  generalInfo: {
    alignment: string | null;
    faith: string | null;
    age: string | null;
    size: string | null;
    senses: string | null;
    appearanceNotes: string;
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
  progression: {
    experiencePoints: number;
    inspiration: boolean;
    abilityScoreImprovements: Dnd5e2014AsiEntry[];
    levelHistory: Dnd5e2014LevelHistoryEntry[];
  };
}

export function formatSigned(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return value >= 0 ? `+${value}` : `${value}`;
}

export function formatClassesSummary(
  sheet: Dnd5e2014SheetData,
  computed: ComputedDnd5e2014Snapshot
): string {
  if (computed.progression.classProgressions.length > 0) {
    return computed.progression.classProgressions
      .map((cls) => {
        const sub = cls.subclassLabelCa ? ` (${cls.subclassLabelCa})` : '';
        return `${cls.classLabelCa}${sub} ${cls.level}`;
      })
      .join(' · ');
  }
  if (sheet.raceAndClass.classes.length === 0) {
    return 'Sense classe';
  }
  return sheet.raceAndClass.classes
    .map((cls) => `${cls.customClassName || cls.classId} ${cls.level}`)
    .join(' · ');
}

export function formatRaceSummary(sheet: Dnd5e2014SheetData): string {
  const race = sheet.raceAndClass.race?.trim();
  const subrace = sheet.raceAndClass.subrace?.trim();
  if (!race) return 'Sense raça';
  return subrace ? `${race} (${subrace})` : race;
}

export function formatSpeedSummary(speed: Dnd5e2014SheetData['speed']): string {
  const parts: string[] = [];
  if (speed.walk !== null) parts.push(`${speed.walk} m`);
  if (speed.fly !== null && speed.fly > 0) parts.push(`vol ${speed.fly} m`);
  if (speed.swim !== null && speed.swim > 0) parts.push(`nedar ${speed.swim} m`);
  if (speed.climb !== null && speed.climb > 0) parts.push(`grimp. ${speed.climb} m`);
  return parts.length > 0 ? parts.join(' · ') : '—';
}
