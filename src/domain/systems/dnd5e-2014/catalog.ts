/**
 * Official D&D 5e (2014) level boundaries.
 * Extension point: future homebrew epic-level rules (> 20) can be enabled explicitly
 * per campaign without extrapolating official core progression tables here.
 */
export const MIN_OFFICIAL_LEVEL_2014 = 1;
export const MAX_OFFICIAL_LEVEL_2014 = 20;

export const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type AbilityKey = (typeof ABILITY_KEYS)[number];

export const ABILITY_LABELS_CA: Record<AbilityKey, string> = {
  str: 'Força',
  dex: 'Destresa',
  con: 'Constitució',
  int: 'Intel·ligència',
  wis: 'Saviesa',
  cha: 'Carisma',
};

export const ABILITY_SHORT_CA: Record<AbilityKey, string> = {
  str: 'FOR',
  dex: 'DES',
  con: 'CON',
  int: 'INT',
  wis: 'SAV',
  cha: 'CAR',
};

export const SKILL_IDS = [
  'acrobatics',
  'animalHandling',
  'arcana',
  'athletics',
  'deception',
  'history',
  'insight',
  'intimidation',
  'investigation',
  'medicine',
  'nature',
  'perception',
  'performance',
  'persuasion',
  'religion',
  'sleightOfHand',
  'stealth',
  'survival',
] as const;

export type SkillId = (typeof SKILL_IDS)[number];

export interface SkillCatalogEntry {
  id: SkillId;
  ability: AbilityKey;
  labelCa: string;
}

export const DND5E_SKILLS: readonly SkillCatalogEntry[] = [
  { id: 'acrobatics', ability: 'dex', labelCa: 'Acrobàcies' },
  { id: 'animalHandling', ability: 'wis', labelCa: 'Tracte amb animals' },
  { id: 'arcana', ability: 'int', labelCa: 'Arcana' },
  { id: 'athletics', ability: 'str', labelCa: 'Atletisme' },
  { id: 'deception', ability: 'cha', labelCa: 'Engany' },
  { id: 'history', ability: 'int', labelCa: 'Història' },
  { id: 'insight', ability: 'wis', labelCa: 'Perspicàcia' },
  { id: 'intimidation', ability: 'cha', labelCa: 'Intimidació' },
  { id: 'investigation', ability: 'int', labelCa: 'Investigació' },
  { id: 'medicine', ability: 'wis', labelCa: 'Medicina' },
  { id: 'nature', ability: 'int', labelCa: 'Natura' },
  { id: 'perception', ability: 'wis', labelCa: 'Percepció' },
  { id: 'performance', ability: 'cha', labelCa: 'Interpretació' },
  { id: 'persuasion', ability: 'cha', labelCa: 'Persuasió' },
  { id: 'religion', ability: 'int', labelCa: 'Religió' },
  { id: 'sleightOfHand', ability: 'dex', labelCa: 'Joc de mans' },
  { id: 'stealth', ability: 'dex', labelCa: 'Sigil' },
  { id: 'survival', ability: 'wis', labelCa: 'Supervivència' },
] as const;

export type CasterProgression = 'full' | 'half' | 'third' | 'pact' | 'none';

export interface ClassCatalogEntry {
  id: string;
  labelCa: string;
  hitDie: 6 | 8 | 10 | 12;
  savingThrows: readonly [AbilityKey, AbilityKey];
  casterProgression: CasterProgression;
  spellcastingAbility: AbilityKey | null;
  usesSpellbook: boolean;
  subclassLevel: 1 | 2 | 3;
  asiLevels: readonly number[];
}

const STANDARD_ASI_LEVELS = [4, 8, 12, 16, 19] as const;

export const DND5E_CLASSES: readonly ClassCatalogEntry[] = [
  {
    id: 'barbarian',
    labelCa: 'Bàrbar',
    hitDie: 12,
    savingThrows: ['str', 'con'],
    casterProgression: 'none',
    spellcastingAbility: null,
    usesSpellbook: false,
    subclassLevel: 3,
    asiLevels: STANDARD_ASI_LEVELS,
  },
  {
    id: 'bard',
    labelCa: 'Bard',
    hitDie: 8,
    savingThrows: ['dex', 'cha'],
    casterProgression: 'full',
    spellcastingAbility: 'cha',
    usesSpellbook: false,
    subclassLevel: 3,
    asiLevels: STANDARD_ASI_LEVELS,
  },
  {
    id: 'cleric',
    labelCa: 'Clergue',
    hitDie: 8,
    savingThrows: ['wis', 'cha'],
    casterProgression: 'full',
    spellcastingAbility: 'wis',
    usesSpellbook: false,
    subclassLevel: 1,
    asiLevels: STANDARD_ASI_LEVELS,
  },
  {
    id: 'druid',
    labelCa: 'Druida',
    hitDie: 8,
    savingThrows: ['int', 'wis'],
    casterProgression: 'full',
    spellcastingAbility: 'wis',
    usesSpellbook: false,
    subclassLevel: 2,
    asiLevels: STANDARD_ASI_LEVELS,
  },
  {
    id: 'fighter',
    labelCa: 'Guerrer',
    hitDie: 10,
    savingThrows: ['str', 'con'],
    casterProgression: 'none',
    spellcastingAbility: null,
    usesSpellbook: false,
    subclassLevel: 3,
    asiLevels: [4, 6, 8, 12, 14, 16, 19],
  },
  {
    id: 'monk',
    labelCa: 'Monjo',
    hitDie: 8,
    savingThrows: ['str', 'dex'],
    casterProgression: 'none',
    spellcastingAbility: null,
    usesSpellbook: false,
    subclassLevel: 3,
    asiLevels: STANDARD_ASI_LEVELS,
  },
  {
    id: 'paladin',
    labelCa: 'Paladí',
    hitDie: 10,
    savingThrows: ['wis', 'cha'],
    casterProgression: 'half',
    spellcastingAbility: 'cha',
    usesSpellbook: false,
    subclassLevel: 3,
    asiLevels: STANDARD_ASI_LEVELS,
  },
  {
    id: 'ranger',
    labelCa: 'Explorador',
    hitDie: 10,
    savingThrows: ['str', 'dex'],
    casterProgression: 'half',
    spellcastingAbility: 'wis',
    usesSpellbook: false,
    subclassLevel: 3,
    asiLevels: STANDARD_ASI_LEVELS,
  },
  {
    id: 'rogue',
    labelCa: 'Murri',
    hitDie: 8,
    savingThrows: ['dex', 'int'],
    casterProgression: 'none',
    spellcastingAbility: null,
    usesSpellbook: false,
    subclassLevel: 3,
    asiLevels: [4, 8, 10, 12, 16, 19],
  },
  {
    id: 'sorcerer',
    labelCa: 'Bruixot innat (Sorcerer)',
    hitDie: 6,
    savingThrows: ['con', 'cha'],
    casterProgression: 'full',
    spellcastingAbility: 'cha',
    usesSpellbook: false,
    subclassLevel: 1,
    asiLevels: STANDARD_ASI_LEVELS,
  },
  {
    id: 'warlock',
    labelCa: 'Bruixot de pacte (Warlock)',
    hitDie: 8,
    savingThrows: ['wis', 'cha'],
    casterProgression: 'pact',
    spellcastingAbility: 'cha',
    usesSpellbook: false,
    subclassLevel: 1,
    asiLevels: STANDARD_ASI_LEVELS,
  },
  {
    id: 'wizard',
    labelCa: 'Mag',
    hitDie: 6,
    savingThrows: ['int', 'wis'],
    casterProgression: 'full',
    spellcastingAbility: 'int',
    usesSpellbook: true,
    subclassLevel: 2,
    asiLevels: STANDARD_ASI_LEVELS,
  },
] as const;

export interface SubclassCatalogEntry {
  id: string;
  classId: string;
  labelCa: string;
  casterProgression?: CasterProgression;
  spellcastingAbility?: AbilityKey;
}

export const DND5E_SUBCLASSES: readonly SubclassCatalogEntry[] = [
  { id: 'berserker', classId: 'barbarian', labelCa: 'Camí del Berserker' },
  { id: 'totem-warrior', classId: 'barbarian', labelCa: 'Camí del Guerrer Totèmic' },
  { id: 'lore', classId: 'bard', labelCa: 'Col·legi de la Saviesa' },
  { id: 'valor', classId: 'bard', labelCa: 'Col·legi del Valor' },
  { id: 'life-domain', classId: 'cleric', labelCa: 'Domini de la Vida' },
  { id: 'light-domain', classId: 'cleric', labelCa: 'Domini de la Llum' },
  { id: 'circle-of-the-land', classId: 'druid', labelCa: 'Cercle de la Terra' },
  { id: 'circle-of-the-moon', classId: 'druid', labelCa: 'Cercle de la Lluna' },
  { id: 'circle-of-stars', classId: 'druid', labelCa: 'Cercle de les Estrelles' },
  { id: 'champion', classId: 'fighter', labelCa: 'Campió' },
  { id: 'battle-master', classId: 'fighter', labelCa: 'Mestre de Batalla' },
  {
    id: 'eldritch-knight',
    classId: 'fighter',
    labelCa: 'Cavaller Arcà',
    casterProgression: 'third',
    spellcastingAbility: 'int',
  },
  { id: 'open-hand', classId: 'monk', labelCa: 'Camí de la Mà Oberta' },
  { id: 'shadow', classId: 'monk', labelCa: 'Camí de l’Ombra' },
  { id: 'devotion', classId: 'paladin', labelCa: 'Jurament de Devoció' },
  { id: 'vengeance', classId: 'paladin', labelCa: 'Jurament de Venjança' },
  { id: 'hunter', classId: 'ranger', labelCa: 'Caçador' },
  { id: 'beast-master', classId: 'ranger', labelCa: 'Senyor de les Bèsties' },
  { id: 'thief', classId: 'rogue', labelCa: 'Lladre' },
  { id: 'assassin', classId: 'rogue', labelCa: 'Assassí' },
  {
    id: 'arcane-trickster',
    classId: 'rogue',
    labelCa: 'Trapella Arcà',
    casterProgression: 'third',
    spellcastingAbility: 'int',
  },
  { id: 'draconic-bloodline', classId: 'sorcerer', labelCa: 'Llinatge Dracònic' },
  { id: 'wild-magic', classId: 'sorcerer', labelCa: 'Màgia Salvatge' },
  { id: 'fiend', classId: 'warlock', labelCa: 'L’Infern' },
  { id: 'archfey', classId: 'warlock', labelCa: 'L’Arquifada' },
  { id: 'great-old-one', classId: 'warlock', labelCa: 'El Gran Antic' },
  { id: 'evocation', classId: 'wizard', labelCa: 'Escola d’Evocació' },
  { id: 'abjuration', classId: 'wizard', labelCa: 'Escola d’Abjuració' },
  { id: 'divination', classId: 'wizard', labelCa: 'Escola d’Endevinació' },
] as const;

/**
 * Official D&D 5e (2014) experience thresholds for levels 1..20.
 */
export const XP_THRESHOLDS_2014: readonly number[] = [
  0, // 1
  300, // 2
  900, // 3
  2700, // 4
  6500, // 5
  14000, // 6
  23000, // 7
  34000, // 8
  48000, // 9
  64000, // 10
  85000, // 11
  100000, // 12
  120000, // 13
  140000, // 14
  165000, // 15
  195000, // 16
  225000, // 17
  265000, // 18
  305000, // 19
  355000, // 20
];

/**
 * Official D&D 5e (2014) full-caster / multiclass spell slots table (levels 1..20, slot levels 1..9).
 */
export const FULL_CASTER_SLOTS_2014: ReadonlyArray<readonly number[]> = [
  [2, 0, 0, 0, 0, 0, 0, 0, 0], // 1
  [3, 0, 0, 0, 0, 0, 0, 0, 0], // 2
  [4, 2, 0, 0, 0, 0, 0, 0, 0], // 3
  [4, 3, 0, 0, 0, 0, 0, 0, 0], // 4
  [4, 3, 2, 0, 0, 0, 0, 0, 0], // 5
  [4, 3, 3, 0, 0, 0, 0, 0, 0], // 6
  [4, 3, 3, 1, 0, 0, 0, 0, 0], // 7
  [4, 3, 3, 2, 0, 0, 0, 0, 0], // 8
  [4, 3, 3, 3, 1, 0, 0, 0, 0], // 9
  [4, 3, 3, 3, 2, 0, 0, 0, 0], // 10
  [4, 3, 3, 3, 2, 1, 0, 0, 0], // 11
  [4, 3, 3, 3, 2, 1, 0, 0, 0], // 12
  [4, 3, 3, 3, 2, 1, 1, 0, 0], // 13
  [4, 3, 3, 3, 2, 1, 1, 0, 0], // 14
  [4, 3, 3, 3, 2, 1, 1, 1, 0], // 15
  [4, 3, 3, 3, 2, 1, 1, 1, 0], // 16
  [4, 3, 3, 3, 2, 1, 1, 1, 1], // 17
  [4, 3, 3, 3, 3, 1, 1, 1, 1], // 18
  [4, 3, 3, 3, 3, 2, 1, 1, 1], // 19
  [4, 3, 3, 3, 3, 2, 2, 1, 1], // 20
];

/**
 * Official D&D 5e (2014) Warlock Pact Magic slots (levels 1..20).
 */
export const PACT_MAGIC_SLOTS_2014: ReadonlyArray<{ count: number; slotLevel: number }> = [
  { count: 1, slotLevel: 1 }, // 1
  { count: 2, slotLevel: 1 }, // 2
  { count: 2, slotLevel: 2 }, // 3
  { count: 2, slotLevel: 2 }, // 4
  { count: 2, slotLevel: 3 }, // 5
  { count: 2, slotLevel: 3 }, // 6
  { count: 2, slotLevel: 4 }, // 7
  { count: 2, slotLevel: 4 }, // 8
  { count: 2, slotLevel: 5 }, // 9
  { count: 2, slotLevel: 5 }, // 10
  { count: 3, slotLevel: 5 }, // 11
  { count: 3, slotLevel: 5 }, // 12
  { count: 3, slotLevel: 5 }, // 13
  { count: 3, slotLevel: 5 }, // 14
  { count: 3, slotLevel: 5 }, // 15
  { count: 3, slotLevel: 5 }, // 16
  { count: 4, slotLevel: 5 }, // 17
  { count: 4, slotLevel: 5 }, // 18
  { count: 4, slotLevel: 5 }, // 19
  { count: 4, slotLevel: 5 }, // 20
];

const CLASS_BY_ID = new Map(DND5E_CLASSES.map((c) => [c.id, c]));
const SUBCLASS_BY_ID = new Map(DND5E_SUBCLASSES.map((s) => [s.id, s]));

export function normalizeMatchText(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const CLASS_ALIAS_MAP: Record<string, string> = {
  barbarian: 'barbarian',
  barbar: 'barbarian',
  bard: 'bard',
  cleric: 'cleric',
  clergue: 'cleric',
  druid: 'druid',
  druida: 'druid',
  fighter: 'fighter',
  guerrer: 'fighter',
  monk: 'monk',
  monjo: 'monk',
  paladin: 'paladin',
  paladi: 'paladin',
  ranger: 'ranger',
  explorador: 'ranger',
  rogue: 'rogue',
  murri: 'rogue',
  picar: 'rogue',
  sorcerer: 'sorcerer',
  'bruixot innat': 'sorcerer',
  'bruixot innat (sorcerer)': 'sorcerer',
  warlock: 'warlock',
  'bruixot de pacte': 'warlock',
  'bruixot de pacte (warlock)': 'warlock',
  wizard: 'wizard',
  mag: 'wizard',
};

export function getClassEntry(classId: string): ClassCatalogEntry | undefined {
  return CLASS_BY_ID.get(classId);
}

export function getSubclassEntry(subclassId: string | null | undefined): SubclassCatalogEntry | undefined {
  if (!subclassId) return undefined;
  return SUBCLASS_BY_ID.get(subclassId);
}

export function resolveClassId(raw: string): string {
  const normalized = normalizeMatchText(raw);
  return CLASS_ALIAS_MAP[normalized] ?? 'custom';
}
