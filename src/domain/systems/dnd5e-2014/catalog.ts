/**
 * Official D&D 5e (2014) level boundaries.
 * Extension point: future homebrew epic-level rules (> 20) can be enabled explicitly
 * per campaign without extrapolating official core progression tables here.
 */
export const MIN_OFFICIAL_LEVEL_2014 = 1;
export const MAX_OFFICIAL_LEVEL_2014 = 20;
export const DEFAULT_ATTUNEMENT_LIMIT_2014 = 3;

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
export type SpellcastingModel = 'prepared' | 'known' | 'spellbook' | 'pact' | 'none';

export interface ClassFeatureMilestone {
  level: number;
  titleCa: string;
  descriptionCa: string;
}

export interface ClassCatalogEntry {
  id: string;
  labelCa: string;
  hitDie: 6 | 8 | 10 | 12;
  savingThrows: readonly [AbilityKey, AbilityKey];
  casterProgression: CasterProgression;
  spellcastingModel: SpellcastingModel;
  spellcastingAbility: AbilityKey | null;
  usesSpellbook: boolean;
  subclassLevel: 1 | 2 | 3;
  asiLevels: readonly number[];
  keyFeatureMilestones: readonly ClassFeatureMilestone[];
}

const STANDARD_ASI_LEVELS = [4, 8, 12, 16, 19] as const;

export const DND5E_CLASSES: readonly ClassCatalogEntry[] = [
  {
    id: 'barbarian',
    labelCa: 'Bàrbar',
    hitDie: 12,
    savingThrows: ['str', 'con'],
    casterProgression: 'none',
    spellcastingModel: 'none',
    spellcastingAbility: null,
    usesSpellbook: false,
    subclassLevel: 3,
    asiLevels: STANDARD_ASI_LEVELS,
    keyFeatureMilestones: [
      { level: 2, titleCa: 'Atac temerari i sentit del perill', descriptionCa: 'Avantatge en atacs de FOR a canvi d’exposar-se i avantatge en salvacions de DES contra perills visibles.' },
      { level: 3, titleCa: 'Camí primigeni i 3a ira', descriptionCa: 'Elecció de subclasse i augment a 3 usos d’Ira.' },
      { level: 5, titleCa: 'Atac addicional i moviment ràpid', descriptionCa: 'Dos atacs per acció d’Atacar i +3 m de velocitat sense armadura pesada.' },
      { level: 9, titleCa: 'Crític brutal (+1 dau)', descriptionCa: 'Afegeix daus addicionals de dany en impactes crítics cos a cos.' },
      { level: 20, titleCa: 'Campió primigeni i ira il·limitada', descriptionCa: '+4 a FOR i CON (màxim 24) i usos il·limitats d’Ira.' },
    ],
  },
  {
    id: 'bard',
    labelCa: 'Bard',
    hitDie: 8,
    savingThrows: ['dex', 'cha'],
    casterProgression: 'full',
    spellcastingModel: 'known',
    spellcastingAbility: 'cha',
    usesSpellbook: false,
    subclassLevel: 3,
    asiLevels: STANDARD_ASI_LEVELS,
    keyFeatureMilestones: [
      { level: 2, titleCa: 'Polivalent i cant de descans', descriptionCa: 'Suma ½ competència a proves no competents i ajuda a recuperar PV en descans curt.' },
      { level: 3, titleCa: 'Col·legi bàrdic i Expertesa', descriptionCa: 'Elecció de subclasse i doble competència en dues habilitats.' },
      { level: 5, titleCa: 'Font d’inspiració (d8)', descriptionCa: 'La Inspiració bàrdica passa a d8 i es recupera en descans curt o llarg.' },
      { level: 10, titleCa: 'Secrets màgics', descriptionCa: 'Aprèn dos conjurs de qualsevol llista de classe.' },
      { level: 20, titleCa: 'Inspiració superior', descriptionCa: 'En tirar iniciativa sense usos restants, recupera 1 ús d’Inspiració bàrdica.' },
    ],
  },
  {
    id: 'cleric',
    labelCa: 'Clergue',
    hitDie: 8,
    savingThrows: ['wis', 'cha'],
    casterProgression: 'full',
    spellcastingModel: 'prepared',
    spellcastingAbility: 'wis',
    usesSpellbook: false,
    subclassLevel: 1,
    asiLevels: STANDARD_ASI_LEVELS,
    keyFeatureMilestones: [
      { level: 2, titleCa: 'Canalitzar divinitat (1/descans)', descriptionCa: 'Expulsar no-morts i opció divina del domini.' },
      { level: 5, titleCa: 'Destruir no-morts (VD ½)', descriptionCa: 'Els no-morts de VD baix queden destruïts automàticament en fallar Expulsar.' },
      { level: 6, titleCa: 'Canalitzar divinitat (2/descans)', descriptionCa: 'Dos usos de Canalitzar divinitat per descans curt o llarg.' },
      { level: 10, titleCa: 'Intervenció divina', descriptionCa: 'Demana ajuda directa a la deïtat una vegada per descans llarg.' },
      { level: 20, titleCa: 'Intervenció divina garantida', descriptionCa: 'La Intervenció divina té èxit automàtic.' },
    ],
  },
  {
    id: 'druid',
    labelCa: 'Druida',
    hitDie: 8,
    savingThrows: ['int', 'wis'],
    casterProgression: 'full',
    spellcastingModel: 'prepared',
    spellcastingAbility: 'wis',
    usesSpellbook: false,
    subclassLevel: 2,
    asiLevels: STANDARD_ASI_LEVELS,
    keyFeatureMilestones: [
      { level: 2, titleCa: 'Forma salvatge i cercle druídic', descriptionCa: 'Desbloqueja 2 usos de Forma salvatge per descans i la subclasse druídica.' },
      { level: 4, titleCa: 'Millora de Forma salvatge (nedar)', descriptionCa: 'Permet formes aquàtiques fins a VD ½.' },
      { level: 8, titleCa: 'Formes voladores (VD 1)', descriptionCa: 'Permet formes de bèstia amb velocitat de vol.' },
      { level: 18, titleCa: 'Cos atemporal i conjurs de bèstia', descriptionCa: 'Llança conjurs mentre mantens la Forma salvatge i envelleixes deu vegades més lentament.' },
      { level: 20, titleCa: 'Arxidruida', descriptionCa: 'Usos il·limitats de Forma salvatge.' },
    ],
  },
  {
    id: 'fighter',
    labelCa: 'Guerrer',
    hitDie: 10,
    savingThrows: ['str', 'con'],
    casterProgression: 'none',
    spellcastingModel: 'none',
    spellcastingAbility: null,
    usesSpellbook: false,
    subclassLevel: 3,
    asiLevels: [4, 6, 8, 12, 14, 16, 19],
    keyFeatureMilestones: [
      { level: 2, titleCa: 'Acció sobtada (1/descans)', descriptionCa: 'Guanya una acció addicional durant el teu torn.' },
      { level: 3, titleCa: 'Arquetip marcial', descriptionCa: 'Elecció de subclasse de Guerrer.' },
      { level: 5, titleCa: 'Atac addicional (2 atacs)', descriptionCa: 'Fes dos atacs en emprar l’acció d’Atacar.' },
      { level: 9, titleCa: 'Indomable (1/descans llarg)', descriptionCa: 'Repeteix una tirada de salvació fallada.' },
      { level: 11, titleCa: 'Atac addicional millorat (3 atacs)', descriptionCa: 'Tres atacs per acció d’Atacar.' },
      { level: 20, titleCa: 'Quatre atacs per torn', descriptionCa: 'Quatre atacs per acció d’Atacar.' },
    ],
  },
  {
    id: 'monk',
    labelCa: 'Monjo',
    hitDie: 8,
    savingThrows: ['str', 'dex'],
    casterProgression: 'none',
    spellcastingModel: 'none',
    spellcastingAbility: null,
    usesSpellbook: false,
    subclassLevel: 3,
    asiLevels: STANDARD_ASI_LEVELS,
    keyFeatureMilestones: [
      { level: 2, titleCa: 'Punts de Ki i moviment sense armadura', descriptionCa: 'Reserva de Ki igual al nivell i augment de velocitat sense armadura.' },
      { level: 3, titleCa: 'Tradició monàstica i desviar projectils', descriptionCa: 'Elecció de subclasse i reducció de dany a distància.' },
      { level: 5, titleCa: 'Atac addicional i cop atordidor', descriptionCa: 'Dos atacs per acció d’Atacar i possibilitat d’atordir gastant 1 Ki.' },
      { level: 14, titleCa: 'Ànima de diamant', descriptionCa: 'Competència en totes les sis tirades de salvació.' },
      { level: 20, titleCa: 'Jo perfecte', descriptionCa: 'En tirar iniciativa sense Ki, recupera 4 punts de Ki.' },
    ],
  },
  {
    id: 'paladin',
    labelCa: 'Paladí',
    hitDie: 10,
    savingThrows: ['wis', 'cha'],
    casterProgression: 'half',
    spellcastingModel: 'prepared',
    spellcastingAbility: 'cha',
    usesSpellbook: false,
    subclassLevel: 3,
    asiLevels: STANDARD_ASI_LEVELS,
    keyFeatureMilestones: [
      { level: 2, titleCa: 'Càstig diví i màgia (Niv. 1 conjurs)', descriptionCa: 'Desbloqueja conjurs preparats, estil de combat i Càstig diví.' },
      { level: 3, titleCa: 'Vot sagrat i Salut divina', descriptionCa: 'Elecció de subclasse i immunitat a malalties.' },
      { level: 5, titleCa: 'Atac addicional', descriptionCa: 'Dos atacs per acció d’Atacar.' },
      { level: 6, titleCa: 'Aura de protecció', descriptionCa: 'Tu i aliats propers sumeu el teu mod. CAR a totes les salvacions.' },
      { level: 20, titleCa: 'Avatar del vot sagrat', descriptionCa: 'Transformació suprema vinculada al vot de la subclasse.' },
    ],
  },
  {
    id: 'ranger',
    labelCa: 'Explorador',
    hitDie: 10,
    savingThrows: ['str', 'dex'],
    casterProgression: 'half',
    spellcastingModel: 'known',
    spellcastingAbility: 'wis',
    usesSpellbook: false,
    subclassLevel: 3,
    asiLevels: STANDARD_ASI_LEVELS,
    keyFeatureMilestones: [
      { level: 2, titleCa: 'Estil de combat i màgia (Niv. 1 conjurs)', descriptionCa: 'Desbloqueja conjurs coneguts i estil de combat.' },
      { level: 3, titleCa: 'Arquetip d’explorador i consciència primitiva', descriptionCa: 'Elecció de subclasse i detecció de criatures mitjançant espais de conjur.' },
      { level: 5, titleCa: 'Atac addicional', descriptionCa: 'Dos atacs per acció d’Atacar.' },
      { level: 14, titleCa: 'Esvaïment', descriptionCa: 'Es pot amagar com a acció addicional.' },
      { level: 20, titleCa: 'Assassí d’enemics', descriptionCa: 'Suma el mod. SAV a l’atac o dany contra enemics predilectes.' },
    ],
  },
  {
    id: 'rogue',
    labelCa: 'Murri',
    hitDie: 8,
    savingThrows: ['dex', 'int'],
    casterProgression: 'none',
    spellcastingModel: 'none',
    spellcastingAbility: null,
    usesSpellbook: false,
    subclassLevel: 3,
    asiLevels: [4, 8, 10, 12, 16, 19],
    keyFeatureMilestones: [
      { level: 2, titleCa: 'Acció astuta', descriptionCa: 'Còrrer, Retirar-se o Amagar-se com a acció addicional.' },
      { level: 3, titleCa: 'Arquetip de murri i 2d6 furtiu', descriptionCa: 'Elecció de subclasse.' },
      { level: 5, titleCa: 'Esquiva prodigiosa (3d6 furtiu)', descriptionCa: 'Redueix a la meitat el dany d’un atac visible amb reacció.' },
      { level: 7, titleCa: 'Evasió', descriptionCa: 'Sense dany en superar salvacions de DES i meitat en fallar.' },
      { level: 11, titleCa: 'Talent fiable', descriptionCa: 'Tracta tirades de d20 inferiors a 10 com a 10 en habilitats competents.' },
      { level: 20, titleCa: 'Cop de sort (1/descans)', descriptionCa: 'Converteix una fallada en èxit o 20 natural en proves.' },
    ],
  },
  {
    id: 'sorcerer',
    labelCa: 'Bruixot innat (Sorcerer)',
    hitDie: 6,
    savingThrows: ['con', 'cha'],
    casterProgression: 'full',
    spellcastingModel: 'known',
    spellcastingAbility: 'cha',
    usesSpellbook: false,
    subclassLevel: 1,
    asiLevels: STANDARD_ASI_LEVELS,
    keyFeatureMilestones: [
      { level: 2, titleCa: 'Font de màgia (Punts de bruixeria)', descriptionCa: 'Reserva flexible igual al nivell de classe.' },
      { level: 3, titleCa: 'Metamàgia', descriptionCa: 'Modifica conjurs gastant punts de bruixeria.' },
      { level: 20, titleCa: 'Restauració sorcellera', descriptionCa: 'Recupera 4 punts de bruixeria en cada descans curt.' },
    ],
  },
  {
    id: 'warlock',
    labelCa: 'Bruixot de pacte (Warlock)',
    hitDie: 8,
    savingThrows: ['wis', 'cha'],
    casterProgression: 'pact',
    spellcastingModel: 'pact',
    spellcastingAbility: 'cha',
    usesSpellbook: false,
    subclassLevel: 1,
    asiLevels: STANDARD_ASI_LEVELS,
    keyFeatureMilestones: [
      { level: 2, titleCa: 'Invocacions eldrítiques (2)', descriptionCa: 'Habilitats ocultes permanents i 2n espai de Pacte.' },
      { level: 3, titleCa: 'Do del pacte (Cercles niv. 2)', descriptionCa: 'Tria Cadena, Fulla o Grimori del pacte.' },
      { level: 11, titleCa: 'Arcanum místic (6è cercle) i 3r espai', descriptionCa: 'Guanya el 3r espai de Pacte i un conjur diari de 6è cercle.' },
      { level: 17, titleCa: 'Arcanum místic (9è cercle) i 4t espai', descriptionCa: 'Quatre espais de Pacte per descans curt.' },
      { level: 20, titleCa: 'Mestre eldrític', descriptionCa: 'Recupera tots els espais de Pacte dedicant 1 minut a demanar-ho.' },
    ],
  },
  {
    id: 'wizard',
    labelCa: 'Mag',
    hitDie: 6,
    savingThrows: ['int', 'wis'],
    casterProgression: 'full',
    spellcastingModel: 'spellbook',
    spellcastingAbility: 'int',
    usesSpellbook: true,
    subclassLevel: 2,
    asiLevels: STANDARD_ASI_LEVELS,
    keyFeatureMilestones: [
      { level: 2, titleCa: 'Tradició arcana', descriptionCa: 'Elecció d’escola màgica de subclasse.' },
      { level: 18, titleCa: 'Domini d’encanteris', descriptionCa: 'Un conjur de 1r i un de 2n nivell llançables sense gastar espai.' },
      { level: 20, titleCa: 'Conjurs emblemàtics', descriptionCa: 'Dos conjurs de 3r cercle sempre preparats i llançables un cop per descans.' },
    ],
  },
] as const;

export interface SubclassCatalogEntry {
  id: string;
  classId: string;
  labelCa: string;
  casterProgression?: CasterProgression;
  spellcastingModel?: SpellcastingModel;
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
    spellcastingModel: 'known',
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
    spellcastingModel: 'known',
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

export function getHitDieAverageGain(hitDie: 6 | 8 | 10 | 12): number {
  return hitDie / 2 + 1;
}

export function getSpellcastingUnlockLevel(progression: CasterProgression): number | null {
  switch (progression) {
    case 'full':
    case 'pact':
      return 1;
    case 'half':
      return 2;
    case 'third':
      return 3;
    default:
      return null;
  }
}

export function resolveEffectiveClassSpellcasting(
  classId: string,
  subclassId: string | null | undefined,
  classLevel: number
): {
  progression: CasterProgression;
  model: SpellcastingModel;
  ability: AbilityKey | null;
  usesSpellbook: boolean;
  unlockLevel: number | null;
  isActiveCaster: boolean;
} {
  const classMeta = getClassEntry(classId);
  const subclassMeta = getSubclassEntry(subclassId);

  const progression = subclassMeta?.casterProgression ?? classMeta?.casterProgression ?? 'none';
  const model = subclassMeta?.spellcastingModel ?? classMeta?.spellcastingModel ?? 'none';
  const ability = subclassMeta?.spellcastingAbility ?? classMeta?.spellcastingAbility ?? null;
  const usesSpellbook = Boolean(classMeta?.usesSpellbook);
  const unlockLevel = getSpellcastingUnlockLevel(progression);
  const isActiveCaster =
    progression !== 'none' && unlockLevel !== null && classLevel >= unlockLevel;

  return {
    progression,
    model,
    ability,
    usesSpellbook,
    unlockLevel,
    isActiveCaster,
  };
}

export interface CoreWeaponCatalogEntry {
  id: string;
  labelCa: string;
  category: 'simple' | 'martial';
  style: 'melee' | 'ranged';
  finesse: boolean;
  thrown: boolean;
  heavy: boolean;
  twoHanded: boolean;
  aliases: readonly string[];
}

export const DND5E_CORE_WEAPONS: readonly CoreWeaponCatalogEntry[] = [
  // Simple Melee
  { id: 'club', labelCa: 'Garrot', category: 'simple', style: 'melee', finesse: false, thrown: false, heavy: false, twoHanded: false, aliases: ['garrot', 'club', 'clava'] },
  { id: 'dagger', labelCa: 'Daga', category: 'simple', style: 'melee', finesse: true, thrown: true, heavy: false, twoHanded: false, aliases: ['daga', 'dagger', 'punyal'] },
  { id: 'greatclub', labelCa: 'Gran garrot', category: 'simple', style: 'melee', finesse: false, thrown: false, heavy: false, twoHanded: true, aliases: ['gran garrot', 'greatclub', 'garrot gran'] },
  { id: 'handaxe', labelCa: 'Destral de mà', category: 'simple', style: 'melee', finesse: false, thrown: true, heavy: false, twoHanded: false, aliases: ['destral de ma', 'handaxe', 'destraleta'] },
  { id: 'javelin', labelCa: 'Javelina', category: 'simple', style: 'melee', finesse: false, thrown: true, heavy: false, twoHanded: false, aliases: ['javelina', 'javelin'] },
  { id: 'light-hammer', labelCa: 'Martell lleuger', category: 'simple', style: 'melee', finesse: false, thrown: true, heavy: false, twoHanded: false, aliases: ['martell lleuger', 'light hammer'] },
  { id: 'mace', labelCa: 'Maça', category: 'simple', style: 'melee', finesse: false, thrown: false, heavy: false, twoHanded: false, aliases: ['maca', 'mace'] },
  { id: 'quarterstaff', labelCa: 'Bastó', category: 'simple', style: 'melee', finesse: false, thrown: false, heavy: false, twoHanded: false, aliases: ['basto', 'basto de fusta', 'quarterstaff', 'bordao'] },
  { id: 'sickle', labelCa: 'Falç', category: 'simple', style: 'melee', finesse: false, thrown: false, heavy: false, twoHanded: false, aliases: ['falc', 'sickle', 'hoz'] },
  { id: 'spear', labelCa: 'Llança', category: 'simple', style: 'melee', finesse: false, thrown: true, heavy: false, twoHanded: false, aliases: ['llanca', 'spear'] },
  // Simple Ranged
  { id: 'light-crossbow', labelCa: 'Ballesta lleugera', category: 'simple', style: 'ranged', finesse: false, thrown: false, heavy: false, twoHanded: true, aliases: ['ballesta lleugera', 'light crossbow'] },
  { id: 'dart', labelCa: 'Dard', category: 'simple', style: 'ranged', finesse: true, thrown: true, heavy: false, twoHanded: false, aliases: ['dard', 'dart'] },
  { id: 'shortbow', labelCa: 'Arc curt', category: 'simple', style: 'ranged', finesse: false, thrown: false, heavy: false, twoHanded: true, aliases: ['arc curt', 'shortbow'] },
  { id: 'sling', labelCa: 'Fona', category: 'simple', style: 'ranged', finesse: false, thrown: false, heavy: false, twoHanded: false, aliases: ['fona', 'sling'] },
  // Martial Melee
  { id: 'battleaxe', labelCa: 'Destral de batalla', category: 'martial', style: 'melee', finesse: false, thrown: false, heavy: false, twoHanded: false, aliases: ['destral de batalla', 'battleaxe'] },
  { id: 'flail', labelCa: 'Flagell', category: 'martial', style: 'melee', finesse: false, thrown: false, heavy: false, twoHanded: false, aliases: ['flagell', 'flail', 'mangual'] },
  { id: 'glaive', labelCa: 'Guja', category: 'martial', style: 'melee', finesse: false, thrown: false, heavy: true, twoHanded: true, aliases: ['guja', 'glaive'] },
  { id: 'greataxe', labelCa: 'Destral gran', category: 'martial', style: 'melee', finesse: false, thrown: false, heavy: true, twoHanded: true, aliases: ['destral gran', 'greataxe'] },
  { id: 'greatsword', labelCa: 'Espasot', category: 'martial', style: 'melee', finesse: false, thrown: false, heavy: true, twoHanded: true, aliases: ['espasot', 'greatsword', 'espadon', 'espasa a dues mans'] },
  { id: 'halberd', labelCa: 'Alabarda', category: 'martial', style: 'melee', finesse: false, thrown: false, heavy: true, twoHanded: true, aliases: ['alabarda', 'halberd'] },
  { id: 'lance', labelCa: 'Llança de cavalleria', category: 'martial', style: 'melee', finesse: false, thrown: false, heavy: false, twoHanded: false, aliases: ['llanca de cavalleria', 'lance'] },
  { id: 'longsword', labelCa: 'Espasa llarga', category: 'martial', style: 'melee', finesse: false, thrown: false, heavy: false, twoHanded: false, aliases: ['espasa llarga', 'longsword'] },
  { id: 'maul', labelCa: 'Mall de guerra', category: 'martial', style: 'melee', finesse: false, thrown: false, heavy: true, twoHanded: true, aliases: ['mall', 'mall de guerra', 'maul'] },
  { id: 'morningstar', labelCa: 'Estrella de l’alba', category: 'martial', style: 'melee', finesse: false, thrown: false, heavy: false, twoHanded: false, aliases: ['estrella de l\'alba', 'estrella de l’alba', 'morningstar'] },
  { id: 'pike', labelCa: 'Pica', category: 'martial', style: 'melee', finesse: false, thrown: false, heavy: true, twoHanded: true, aliases: ['pica', 'pike'] },
  { id: 'rapier', labelCa: 'Estoc', category: 'martial', style: 'melee', finesse: true, thrown: false, heavy: false, twoHanded: false, aliases: ['estoc', 'rapier', 'florete'] },
  { id: 'scimitar', labelCa: 'Simitarra', category: 'martial', style: 'melee', finesse: true, thrown: false, heavy: false, twoHanded: false, aliases: ['simitarra', 'scimitar'] },
  { id: 'shortsword', labelCa: 'Espasa curta', category: 'martial', style: 'melee', finesse: true, thrown: false, heavy: false, twoHanded: false, aliases: ['espasa curta', 'shortsword'] },
  { id: 'trident', labelCa: 'Trident', category: 'martial', style: 'melee', finesse: false, thrown: true, heavy: false, twoHanded: false, aliases: ['trident'] },
  { id: 'war-pick', labelCa: 'Pic de guerra', category: 'martial', style: 'melee', finesse: false, thrown: false, heavy: false, twoHanded: false, aliases: ['pic de guerra', 'war pick'] },
  { id: 'warhammer', labelCa: 'Martell de guerra', category: 'martial', style: 'melee', finesse: false, thrown: false, heavy: false, twoHanded: false, aliases: ['martell de guerra', 'warhammer'] },
  { id: 'whip', labelCa: 'Fuet', category: 'martial', style: 'melee', finesse: true, thrown: false, heavy: false, twoHanded: false, aliases: ['fuet', 'whip'] },
  // Martial Ranged
  { id: 'blowgun', labelCa: 'Sarbatana', category: 'martial', style: 'ranged', finesse: false, thrown: false, heavy: false, twoHanded: false, aliases: ['sarbatana', 'blowgun'] },
  { id: 'hand-crossbow', labelCa: 'Ballesta de mà', category: 'martial', style: 'ranged', finesse: false, thrown: false, heavy: false, twoHanded: false, aliases: ['ballesta de ma', 'hand crossbow'] },
  { id: 'heavy-crossbow', labelCa: 'Ballesta pesada', category: 'martial', style: 'ranged', finesse: false, thrown: false, heavy: true, twoHanded: true, aliases: ['ballesta pesada', 'heavy crossbow'] },
  { id: 'longbow', labelCa: 'Arc llarg', category: 'martial', style: 'ranged', finesse: false, thrown: false, heavy: true, twoHanded: true, aliases: ['arc llarg', 'longbow'] },
  { id: 'net', labelCa: 'Xarxa', category: 'martial', style: 'ranged', finesse: false, thrown: true, heavy: false, twoHanded: false, aliases: ['xarxa', 'net'] },
] as const;

const WEAPON_ALIAS_ENTRIES: Array<{ alias: string; weapon: CoreWeaponCatalogEntry }> = DND5E_CORE_WEAPONS.flatMap(
  (weapon) => weapon.aliases.map((alias) => ({ alias: normalizeMatchText(alias), weapon }))
).sort((a, b) => b.alias.length - a.alias.length);

export function lookupCoreWeapon(rawName: string): CoreWeaponCatalogEntry | undefined {
  const normalized = normalizeMatchText(rawName);
  if (!normalized) return undefined;

  for (const entry of WEAPON_ALIAS_ENTRIES) {
    if (normalized === entry.alias) {
      return entry.weapon;
    }
  }
  for (const entry of WEAPON_ALIAS_ENTRIES) {
    if (normalized.includes(entry.alias)) {
      return entry.weapon;
    }
  }
  return undefined;
}
