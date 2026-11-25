import type { AbilityScoreMethod } from '@/domain/campaigns/creation-config';
import {
  ABILITY_KEYS,
  ABILITY_LABELS_CA,
  SKILL_IDS,
  getClassEntry,
  normalizeMatchText,
  type AbilityKey,
  type SkillId,
} from './catalog';
import type { ArmorType, Dnd5e2014AbilityScores, InventoryCategory } from './schema';

export const STANDARD_ARRAY_2014 = [15, 14, 13, 12, 10, 8] as const;
export const POINT_BUY_BUDGET_2014 = 27;
export const POINT_BUY_MIN_2014 = 8;
export const POINT_BUY_MAX_2014 = 15;

export const POINT_BUY_COSTS_2014: Readonly<Record<number, number>> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

export const DND5E_ALIGNMENTS_CA: readonly string[] = [
  'Legal Bo',
  'Neutral Bo',
  'Caòtic Bo',
  'Legal Neutral',
  'Neutral',
  'Caòtic Neutral',
  'Legal Malvat',
  'Neutral Malvat',
  'Caòtic Malvat',
] as const;

export const DND5E_LANGUAGES_CA: readonly string[] = [
  'Comú',
  'Nan',
  'Èlfic',
  'Gegant',
  'Gnom',
  'Goblin',
  'Mitjà (Halfling)',
  'Orc',
  'Abissal',
  'Celestial',
  'Dracònic',
  'Parla Profunda',
  'Infernal',
  'Primordial',
  'Silvà',
  'Subterrani',
] as const;

export interface TraitTemplate {
  name: string;
  source: string;
  description: string;
}

export interface SubraceCatalogEntry {
  id: string;
  labelCa: string;
  abilityBonuses: Partial<Record<AbilityKey, number>>;
  flexibleBonusCount?: number;
  flexibleBonusExcluded?: readonly AbilityKey[];
  extraSkillChoices?: number;
  extraLanguageChoices?: number;
  speedWalkOverride?: number;
  sensesOverride?: string | null;
  armorProficiencies?: readonly string[];
  weaponProficiencies?: readonly string[];
  traits?: readonly TraitTemplate[];
}

export interface RaceCatalogEntry {
  id: string;
  labelCa: string;
  aliases: readonly string[];
  speedWalk: number;
  size: 'Petita' | 'Mitjana';
  senses: string | null;
  abilityBonuses: Partial<Record<AbilityKey, number>>;
  flexibleBonusCount: number;
  flexibleBonusExcluded: readonly AbilityKey[];
  languages: readonly string[];
  extraLanguageChoices: number;
  skillProficiencies: readonly SkillId[];
  extraSkillChoices: number;
  armorProficiencies: readonly string[];
  weaponProficiencies: readonly string[];
  traits: readonly TraitTemplate[];
  subraces: readonly SubraceCatalogEntry[];
}

export const DND5E_RACES: readonly RaceCatalogEntry[] = [
  {
    id: 'human',
    labelCa: 'Humà',
    aliases: ['huma', 'human', 'humana'],
    speedWalk: 9,
    size: 'Mitjana',
    senses: null,
    abilityBonuses: {},
    flexibleBonusCount: 0,
    flexibleBonusExcluded: [],
    languages: ['Comú'],
    extraLanguageChoices: 1,
    skillProficiencies: [],
    extraSkillChoices: 0,
    armorProficiencies: [],
    weaponProficiencies: [],
    traits: [
      {
        name: 'Versatilitat humana',
        source: 'Raça',
        description: 'Adaptabilitat cultural i domini d’un idioma addicional.',
      },
    ],
    subraces: [
      {
        id: 'standard',
        labelCa: 'Estàndard (+1 a totes)',
        abilityBonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
      },
      {
        id: 'variant',
        labelCa: 'Variant (+1 a dues, 1 habilitat i 1 dot)',
        abilityBonuses: {},
        flexibleBonusCount: 2,
        flexibleBonusExcluded: [],
        extraSkillChoices: 1,
        traits: [
          {
            name: 'Dot inicial (Humà variant)',
            source: 'Raça (Variant)',
            description: 'Tria 1 dot inicial permès pel GM en coordinació amb la taula.',
          },
        ],
      },
    ],
  },
  {
    id: 'elf',
    labelCa: 'Elf',
    aliases: ['elf', 'elfa'],
    speedWalk: 9,
    size: 'Mitjana',
    senses: 'Visió en la foscor 18 m',
    abilityBonuses: { dex: 2 },
    flexibleBonusCount: 0,
    flexibleBonusExcluded: [],
    languages: ['Comú', 'Èlfic'],
    extraLanguageChoices: 0,
    skillProficiencies: ['perception'],
    extraSkillChoices: 0,
    armorProficiencies: [],
    weaponProficiencies: [],
    traits: [
      {
        name: 'Llinatge feèric i Trance',
        source: 'Raça',
        description: 'Avantatge en salvacions contra encisos, immunitat a la son màgica i descans en 4 hores de meditació.',
      },
      {
        name: 'Sentits aguts',
        source: 'Raça',
        description: 'Competència automàtica en Percepció.',
      },
    ],
    subraces: [
      {
        id: 'high-elf',
        labelCa: 'Alt elf',
        abilityBonuses: { int: 1 },
        extraLanguageChoices: 1,
        weaponProficiencies: ['Espasa llarga', 'Espasa curta', 'Arc curt', 'Arc llarg'],
        traits: [
          {
            name: 'Truc arcà innat (Alt elf)',
            source: 'Subraça',
            description: 'Coneixes un truc de la llista de Mag amb INT com a aptitud màgica.',
          },
        ],
      },
      {
        id: 'wood-elf',
        labelCa: 'Elf del bosc',
        abilityBonuses: { wis: 1 },
        speedWalkOverride: 10,
        weaponProficiencies: ['Espasa llarga', 'Espasa curta', 'Arc curt', 'Arc llarg'],
        traits: [
          {
            name: 'Peus lleugers i màscara de la natura',
            source: 'Subraça',
            description: 'Velocitat base augmentada (10,5 m) i facilitat per amagar-se en entorns naturals.',
          },
        ],
      },
      {
        id: 'dark-elf',
        labelCa: 'Elf fosc (Drow)',
        abilityBonuses: { cha: 1 },
        sensesOverride: 'Visió en la foscor superior 36 m',
        weaponProficiencies: ['Estoc', 'Espasa curta', 'Ballesta de mà'],
        traits: [
          {
            name: 'Màgia Drow i sensibilitat solar',
            source: 'Subraça',
            description: 'Truc Llums dansants amb CAR i desavantatge en atacs/percepció visual sota llum solar directa.',
          },
        ],
      },
    ],
  },
  {
    id: 'dwarf',
    labelCa: 'Nan',
    aliases: ['nan', 'nana', 'dwarf'],
    speedWalk: 8,
    size: 'Mitjana',
    senses: 'Visió en la foscor 18 m',
    abilityBonuses: { con: 2 },
    flexibleBonusCount: 0,
    flexibleBonusExcluded: [],
    languages: ['Comú', 'Nan'],
    extraLanguageChoices: 0,
    skillProficiencies: [],
    extraSkillChoices: 0,
    armorProficiencies: [],
    weaponProficiencies: ['Destral de batalla', 'Destral de mà', 'Martell lleuger', 'Martell de guerra'],
    traits: [
      {
        name: 'Resistència nans',
        source: 'Raça',
        description: 'Avantatge en salvacions contra verí, resistència al dany de verí i velocitat no reduïda per armadura pesada.',
      },
    ],
    subraces: [
      {
        id: 'hill-dwarf',
        labelCa: 'Nan dels turons',
        abilityBonuses: { wis: 1 },
        traits: [
          {
            name: 'Tenacitat nans (+1 PV/nivell)',
            source: 'Subraça',
            description: 'Els teus punts de cop màxims augmenten en 1 per cada nivell.',
          },
        ],
      },
      {
        id: 'mountain-dwarf',
        labelCa: 'Nan de la muntanya',
        abilityBonuses: { str: 2 },
        armorProficiencies: ['Armadures lleugeres', 'Armadures mitjanes'],
        traits: [
          {
            name: 'Entrenament marcial nan',
            source: 'Subraça',
            description: 'Competència en armadures lleugeres i mitjanes.',
          },
        ],
      },
    ],
  },
  {
    id: 'halfling',
    labelCa: 'Mitjà (Halfling)',
    aliases: ['mitja', 'mitjana', 'halfling', 'mitja (halfling)'],
    speedWalk: 8,
    size: 'Petita',
    senses: null,
    abilityBonuses: { dex: 2 },
    flexibleBonusCount: 0,
    flexibleBonusExcluded: [],
    languages: ['Comú', 'Mitjà (Halfling)'],
    extraLanguageChoices: 0,
    skillProficiencies: [],
    extraSkillChoices: 0,
    armorProficiencies: [],
    weaponProficiencies: [],
    traits: [
      {
        name: 'Sort i Valentia',
        source: 'Raça',
        description: 'Pots repetir un 1 natural en atacs, habilitats o salvacions; avantatge contra ensurt.',
      },
    ],
    subraces: [
      {
        id: 'lightfoot',
        labelCa: 'Peuslleugers',
        abilityBonuses: { cha: 1 },
        traits: [
          {
            name: 'Sigil·lós per naturalesa',
            source: 'Subraça',
            description: 'Pots intentar amagar-te fins i tot darrere d’una criatura una mida més gran.',
          },
        ],
      },
      {
        id: 'stout',
        labelCa: 'Robust',
        abilityBonuses: { con: 1 },
        traits: [
          {
            name: 'Resistència dels robusts',
            source: 'Subraça',
            description: 'Avantatge en salvacions contra verí i resistència al dany de verí.',
          },
        ],
      },
    ],
  },
  {
    id: 'dragonborn',
    labelCa: 'Dracònid',
    aliases: ['draconid', 'draconida', 'dragonborn'],
    speedWalk: 9,
    size: 'Mitjana',
    senses: null,
    abilityBonuses: { str: 2, cha: 1 },
    flexibleBonusCount: 0,
    flexibleBonusExcluded: [],
    languages: ['Comú', 'Dracònic'],
    extraLanguageChoices: 0,
    skillProficiencies: [],
    extraSkillChoices: 0,
    armorProficiencies: [],
    weaponProficiencies: [],
    traits: [
      {
        name: 'Arma d’alè i resistència al dany dracònic',
        source: 'Raça',
        description: 'Exhala energia elemental vinculada al teu llinatge dracònic i obtens resistència al mateix element.',
      },
    ],
    subraces: [],
  },
  {
    id: 'gnome',
    labelCa: 'Gnom',
    aliases: ['gnom', 'gnoma', 'gnome'],
    speedWalk: 8,
    size: 'Petita',
    senses: 'Visió en la foscor 18 m',
    abilityBonuses: { int: 2 },
    flexibleBonusCount: 0,
    flexibleBonusExcluded: [],
    languages: ['Comú', 'Gnom'],
    extraLanguageChoices: 0,
    skillProficiencies: [],
    extraSkillChoices: 0,
    armorProficiencies: [],
    weaponProficiencies: [],
    traits: [
      {
        name: 'Astúcia gnòmica',
        source: 'Raça',
        description: 'Avantatge en totes les salvacions d’INT, SAV i CAR contra màgia.',
      },
    ],
    subraces: [
      {
        id: 'forest-gnome',
        labelCa: 'Gnom del bosc',
        abilityBonuses: { dex: 1 },
      },
      {
        id: 'rock-gnome',
        labelCa: 'Gnom de les roques',
        abilityBonuses: { con: 1 },
      },
    ],
  },
  {
    id: 'half-elf',
    labelCa: 'Mig-elf',
    aliases: ['mig-elf', 'mig elf', 'half-elf', 'half elf'],
    speedWalk: 9,
    size: 'Mitjana',
    senses: 'Visió en la foscor 18 m',
    abilityBonuses: { cha: 2 },
    flexibleBonusCount: 2,
    flexibleBonusExcluded: ['cha'],
    languages: ['Comú', 'Èlfic'],
    extraLanguageChoices: 1,
    skillProficiencies: [],
    extraSkillChoices: 2,
    armorProficiencies: [],
    weaponProficiencies: [],
    traits: [
      {
        name: 'Versatilitat d’habilitats i llinatge feèric',
        source: 'Raça',
        description: '+2 CAR i +1 a dues altres característiques a escollir, 2 habilitats addicionals i avantatge contra encisos.',
      },
    ],
    subraces: [],
  },
  {
    id: 'half-orc',
    labelCa: 'Mig-orc',
    aliases: ['mig-orc', 'mig orc', 'half-orc', 'half orc'],
    speedWalk: 9,
    size: 'Mitjana',
    senses: 'Visió en la foscor 18 m',
    abilityBonuses: { str: 2, con: 1 },
    flexibleBonusCount: 0,
    flexibleBonusExcluded: [],
    languages: ['Comú', 'Orc'],
    extraLanguageChoices: 0,
    skillProficiencies: ['intimidation'],
    extraSkillChoices: 0,
    armorProficiencies: [],
    weaponProficiencies: [],
    traits: [
      {
        name: 'Resistència implacable i Atacs salvatges',
        source: 'Raça',
        description: 'Quan caus a 0 PV pots quedar-te a 1 PV un cop per descans llarg; dau extra de dany en crítics cos a cos.',
      },
    ],
    subraces: [],
  },
  {
    id: 'tiefling',
    labelCa: 'Tiefling',
    aliases: ['tiefling'],
    speedWalk: 9,
    size: 'Mitjana',
    senses: 'Visió en la foscor 18 m',
    abilityBonuses: { cha: 2, int: 1 },
    flexibleBonusCount: 0,
    flexibleBonusExcluded: [],
    languages: ['Comú', 'Infernal'],
    extraLanguageChoices: 0,
    skillProficiencies: [],
    extraSkillChoices: 0,
    armorProficiencies: [],
    weaponProficiencies: [],
    traits: [
      {
        name: 'Resistència infernal i llegat infernal',
        source: 'Raça',
        description: 'Resistència al dany de foc i truc Taumatúrgia innat amb CAR.',
      },
    ],
    subraces: [],
  },
] as const;

export interface StartingItemTemplate {
  name: string;
  category: InventoryCategory;
  quantity: number;
  weight: number | null;
  equipped?: boolean;
  armorType?: ArmorType | null;
  baseAc?: number | null;
  acBonus?: number | null;
  damage?: string | null;
  damageType?: string | null;
  weaponRange?: string | null;
  weaponProperties?: string;
  notes?: string;
}

export interface BackgroundCatalogEntry {
  id: string;
  labelCa: string;
  aliases: readonly string[];
  skillProficiencies: readonly [SkillId, SkillId];
  toolProficiencies: readonly string[];
  extraLanguageChoices: number;
  startingGold: number;
  startingEquipment: readonly StartingItemTemplate[];
  featureName: string;
  featureDescription: string;
}

export const DND5E_BACKGROUNDS: readonly BackgroundCatalogEntry[] = [
  {
    id: 'acolyte',
    labelCa: 'Acòlit',
    aliases: ['acolit', 'acolyte'],
    skillProficiencies: ['insight', 'religion'],
    toolProficiencies: [],
    extraLanguageChoices: 2,
    startingGold: 15,
    startingEquipment: [
      { name: 'Símbol sagrat', category: 'gear', quantity: 1, weight: 0.5 },
      { name: 'Llibre d’oracions i encens', category: 'gear', quantity: 1, weight: 1 },
      { name: 'Vestidures comunes', category: 'gear', quantity: 1, weight: 2 },
    ],
    featureName: 'Refugi dels fidels',
    featureDescription: 'Pots rebre allotjament i curació bàsica als temples de la teva fe.',
  },
  {
    id: 'criminal',
    labelCa: 'Criminal',
    aliases: ['criminal'],
    skillProficiencies: ['deception', 'stealth'],
    toolProficiencies: ['Eines de lladre', 'Joc de daus o cartes'],
    extraLanguageChoices: 0,
    startingGold: 15,
    startingEquipment: [
      { name: 'Palanca de ferro', category: 'gear', quantity: 1, weight: 2 },
      { name: 'Roba fosca amb caputxa', category: 'gear', quantity: 1, weight: 1.5 },
    ],
    featureName: 'Contacte criminal',
    featureDescription: 'Comptes amb un enllaç fiable dins els baixos fons locals.',
  },
  {
    id: 'folk-hero',
    labelCa: 'Heroi popular',
    aliases: ['heroi popular', 'folk hero'],
    skillProficiencies: ['animalHandling', 'survival'],
    toolProficiencies: ['Eines d’artesà', 'Vehicles terrestres'],
    extraLanguageChoices: 0,
    startingGold: 10,
    startingEquipment: [
      { name: 'Eines d’artesà', category: 'gear', quantity: 1, weight: 2 },
      { name: 'Pala', category: 'gear', quantity: 1, weight: 2 },
      { name: 'Olla de ferro', category: 'gear', quantity: 1, weight: 4 },
    ],
    featureName: 'Hospitalitat rústica',
    featureDescription: 'La gent humil t’ofereix refugi i suport discretament.',
  },
  {
    id: 'noble',
    labelCa: 'Noble',
    aliases: ['noble'],
    skillProficiencies: ['history', 'persuasion'],
    toolProficiencies: ['Joc de taula'],
    extraLanguageChoices: 1,
    startingGold: 25,
    startingEquipment: [
      { name: 'Vestidures fines', category: 'gear', quantity: 1, weight: 3 },
      { name: 'Anell amb segell', category: 'treasure', quantity: 1, weight: 0.1 },
      { name: 'Carta de llinatge', category: 'gear', quantity: 1, weight: 0.1 },
    ],
    featureName: 'Posició de privilegi',
    featureDescription: 'La noblesa i les autoritats et reben amb consideració.',
  },
  {
    id: 'sage',
    labelCa: 'Erudit',
    aliases: ['erudit', 'savi', 'sage'],
    skillProficiencies: ['arcana', 'history'],
    toolProficiencies: [],
    extraLanguageChoices: 2,
    startingGold: 10,
    startingEquipment: [
      { name: 'Flascó de tinta i ploma', category: 'gear', quantity: 1, weight: 0.2 },
      { name: 'Carta amb pregunta sense resposta', category: 'gear', quantity: 1, weight: 0.1 },
      { name: 'Llibre d’estudi', category: 'gear', quantity: 1, weight: 2 },
    ],
    featureName: 'Investigador',
    featureDescription: 'Si desconeixes una dada erudita, saps on i qui la pot tenir.',
  },
  {
    id: 'soldier',
    labelCa: 'Soldat',
    aliases: ['soldat', 'soldier'],
    skillProficiencies: ['athletics', 'intimidation'],
    toolProficiencies: ['Joc de taula', 'Vehicles terrestres'],
    extraLanguageChoices: 0,
    startingGold: 10,
    startingEquipment: [
      { name: 'Insígnia de rang', category: 'gear', quantity: 1, weight: 0.1 },
      { name: 'Trofeu d’enemic vençut', category: 'gear', quantity: 1, weight: 0.5 },
      { name: 'Roba comuna', category: 'gear', quantity: 1, weight: 1.5 },
    ],
    featureName: 'Rang militar',
    featureDescription: 'Els soldats reconeixen la teva autoritat i experiència al front.',
  },
  {
    id: 'hermit',
    labelCa: 'Ermità',
    aliases: ['ermita', 'hermit'],
    skillProficiencies: ['medicine', 'religion'],
    toolProficiencies: ['Kit d’herbolari'],
    extraLanguageChoices: 1,
    startingGold: 5,
    startingEquipment: [
      { name: 'Estuig amb pergamins d’estudi', category: 'gear', quantity: 1, weight: 0.5 },
      { name: 'Manta d’hivern', category: 'gear', quantity: 1, weight: 1.5 },
      { name: 'Kit d’herbolari', category: 'gear', quantity: 1, weight: 1.5 },
    ],
    featureName: 'Descobriment',
    featureDescription: 'Guarda el fruit d’una revelació obtinguda en solitud.',
  },
  {
    id: 'outlander',
    labelCa: 'Foraster',
    aliases: ['foraster', 'forastera', 'outlander'],
    skillProficiencies: ['athletics', 'survival'],
    toolProficiencies: ['Instrument musical'],
    extraLanguageChoices: 1,
    startingGold: 10,
    startingEquipment: [
      { name: 'Bastó de caminant', category: 'gear', quantity: 1, weight: 2 },
      { name: 'Trampa de caça', category: 'gear', quantity: 1, weight: 10 },
      { name: 'Roba de viatge', category: 'gear', quantity: 1, weight: 2 },
    ],
    featureName: 'Viatger nat',
    featureDescription: 'Recordes rutes i terrenys i pots trobar menjar i aigua per a 6 persones.',
  },
] as const;

export interface FightingStyleEntry {
  id: string;
  labelCa: string;
  descriptionCa: string;
}

export const DND5E_FIGHTING_STYLES: readonly FightingStyleEntry[] = [
  { id: 'archery', labelCa: 'Tir amb arc', descriptionCa: '+2 a les tirades d’atac amb armes a distància.' },
  { id: 'defense', labelCa: 'Defensa', descriptionCa: '+1 a la Classe d’armadura mentre portes armadura.' },
  { id: 'dueling', labelCa: 'Duel', descriptionCa: '+2 al dany amb una arma cos a cos a una sola mà.' },
  { id: 'great-weapon-fighting', labelCa: 'Arma a dues mans', descriptionCa: 'Repeteix 1s o 2s als daus de dany amb armes a dues mans o versàtils.' },
  { id: 'protection', labelCa: 'Protecció', descriptionCa: 'Imposa desavantatge a un atac contra un aliat adjacent si portes escut.' },
  { id: 'two-weapon-fighting', labelCa: 'Combat amb dues armes', descriptionCa: 'Afegeix el modificador d’aptitud al dany de l’atac secundari.' },
] as const;

export interface EquipmentOptionChoice {
  id: string;
  labelCa: string;
  items: readonly StartingItemTemplate[];
}

export interface EquipmentChoiceGroup {
  id: string;
  labelCa: string;
  options: readonly EquipmentOptionChoice[];
}

export interface ClassCreationRule {
  classId: string;
  skillChoiceCount: number;
  eligibleSkills: readonly SkillId[];
  armorProficiencies: readonly string[];
  weaponProficiencies: readonly string[];
  toolProficiencies: readonly string[];
  fightingStyleLevel: number | null;
  fightingStyleIds: readonly string[];
  startingEquipmentChoices: readonly EquipmentChoiceGroup[];
  fixedEquipment: readonly StartingItemTemplate[];
  startingGoldDefault: number;
  startingTraits: readonly TraitTemplate[];
}

const ITEM = {
  greataxe: { name: 'Destral gran', category: 'weapon', quantity: 1, weight: 3.5, equipped: true, damage: '1d12', damageType: 'tallant', weaponRange: '1,5 m', weaponProperties: 'Pesada, a dues mans' },
  longsword: { name: 'Espasa llarga', category: 'weapon', quantity: 1, weight: 1.5, equipped: true, damage: '1d8', damageType: 'tallant', weaponRange: '1,5 m', weaponProperties: 'Versàtil (1d10)' },
  shortsword: { name: 'Espasa curta', category: 'weapon', quantity: 1, weight: 1, equipped: true, damage: '1d6', damageType: 'perforant', weaponRange: '1,5 m', weaponProperties: 'Finesse, lleugera' },
  rapier: { name: 'Estoc', category: 'weapon', quantity: 1, weight: 1, equipped: true, damage: '1d8', damageType: 'perforant', weaponRange: '1,5 m', weaponProperties: 'Finesse' },
  dagger: { name: 'Daga', category: 'weapon', quantity: 1, weight: 0.5, equipped: true, damage: '1d4', damageType: 'perforant', weaponRange: '6/18 m', weaponProperties: 'Finesse, lleugera, llançament' },
  mace: { name: 'Maça', category: 'weapon', quantity: 1, weight: 2, equipped: true, damage: '1d6', damageType: 'contudent', weaponRange: '1,5 m', weaponProperties: '' },
  quarterstaff: { name: 'Bastó', category: 'weapon', quantity: 1, weight: 2, equipped: true, damage: '1d6', damageType: 'contudent', weaponRange: '1,5 m', weaponProperties: 'Versàtil (1d8)' },
  handaxe2: { name: 'Destral de mà', category: 'weapon', quantity: 2, weight: 2, equipped: false, damage: '1d6', damageType: 'tallant', weaponRange: '6/18 m', weaponProperties: 'Lleugera, llançament' },
  javelin4: { name: 'Javelina', category: 'weapon', quantity: 4, weight: 4, equipped: false, damage: '1d6', damageType: 'perforant', weaponRange: '9/36 m', weaponProperties: 'Llançament' },
  longbow: { name: 'Arc llarg', category: 'weapon', quantity: 1, weight: 1, equipped: true, damage: '1d8', damageType: 'perforant', weaponRange: '45/180 m', weaponProperties: 'Munició, pesada, a dues mans' },
  shortbow: { name: 'Arc curt', category: 'weapon', quantity: 1, weight: 1, equipped: true, damage: '1d6', damageType: 'perforant', weaponRange: '24/96 m', weaponProperties: 'Munició, a dues mans' },
  lightCrossbow: { name: 'Ballesta lleugera', category: 'weapon', quantity: 1, weight: 2.5, equipped: true, damage: '1d8', damageType: 'perforant', weaponRange: '24/96 m', weaponProperties: 'Munició, recàrrega, a dues mans' },
  leatherArmor: { name: 'Armadura de cuir', category: 'armor', quantity: 1, weight: 5, equipped: true, armorType: 'light', baseAc: 11, acBonus: 0 },
  scaleMail: { name: 'Cota d’escates', category: 'armor', quantity: 1, weight: 22, equipped: true, armorType: 'medium', baseAc: 14, acBonus: 0 },
  chainMail: { name: 'Cota de malla', category: 'armor', quantity: 1, weight: 27, equipped: true, armorType: 'heavy', baseAc: 16, acBonus: 0 },
  shield: { name: 'Escut', category: 'shield', quantity: 1, weight: 3, equipped: true, acBonus: 2 },
  explorerPack: { name: 'Paquet d’explorador', category: 'gear', quantity: 1, weight: 15, equipped: false },
  scholarPack: { name: 'Paquet d’erudit', category: 'gear', quantity: 1, weight: 8, equipped: false },
} as const satisfies Record<string, StartingItemTemplate>;

export const DND5E_CLASS_CREATION_RULES: Readonly<Record<string, ClassCreationRule>> = {
  barbarian: {
    classId: 'barbarian',
    skillChoiceCount: 2,
    eligibleSkills: ['animalHandling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'],
    armorProficiencies: ['Armadures lleugeres', 'Armadures mitjanes', 'Escuts'],
    weaponProficiencies: ['Armes senzilles', 'Armes marcials'],
    toolProficiencies: [],
    fightingStyleLevel: null,
    fightingStyleIds: [],
    startingEquipmentChoices: [
      {
        id: 'barbarian-primary',
        labelCa: 'Arma principal',
        options: [
          { id: 'greataxe', labelCa: 'Una destral gran', items: [ITEM.greataxe] },
          { id: 'longsword', labelCa: 'Una espasa llarga', items: [ITEM.longsword] },
        ],
      },
      {
        id: 'barbarian-secondary',
        labelCa: 'Arma secundària',
        options: [
          { id: 'handaxe2', labelCa: 'Dues destrals de mà', items: [ITEM.handaxe2] },
          { id: 'dagger', labelCa: 'Una daga', items: [ITEM.dagger] },
        ],
      },
    ],
    fixedEquipment: [ITEM.javelin4, ITEM.explorerPack],
    startingGoldDefault: 0,
    startingTraits: [
      { name: 'Ira i Defensa sense armadura (Bàrbar)', source: 'Classe (Niv. 1)', description: 'Entra en ira com a acció addicional i calcula la CA sense armadura com a 10 + DES + CON.' },
    ],
  },
  bard: {
    classId: 'bard',
    skillChoiceCount: 3,
    eligibleSkills: SKILL_IDS,
    armorProficiencies: ['Armadures lleugeres'],
    weaponProficiencies: ['Armes senzilles', 'Ballestes de mà', 'Espases llargues', 'Estocs', 'Espases curtes'],
    toolProficiencies: ['Tres instruments musicals'],
    fightingStyleLevel: null,
    fightingStyleIds: [],
    startingEquipmentChoices: [
      {
        id: 'bard-weapon',
        labelCa: 'Arma inicial',
        options: [
          { id: 'rapier', labelCa: 'Un estoc', items: [ITEM.rapier] },
          { id: 'longsword', labelCa: 'Una espasa llarga', items: [ITEM.longsword] },
          { id: 'dagger', labelCa: 'Una daga', items: [ITEM.dagger] },
        ],
      },
    ],
    fixedEquipment: [ITEM.leatherArmor, { ...ITEM.dagger, equipped: false }, { name: 'Instrument musical', category: 'gear', quantity: 1, weight: 1 }],
    startingGoldDefault: 0,
    startingTraits: [
      { name: 'Inspiració bàrdica', source: 'Classe (Niv. 1)', description: 'Atorga un dau d’inspiració (d6) als aliats com a acció addicional.' },
    ],
  },
  cleric: {
    classId: 'cleric',
    skillChoiceCount: 2,
    eligibleSkills: ['history', 'insight', 'medicine', 'persuasion', 'religion'],
    armorProficiencies: ['Armadures lleugeres', 'Armadures mitjanes', 'Escuts'],
    weaponProficiencies: ['Armes senzilles'],
    toolProficiencies: [],
    fightingStyleLevel: null,
    fightingStyleIds: [],
    startingEquipmentChoices: [
      {
        id: 'cleric-weapon',
        labelCa: 'Arma',
        options: [
          { id: 'mace', labelCa: 'Una maça', items: [ITEM.mace] },
          { id: 'quarterstaff', labelCa: 'Un bastó', items: [ITEM.quarterstaff] },
        ],
      },
      {
        id: 'cleric-armor',
        labelCa: 'Armadura inicial',
        options: [
          { id: 'scaleMail', labelCa: 'Cota d’escates', items: [ITEM.scaleMail] },
          { id: 'leatherArmor', labelCa: 'Armadura de cuir', items: [ITEM.leatherArmor] },
          { id: 'chainMail', labelCa: 'Cota de malla (si competent)', items: [ITEM.chainMail] },
        ],
      },
    ],
    fixedEquipment: [ITEM.shield, { name: 'Símbol sagrat', category: 'gear', quantity: 1, weight: 0.5 }, ITEM.explorerPack],
    startingGoldDefault: 0,
    startingTraits: [
      { name: 'Domini diví', source: 'Classe (Niv. 1)', description: 'Tria el teu domini diví amb conjurs sempre preparats i aptituds pròpies.' },
    ],
  },
  druid: {
    classId: 'druid',
    skillChoiceCount: 2,
    eligibleSkills: ['arcana', 'animalHandling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'],
    armorProficiencies: ['Armadures lleugeres', 'Armadures mitjanes', 'Escuts (no metàl·lics)'],
    weaponProficiencies: ['Armes senzilles', 'Simitarres'],
    toolProficiencies: ['Kit d’herbolari'],
    fightingStyleLevel: null,
    fightingStyleIds: [],
    startingEquipmentChoices: [
      {
        id: 'druid-offhand',
        labelCa: 'Mà secundària o arma',
        options: [
          { id: 'shield', labelCa: 'Un escut de fusta', items: [ITEM.shield] },
          { id: 'dagger', labelCa: 'Una daga', items: [ITEM.dagger] },
        ],
      },
    ],
    fixedEquipment: [ITEM.quarterstaff, ITEM.leatherArmor, { name: 'Focus druídic', category: 'gear', quantity: 1, weight: 0.5 }, ITEM.explorerPack],
    startingGoldDefault: 0,
    startingTraits: [
      { name: 'Druídic', source: 'Classe (Niv. 1)', description: 'Coneixes la llengua secreta dels druides.' },
    ],
  },
  fighter: {
    classId: 'fighter',
    skillChoiceCount: 2,
    eligibleSkills: ['acrobatics', 'animalHandling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'],
    armorProficiencies: ['Totes les armadures', 'Escuts'],
    weaponProficiencies: ['Armes senzilles', 'Armes marcials'],
    toolProficiencies: [],
    fightingStyleLevel: 1,
    fightingStyleIds: ['archery', 'defense', 'dueling', 'great-weapon-fighting', 'protection', 'two-weapon-fighting'],
    startingEquipmentChoices: [
      {
        id: 'fighter-armor',
        labelCa: 'Armadura inicial',
        options: [
          { id: 'chainMail', labelCa: 'Cota de malla (CA 16)', items: [ITEM.chainMail] },
          { id: 'leatherLongbow', labelCa: 'Armadura de cuir i arc llarg', items: [ITEM.leatherArmor, ITEM.longbow] },
        ],
      },
      {
        id: 'fighter-weapon',
        labelCa: 'Armament principal',
        options: [
          { id: 'longswordShield', labelCa: 'Espasa llarga i escut', items: [ITEM.longsword, ITEM.shield] },
          { id: 'greataxe', labelCa: 'Destral gran a dues mans', items: [ITEM.greataxe] },
        ],
      },
    ],
    fixedEquipment: [ITEM.handaxe2, ITEM.explorerPack],
    startingGoldDefault: 0,
    startingTraits: [
      { name: 'Segon alè', source: 'Classe (Niv. 1)', description: 'Recupera 1d10 + nivell de guerrer PV amb acció addicional un cop per descans.' },
    ],
  },
  monk: {
    classId: 'monk',
    skillChoiceCount: 2,
    eligibleSkills: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'],
    armorProficiencies: [],
    weaponProficiencies: ['Armes senzilles', 'Espases curtes'],
    toolProficiencies: ['Eines d’artesà o instrument musical'],
    fightingStyleLevel: null,
    fightingStyleIds: [],
    startingEquipmentChoices: [
      {
        id: 'monk-weapon',
        labelCa: 'Arma inicial',
        options: [
          { id: 'shortsword', labelCa: 'Una espasa curta', items: [ITEM.shortsword] },
          { id: 'quarterstaff', labelCa: 'Un bastó', items: [ITEM.quarterstaff] },
        ],
      },
    ],
    fixedEquipment: [{ ...ITEM.dagger, name: 'Dard', quantity: 10, weight: 1, weaponRange: '6/18 m', weaponProperties: 'Finesse, llançament', equipped: false }, ITEM.explorerPack],
    startingGoldDefault: 0,
    startingTraits: [
      { name: 'Defensa sense armadura i Arts Marcials', source: 'Classe (Niv. 1)', description: 'CA 10 + DES + SAV sense armadura ni escut; pots fer servir DES i dau d’Arts Marcials amb cops desarmats i armes de monjo.' },
    ],
  },
  paladin: {
    classId: 'paladin',
    skillChoiceCount: 2,
    eligibleSkills: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'],
    armorProficiencies: ['Totes les armadures', 'Escuts'],
    weaponProficiencies: ['Armes senzilles', 'Armes marcials'],
    toolProficiencies: [],
    fightingStyleLevel: 2,
    fightingStyleIds: ['defense', 'dueling', 'great-weapon-fighting', 'protection'],
    startingEquipmentChoices: [
      {
        id: 'paladin-weapon',
        labelCa: 'Arma i escut',
        options: [
          { id: 'longswordShield', labelCa: 'Espasa llarga i escut', items: [ITEM.longsword, ITEM.shield] },
          { id: 'greataxe', labelCa: 'Arma marcial pesada', items: [ITEM.greataxe] },
        ],
      },
    ],
    fixedEquipment: [ITEM.chainMail, ITEM.javelin4, { name: 'Símbol sagrat', category: 'gear', quantity: 1, weight: 0.5 }, ITEM.explorerPack],
    startingGoldDefault: 0,
    startingTraits: [
      { name: 'Sentit diví i Imposició de mans', source: 'Classe (Niv. 1)', description: 'Detecta presències celestials/infernals/no-mortes i cura amb una reserva de nivell × 5 PV.' },
    ],
  },
  ranger: {
    classId: 'ranger',
    skillChoiceCount: 3,
    eligibleSkills: ['animalHandling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'],
    armorProficiencies: ['Armadures lleugeres', 'Armadures mitjanes', 'Escuts'],
    weaponProficiencies: ['Armes senzilles', 'Armes marcials'],
    toolProficiencies: [],
    fightingStyleLevel: 2,
    fightingStyleIds: ['archery', 'defense', 'dueling', 'two-weapon-fighting'],
    startingEquipmentChoices: [
      {
        id: 'ranger-armor',
        labelCa: 'Armadura inicial',
        options: [
          { id: 'scaleMail', labelCa: 'Cota d’escates', items: [ITEM.scaleMail] },
          { id: 'leatherArmor', labelCa: 'Armadura de cuir', items: [ITEM.leatherArmor] },
        ],
      },
      {
        id: 'ranger-melee',
        labelCa: 'Armes cos a cos',
        options: [
          { id: 'shortswords', labelCa: 'Dues espases curtes', items: [{ ...ITEM.shortsword, quantity: 2 }] },
          { id: 'quarterstaff', labelCa: 'Un bastó', items: [ITEM.quarterstaff] },
        ],
      },
    ],
    fixedEquipment: [ITEM.longbow, ITEM.explorerPack],
    startingGoldDefault: 0,
    startingTraits: [
      { name: 'Enemic predilecte i Explorador nat', source: 'Classe (Niv. 1)', description: 'Especialització en seguiment i coneixement d’un tipus d’enemic i d’un entorn natural.' },
    ],
  },
  rogue: {
    classId: 'rogue',
    skillChoiceCount: 4,
    eligibleSkills: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleightOfHand', 'stealth'],
    armorProficiencies: ['Armadures lleugeres'],
    weaponProficiencies: ['Armes senzilles', 'Ballestes de mà', 'Espases llargues', 'Estocs', 'Espases curtes'],
    toolProficiencies: ['Eines de lladre'],
    fightingStyleLevel: null,
    fightingStyleIds: [],
    startingEquipmentChoices: [
      {
        id: 'rogue-primary',
        labelCa: 'Arma principal',
        options: [
          { id: 'rapier', labelCa: 'Un estoc', items: [ITEM.rapier] },
          { id: 'shortsword', labelCa: 'Una espasa curta', items: [ITEM.shortsword] },
        ],
      },
      {
        id: 'rogue-ranged',
        labelCa: 'Arma secundària',
        options: [
          { id: 'shortbow', labelCa: 'Un arc curt i buirac', items: [ITEM.shortbow] },
          { id: 'shortsword2', labelCa: 'Una segona espasa curta', items: [{ ...ITEM.shortsword, equipped: false }] },
        ],
      },
    ],
    fixedEquipment: [ITEM.leatherArmor, { ...ITEM.dagger, quantity: 2, equipped: false }, { name: 'Eines de lladre', category: 'gear', quantity: 1, weight: 0.5 }, ITEM.explorerPack],
    startingGoldDefault: 0,
    startingTraits: [
      { name: 'Expertesa, Atac furtiu (1d6) i Argot de lladres', source: 'Classe (Niv. 1)', description: 'Doble competència en dues habilitats i dany furtiu addicional amb avantatge o aliat adjacent.' },
    ],
  },
  sorcerer: {
    classId: 'sorcerer',
    skillChoiceCount: 2,
    eligibleSkills: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'],
    armorProficiencies: [],
    weaponProficiencies: ['Dagues', 'Dards', 'Fones', 'Bastons', 'Ballestes lleugeres'],
    toolProficiencies: [],
    fightingStyleLevel: null,
    fightingStyleIds: [],
    startingEquipmentChoices: [
      {
        id: 'sorcerer-weapon',
        labelCa: 'Arma inicial',
        options: [
          { id: 'lightCrossbow', labelCa: 'Ballesta lleugera', items: [ITEM.lightCrossbow] },
          { id: 'dagger', labelCa: 'Dues dagues', items: [{ ...ITEM.dagger, quantity: 2 }] },
        ],
      },
    ],
    fixedEquipment: [{ name: 'Focus arcà', category: 'gear', quantity: 1, weight: 0.5 }, ITEM.explorerPack],
    startingGoldDefault: 0,
    startingTraits: [
      { name: 'Origen sorceller', source: 'Classe (Niv. 1)', description: 'Font innata de la teva màgia arcana.' },
    ],
  },
  warlock: {
    classId: 'warlock',
    skillChoiceCount: 2,
    eligibleSkills: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'],
    armorProficiencies: ['Armadures lleugeres'],
    weaponProficiencies: ['Armes senzilles'],
    toolProficiencies: [],
    fightingStyleLevel: null,
    fightingStyleIds: [],
    startingEquipmentChoices: [
      {
        id: 'warlock-weapon',
        labelCa: 'Arma inicial',
        options: [
          { id: 'lightCrossbow', labelCa: 'Ballesta lleugera', items: [ITEM.lightCrossbow] },
          { id: 'quarterstaff', labelCa: 'Un bastó', items: [ITEM.quarterstaff] },
        ],
      },
    ],
    fixedEquipment: [ITEM.leatherArmor, { ...ITEM.dagger, quantity: 2, equipped: false }, { name: 'Focus arcà', category: 'gear', quantity: 1, weight: 0.5 }, ITEM.scholarPack],
    startingGoldDefault: 0,
    startingTraits: [
      { name: 'Patró d’ultratomba i Màgia de Pacte', source: 'Classe (Niv. 1)', description: 'Espais de conjur de nivell fix recuperats en descans curt.' },
    ],
  },
  wizard: {
    classId: 'wizard',
    skillChoiceCount: 2,
    eligibleSkills: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'],
    armorProficiencies: [],
    weaponProficiencies: ['Dagues', 'Dards', 'Fones', 'Bastons', 'Ballestes lleugeres'],
    toolProficiencies: [],
    fightingStyleLevel: null,
    fightingStyleIds: [],
    startingEquipmentChoices: [
      {
        id: 'wizard-weapon',
        labelCa: 'Arma inicial',
        options: [
          { id: 'quarterstaff', labelCa: 'Un bastó', items: [ITEM.quarterstaff] },
          { id: 'dagger', labelCa: 'Una daga', items: [ITEM.dagger] },
        ],
      },
    ],
    fixedEquipment: [{ name: 'Grimori de conjurs', category: 'gear', quantity: 1, weight: 1.5 }, { name: 'Focus arcà', category: 'gear', quantity: 1, weight: 0.5 }, ITEM.scholarPack],
    startingGoldDefault: 0,
    startingTraits: [
      { name: 'Recuperació arcana i Grimori', source: 'Classe (Niv. 1)', description: 'Prepara conjurs des del grimori i recupera espais en descans curt un cop al dia.' },
    ],
  },
} as const;

export function getRaceEntry(raw: string | null | undefined): RaceCatalogEntry | undefined {
  if (!raw) return undefined;
  const norm = normalizeMatchText(raw);
  if (!norm) return undefined;
  return DND5E_RACES.find(
    (r) =>
      r.id === norm ||
      normalizeMatchText(r.labelCa) === norm ||
      r.aliases.some((a) => normalizeMatchText(a) === norm)
  );
}

export function getSubraceEntry(
  race: RaceCatalogEntry | undefined,
  rawSubrace: string | null | undefined
): SubraceCatalogEntry | undefined {
  if (!race || !rawSubrace) return undefined;
  const norm = normalizeMatchText(rawSubrace);
  if (!norm) return undefined;
  return race.subraces.find(
    (sr) => sr.id === norm || normalizeMatchText(sr.labelCa) === norm
  );
}

export function getBackgroundEntry(
  raw: string | null | undefined
): BackgroundCatalogEntry | undefined {
  if (!raw) return undefined;
  const norm = normalizeMatchText(raw);
  if (!norm) return undefined;
  return DND5E_BACKGROUNDS.find(
    (b) =>
      b.id === norm ||
      normalizeMatchText(b.labelCa) === norm ||
      b.aliases.some((a) => normalizeMatchText(a) === norm)
  );
}

export function getClassCreationRule(classId: string): ClassCreationRule | undefined {
  return DND5E_CLASS_CREATION_RULES[classId];
}

export function computeFixedRacialBonuses(
  race: RaceCatalogEntry | undefined,
  subrace: SubraceCatalogEntry | undefined
): Record<AbilityKey, number> {
  const bonuses: Record<AbilityKey, number> = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
  for (const key of ABILITY_KEYS) {
    bonuses[key] = (race?.abilityBonuses[key] ?? 0) + (subrace?.abilityBonuses[key] ?? 0);
  }
  return bonuses;
}

export function enumerateValidRacialBonusVectors(
  race: RaceCatalogEntry | undefined,
  subrace: SubraceCatalogEntry | undefined
): Array<Record<AbilityKey, number>> {
  const base = computeFixedRacialBonuses(race, subrace);
  const flexCount = subrace?.flexibleBonusCount ?? race?.flexibleBonusCount ?? 0;
  if (flexCount <= 0) {
    return [base];
  }
  const excluded = new Set(
    subrace?.flexibleBonusExcluded ?? race?.flexibleBonusExcluded ?? []
  );
  const eligible = ABILITY_KEYS.filter((k) => !excluded.has(k));
  const results: Array<Record<AbilityKey, number>> = [];

  if (flexCount === 2) {
    for (let i = 0; i < eligible.length; i++) {
      for (let j = i + 1; j < eligible.length; j++) {
        const vec = { ...base };
        vec[eligible[i]] += 1;
        vec[eligible[j]] += 1;
        results.push(vec);
      }
    }
  } else {
    for (const k of eligible) {
      const vec = { ...base };
      vec[k] += flexCount;
      results.push(vec);
    }
  }

  return results.length > 0 ? results : [base];
}

export function calculatePointBuyCost(
  baseScores: Record<AbilityKey, number | null>
): { valid: boolean; totalCost: number; error?: string } {
  let totalCost = 0;
  for (const key of ABILITY_KEYS) {
    const score = baseScores[key];
    if (score === null) {
      return { valid: false, totalCost, error: `Falta assignar ${ABILITY_LABELS_CA[key]}.` };
    }
    if (!Number.isInteger(score) || score < POINT_BUY_MIN_2014 || score > POINT_BUY_MAX_2014) {
      return {
        valid: false,
        totalCost,
        error: `En compra de punts, cada puntuació base ha d’estar entre 8 i 15 (${ABILITY_LABELS_CA[key]}: ${score}).`,
      };
    }
    totalCost += POINT_BUY_COSTS_2014[score] ?? 0;
  }
  if (totalCost > POINT_BUY_BUDGET_2014) {
    return {
      valid: false,
      totalCost,
      error: `El cost de punts (${totalCost}) supera el pressupost oficial de ${POINT_BUY_BUDGET_2014}.`,
    };
  }
  return { valid: true, totalCost };
}

function isStandardArrayExact(values: readonly number[]): boolean {
  const sorted = [...values].sort((a, b) => b - a);
  return sorted.every((val, idx) => val === STANDARD_ARRAY_2014[idx]);
}

export function validateAbilityScoresAgainstMethod(
  finalScores: Dnd5e2014AbilityScores,
  method: AbilityScoreMethod,
  race: RaceCatalogEntry | undefined,
  subrace: SubraceCatalogEntry | undefined,
  unlockedAsiCount = 0
): { valid: boolean; reason?: string } {
  if (method === 'free' || method === 'manual_gm') {
    return { valid: true };
  }

  for (const key of ABILITY_KEYS) {
    const val = finalScores[key];
    if (val === null || !Number.isInteger(val)) {
      return {
        valid: false,
        reason: `Cal definir totes les sis característiques per validar el mètode de generació.`,
      };
    }
  }

  const bonusVectors = enumerateValidRacialBonusVectors(race, subrace);
  const asiAllowance = Math.max(0, unlockedAsiCount) * 2;

  if (method === 'standard_array') {
    if (asiAllowance === 0) {
      const ok = bonusVectors.some((vec) =>
        isStandardArrayExact(ABILITY_KEYS.map((k) => (finalScores[k] as number) - vec[k]))
      );
      if (ok) return { valid: true };
      return {
        valid: false,
        reason:
          'Les característiques finals no corresponen a l’array estàndard (15, 14, 13, 12, 10, 8) més els bonificadors racials.',
      };
    }
    // With ASI budget above level 1, verify final minus racial fits >= standard array within budget
    const sortedExpected = [...STANDARD_ARRAY_2014].sort((a, b) => a - b);
    const okWithAsi = bonusVectors.some((vec) => {
      const bases = ABILITY_KEYS.map((k) => (finalScores[k] as number) - vec[k]).sort(
        (a, b) => a - b
      );
      let deltaSum = 0;
      for (let i = 0; i < 6; i++) {
        if (bases[i] < sortedExpected[i] || bases[i] > 20) return false;
        deltaSum += bases[i] - sortedExpected[i];
      }
      return deltaSum <= asiAllowance;
    });
    if (okWithAsi) return { valid: true };
    return {
      valid: false,
      reason: 'Les puntuacions superen el pressupost de l’array estàndard + millores de nivell.',
    };
  }

  if (method === 'point_buy') {
    if (asiAllowance === 0) {
      const ok = bonusVectors.some((vec) => {
        const candidate: Record<AbilityKey, number | null> = {
          str: null,
          dex: null,
          con: null,
          int: null,
          wis: null,
          cha: null,
        };
        for (const k of ABILITY_KEYS) {
          candidate[k] = (finalScores[k] as number) - vec[k];
        }
        return calculatePointBuyCost(candidate).valid;
      });
      if (ok) return { valid: true };
      return {
        valid: false,
        reason:
          'Les puntuacions no compleixen la compra per punts (27 punts, valors base 8–15 abans de bonificadors racials).',
      };
    }
    // Level 4+ ASI allowance: each pre-ASI score must be >= 8 and total points beyond 15 fit ASI allowance
    const okWithAsi = bonusVectors.some((vec) => {
      const candidate: Record<AbilityKey, number | null> = {
        str: null,
        dex: null,
        con: null,
        int: null,
        wis: null,
        cha: null,
      };
      let extraOver15 = 0;
      for (const k of ABILITY_KEYS) {
        const base = (finalScores[k] as number) - vec[k];
        if (base < POINT_BUY_MIN_2014 || base > 20) return false;
        if (base > POINT_BUY_MAX_2014) {
          extraOver15 += base - POINT_BUY_MAX_2014;
          candidate[k] = POINT_BUY_MAX_2014;
        } else {
          candidate[k] = base;
        }
      }
      return extraOver15 <= asiAllowance && calculatePointBuyCost(candidate).valid;
    });
    if (okWithAsi) return { valid: true };
    return {
      valid: false,
      reason: 'Les puntuacions superen els 27 punts de compra per punts i les millores per nivell.',
    };
  }

  if (method === 'rolled_4d6_drop_lowest') {
    const ok = bonusVectors.some((vec) =>
      ABILITY_KEYS.every((k) => {
        const base = (finalScores[k] as number) - vec[k];
        return base >= 3 && base <= 18 + asiAllowance;
      })
    );
    if (ok) return { valid: true };
    return {
      valid: false,
      reason: 'Algun valor base surt del rang possible de 4d6 descartant el menor (3–18).',
    };
  }

  return { valid: true };
}

export interface RolledAbilityResult {
  total: number;
  dice: [number, number, number, number];
  dropped: number;
}

export function roll4d6DropLowestSet(rng: () => number = Math.random): RolledAbilityResult[] {
  const results: RolledAbilityResult[] = [];
  for (let i = 0; i < 6; i++) {
    const dice: [number, number, number, number] = [
      Math.floor(rng() * 6) + 1,
      Math.floor(rng() * 6) + 1,
      Math.floor(rng() * 6) + 1,
      Math.floor(rng() * 6) + 1,
    ];
    const sorted = [...dice].sort((a, b) => a - b);
    const dropped = sorted[0];
    const total = sorted[1] + sorted[2] + sorted[3];
    results.push({ total, dice, dropped });
  }
  return results.sort((a, b) => b.total - a.total);
}

export function calculateStartingHitPoints(
  classId: string,
  level: number,
  conScore: number | null,
  subraceId?: string | null
): number | null {
  const classMeta = getClassEntry(classId);
  if (!classMeta) return null;
  const safeLvl = Math.max(1, Math.min(20, Math.floor(level)));
  const conMod = conScore !== null && Number.isFinite(conScore) ? Math.floor((conScore - 10) / 2) : 0;
  const lvl1Hp = Math.max(1, classMeta.hitDie + conMod);
  const avgPerLevel = Math.max(1, classMeta.hitDie / 2 + 1 + conMod);
  const hillDwarfBonus = subraceId === 'hill-dwarf' ? safeLvl : 0;
  return lvl1Hp + (safeLvl - 1) * avgPerLevel + hillDwarfBonus;
}
