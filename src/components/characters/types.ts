import type {
  AbilityKey,
  ComputedDnd5e2014Snapshot,
  Dnd5e2014AbilityScores,
  Dnd5e2014AttackEntry,
  Dnd5e2014HitDiceUsedByDie,
  Dnd5e2014SheetData,
  NormalizedCharacterFieldPermissions,
  RollMode,
  SkillId,
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
    plannedIncrement: 'Increment 3C.2',
  },
  {
    id: 'inventory',
    label: 'Equipament i inventari',
    shortLabel: 'Inventari',
    plannedIncrement: 'Increment 3C.2',
  },
  {
    id: 'story',
    label: 'Història i diari',
    shortLabel: 'Història',
    plannedIncrement: 'Increment 3C.3',
  },
  {
    id: 'progression',
    label: 'Progressió i evolució',
    shortLabel: 'Progressió',
    plannedIncrement: 'Increment 3C.3',
  },
] as const;

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
