import type { GameSystemSectionDefinition } from '../types';

/**
 * Structural base model for D&D 5e (2014) character sheets.
 * Covers all sections listed in DOCUMENT_MESTRE.md §6.2.
 *
 * IMPORTANT: No derived calculations, D&D 5e rules, or 2024 rules are implemented here.
 * Those belong strictly to Phase 3 after auditing the Pim Bramble reference sheet.
 */
export interface Dnd5e2014AbilityScores {
  str: number | null;
  dex: number | null;
  con: number | null;
  int: number | null;
  wis: number | null;
  cha: number | null;
}

export interface Dnd5e2014SheetData extends Record<string, unknown> {
  generalInfo: {
    name: string;
    playerName: string | null;
    alignment: string | null;
    faith: string | null;
    age: string | null;
    appearanceNotes: string;
  };
  raceAndClass: {
    race: string | null;
    subrace: string | null;
    classes: Array<{
      name: string;
      subclass: string | null;
      level: number;
    }>;
  };
  abilities: Dnd5e2014AbilityScores;
  savingThrows: {
    proficient: Array<keyof Dnd5e2014AbilityScores>;
    overrides: Partial<Record<keyof Dnd5e2014AbilityScores, number>>;
  };
  skills: {
    proficient: string[];
    expertise: string[];
    overrides: Record<string, number>;
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
    deathSaves: {
      successes: number;
      failures: number;
    };
  };
  armorClass: {
    override: number | null;
    notes: string;
  };
  initiative: {
    override: number | null;
  };
  speed: {
    walk: number | null;
    fly: number | null;
    swim: number | null;
    climb: number | null;
  };
  attacks: Array<{
    id: string;
    name: string;
    attackBonus: string | null;
    damage: string | null;
    damageType: string | null;
    notes: string;
  }>;
  inventory: Array<{
    id: string;
    name: string;
    quantity: number;
    weight: number | null;
    equipped: boolean;
    notes: string;
  }>;
  currency: {
    cp: number;
    sp: number;
    ep: number;
    gp: number;
    pp: number;
  };
  traitsAndFeatures: Array<{
    id: string;
    name: string;
    source: string | null;
    description: string;
  }>;
  spells: Array<{
    id: string;
    level: number;
    name: string;
    prepared: boolean;
    notes: string;
  }>;
  spellSlots: Record<string, { total: number; used: number }>;
  progression: {
    totalLevel: number | null;
    experiencePoints: number;
    inspiration: boolean;
  };
  background: {
    backgroundName: string | null;
    personalityTraits: string;
    ideals: string;
    bonds: string;
    flaws: string;
    backstory: string;
  };
}

export const DND5E_2014_SECTIONS: GameSystemSectionDefinition[] = [
  { key: 'generalInfo', labelCa: 'Informació general', descriptionCa: 'Nom, aspecte i dades bàsiques.' },
  { key: 'raceAndClass', labelCa: 'Raça i classe', descriptionCa: 'Llinatge, classe i nivells.' },
  { key: 'abilities', labelCa: 'Característiques', descriptionCa: 'Puntuacions base (FOR, DES, CON, INT, SAV, CAR).' },
  { key: 'savingThrows', labelCa: 'Salvacions', descriptionCa: 'Competències i excepcions de salvació.' },
  { key: 'skills', labelCa: 'Habilitats', descriptionCa: 'Habilitats competents, expertesa i excepcions.' },
  { key: 'proficiencies', labelCa: 'Competències', descriptionCa: 'Armadures, armes, eines i idiomes.' },
  { key: 'hitPoints', labelCa: 'Punts de cop', descriptionCa: 'Vida màxima, actual, temporal i daus de cop.' },
  { key: 'armorClass', labelCa: "Classe d'armadura", descriptionCa: 'Protecció i modificadors especials.' },
  { key: 'initiative', labelCa: 'Iniciativa', descriptionCa: 'Ordre d’actuació i excepcions.' },
  { key: 'speed', labelCa: 'Velocitat', descriptionCa: 'Desplaçament base i especials.' },
  { key: 'attacks', labelCa: 'Atacs', descriptionCa: 'Armes i conjurs ofensius freqüents.' },
  { key: 'inventory', labelCa: 'Equipament i inventari', descriptionCa: 'Objectes transportats i equipats.' },
  { key: 'currency', labelCa: 'Monedes', descriptionCa: 'PC, PP, PE, PO i PPT.' },
  { key: 'traitsAndFeatures', labelCa: 'Trets i aptituds', descriptionCa: 'Trets racials, de classe i dots.' },
  { key: 'spells', labelCa: 'Conjurs', descriptionCa: 'Llista de conjurs coneguts o preparats.' },
  { key: 'spellSlots', labelCa: 'Espais de conjur', descriptionCa: 'Espais disponibles per nivell.' },
  { key: 'progression', labelCa: 'Progressió i experiència', descriptionCa: 'Nivell total, PE i inspiració.' },
  { key: 'background', labelCa: 'Història i antecedents', descriptionCa: 'Rerefons, trets, ideals, vincles i defectes.' },
];

export function createEmptyDnd5e2014Sheet(characterName: string): Dnd5e2014SheetData {
  return {
    generalInfo: {
      name: characterName,
      playerName: null,
      alignment: null,
      faith: null,
      age: null,
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
    },
    skills: {
      proficient: [],
      expertise: [],
      overrides: {},
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
      deathSaves: {
        successes: 0,
        failures: 0,
      },
    },
    armorClass: {
      override: null,
      notes: '',
    },
    initiative: {
      override: null,
    },
    speed: {
      walk: null,
      fly: null,
      swim: null,
      climb: null,
    },
    attacks: [],
    inventory: [],
    currency: {
      cp: 0,
      sp: 0,
      ep: 0,
      gp: 0,
      pp: 0,
    },
    traitsAndFeatures: [],
    spells: [],
    spellSlots: {},
    progression: {
      totalLevel: null,
      experiencePoints: 0,
      inspiration: false,
    },
    background: {
      backgroundName: null,
      personalityTraits: '',
      ideals: '',
      bonds: '',
      flaws: '',
      backstory: '',
    },
  };
}
