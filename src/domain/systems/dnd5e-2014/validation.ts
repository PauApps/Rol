import { z } from 'zod';
import {
  ABILITY_KEYS,
  DEFAULT_ATTUNEMENT_LIMIT_2014,
  DND5E_CLASSES,
  MAX_OFFICIAL_LEVEL_2014,
  MIN_OFFICIAL_LEVEL_2014,
  SKILL_IDS,
  getSubclassEntry,
  type AbilityKey,
  type SkillId,
} from './catalog';
import type { RollMode } from './dice';
import {
  createEmptyDnd5e2014Sheet,
  type Dnd5e2014SheetData,
} from './schema';

export const SPELL_SLOT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'pact'] as const;
export type SpellSlotKey = (typeof SPELL_SLOT_KEYS)[number];

const CANONICAL_CLASS_IDS = DND5E_CLASSES.map((c) => c.id);
const CLASS_ID_VALUES: [string, ...string[]] = ['custom', ...CANONICAL_CLASS_IDS];
const rollModeValueSchema = z.enum(['disadvantage', 'normal', 'advantage']);

function nullableTrimmedString(maxLen: number) {
  return z
    .string()
    .max(maxLen)
    .transform((value) => {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    })
    .nullable();
}

function dedupeArray<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function stripUndefinedEntries(obj: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'number') {
      out[key] = value;
    }
  }
  return out;
}

function stripUndefinedRollModes(obj: Record<string, unknown>): Record<string, RollMode> {
  const out: Record<string, RollMode> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === 'disadvantage' || value === 'normal' || value === 'advantage') {
      out[key] = value;
    }
  }
  return out;
}

function buildFixedKeysNumberMap<TKey extends string>(
  keys: readonly TKey[],
  min: number,
  max: number
) {
  const entrySchema = z.number().int().min(min).max(max).optional();
  const shape = Object.fromEntries(keys.map((k) => [k, entrySchema])) as Record<
    TKey,
    typeof entrySchema
  >;
  return z.object(shape).strict().transform(stripUndefinedEntries);
}

function buildFixedKeysNullableNumberMap<TKey extends string>(
  keys: readonly TKey[],
  min: number,
  max: number
) {
  const entrySchema = z.number().int().min(min).max(max).nullable().optional();
  const shape = Object.fromEntries(keys.map((k) => [k, entrySchema])) as Record<
    TKey,
    typeof entrySchema
  >;
  return z.object(shape).strict();
}

function buildFixedKeysRollModeMap<TKey extends string>(keys: readonly TKey[]) {
  const entrySchema = rollModeValueSchema.optional();
  const shape = Object.fromEntries(keys.map((k) => [k, entrySchema])) as Record<
    TKey,
    typeof entrySchema
  >;
  return z.object(shape).strict().transform(stripUndefinedRollModes);
}

function buildFixedKeysNullableRollModeMap<TKey extends string>(keys: readonly TKey[]) {
  const entrySchema = rollModeValueSchema.nullable().optional();
  const shape = Object.fromEntries(keys.map((k) => [k, entrySchema])) as Record<
    TKey,
    typeof entrySchema
  >;
  return z.object(shape).strict();
}

export const dnd5e2014ClassEntrySchema = z
  .object({
    classId: z.enum(CLASS_ID_VALUES),
    customClassName: nullableTrimmedString(80).optional().default(null),
    subclassId: nullableTrimmedString(80).optional().default(null),
    customSubclassName: nullableTrimmedString(100).optional().default(null),
    level: z
      .number()
      .int('El nivell de classe ha de ser un enter.')
      .min(MIN_OFFICIAL_LEVEL_2014, 'El nivell mínim per classe és 1.')
      .max(MAX_OFFICIAL_LEVEL_2014, 'El nivell màxim oficial de D&D 5e (2014) és 20.'),
  })
  .strict()
  .superRefine((entry, ctx) => {
    if (entry.classId === 'custom' && !entry.customClassName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customClassName'],
        message: 'Cal especificar el nom de la classe personalitzada.',
      });
    }
    if (entry.subclassId) {
      const subMeta = getSubclassEntry(entry.subclassId);
      if (subMeta && subMeta.classId !== entry.classId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['subclassId'],
          message: `La subclasse "${subMeta.labelCa}" no correspon a la classe seleccionada.`,
        });
      }
    }
  });

const classListSchema = z
  .array(dnd5e2014ClassEntrySchema)
  .max(20)
  .superRefine((classes, ctx) => {
    const seenOfficial = new Set<string>();
    let totalLevel = 0;

    for (let i = 0; i < classes.length; i++) {
      const entry = classes[i];
      totalLevel += entry.level;
      if (entry.classId !== 'custom') {
        if (seenOfficial.has(entry.classId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [i, 'classId'],
            message: 'No es pot repetir la mateixa classe oficial en multiclasse.',
          });
        }
        seenOfficial.add(entry.classId);
      }
    }

    if (totalLevel > MAX_OFFICIAL_LEVEL_2014) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `La suma dels nivells de classe (${totalLevel}) supera el límit oficial de nivell ${MAX_OFFICIAL_LEVEL_2014} de D&D 5e (2014).`,
      });
    }
  });

export const dnd5e2014AttackEntrySchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    inventoryItemId: nullableTrimmedString(80).default(null),
    name: z.string().trim().min(1, 'El nom de l’atac és obligatori.').max(120),
    ability: z.enum(ABILITY_KEYS).nullable().default(null),
    proficient: z.boolean().default(true),
    bonusOverride: z.number().int().min(-20).max(40).nullable().default(null),
    attackBonus: nullableTrimmedString(40).default(null),
    damage: nullableTrimmedString(80).default(null),
    damageType: nullableTrimmedString(60).default(null),
    range: nullableTrimmedString(80).default(null),
    notes: z.string().max(1000).default(''),
  })
  .strict();

export const dnd5e2014InventoryItemSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1, 'El nom de l’objecte és obligatori.').max(120),
    category: z
      .enum(['weapon', 'armor', 'shield', 'gear', 'magic_item', 'treasure', 'custom'])
      .default('gear'),
    quantity: z.number().min(0).max(100000).default(1),
    weight: z.number().min(0).max(100000).nullable().default(null),
    equipped: z.boolean().default(false),
    armorType: z.enum(['light', 'medium', 'heavy']).nullable().default(null),
    baseAc: z.number().int().min(1).max(25).nullable().default(null),
    acBonus: z.number().int().min(-5).max(10).nullable().default(null),
    requiresAttunement: z.boolean().default(false),
    attuned: z.boolean().default(false),
    weaponAbility: z.enum(ABILITY_KEYS).nullable().default(null),
    weaponProficient: z.boolean().default(false),
    damage: nullableTrimmedString(80).default(null),
    damageType: nullableTrimmedString(60).default(null),
    weaponRange: nullableTrimmedString(80).default(null),
    weaponProperties: z.string().max(300).default(''),
    notes: z.string().max(1000).default(''),
  })
  .strict();

export const dnd5e2014TraitEntrySchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1, 'El nom del tret o aptitud és obligatori.').max(140),
    source: nullableTrimmedString(100).default(null),
    levelUnlocked: z
      .number()
      .int()
      .min(MIN_OFFICIAL_LEVEL_2014)
      .max(MAX_OFFICIAL_LEVEL_2014)
      .nullable()
      .default(null),
    description: z.string().max(4000).default(''),
  })
  .strict();

export const dnd5e2014SpellEntrySchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    level: z.number().int().min(0).max(9),
    name: z.string().trim().min(1, 'El nom del conjur és obligatori.').max(140),
    castingTime: z.string().max(100).default(''),
    range: z.string().max(100).default(''),
    components: z.string().max(120).default(''),
    duration: z.string().max(100).default(''),
    school: nullableTrimmedString(80).default(null),
    sourceType: z
      .enum(['class', 'pact', 'feature', 'race', 'item', 'custom'])
      .default('class'),
    sourceClassId: nullableTrimmedString(80).default(null),
    alwaysPrepared: z.boolean().default(false),
    prepared: z.boolean().default(false),
    inSpellbook: z.boolean().default(false),
    ritual: z.boolean().default(false),
    concentration: z.boolean().default(false),
    notes: z.string().max(4000).default(''),
  })
  .strict();

export const dnd5e2014CustomResourceSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1, 'El nom del recurs és obligatori.').max(120),
    maxUses: z.number().int().min(0).max(1000),
    recovery: z.enum(['short_rest', 'long_rest', 'dawn', 'other']).default('long_rest'),
    description: z.string().max(1000).default(''),
  })
  .strict();

export const dnd5e2014SessionNoteSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    date: z.string().max(40).default(''),
    title: z.string().trim().min(1, 'El títol de la nota és obligatori.').max(160),
    content: z.string().max(8000).default(''),
  })
  .strict();

export const dnd5e2014AsiEntrySchema = z
  .object({
    level: z.number().int().min(MIN_OFFICIAL_LEVEL_2014).max(MAX_OFFICIAL_LEVEL_2014),
    notes: z.string().max(1000).default(''),
  })
  .strict();

export const dnd5e2014LevelHistoryEntrySchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    level: z
      .number()
      .int()
      .min(MIN_OFFICIAL_LEVEL_2014)
      .max(MAX_OFFICIAL_LEVEL_2014),
    classId: z.enum(CLASS_ID_VALUES),
    customClassName: nullableTrimmedString(80).default(null),
    subclassId: nullableTrimmedString(80).default(null),
    hpGain: z.number().int().min(0).max(50).nullable().default(null),
    notes: z.string().max(1000).default(''),
    date: z.string().max(40).default(''),
  })
  .strict()
  .superRefine((entry, ctx) => {
    if (entry.classId === 'custom' && !entry.customClassName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customClassName'],
        message: 'L’entrada d’historial amb classe personalitzada requereix `customClassName`.',
      });
    }
    if (entry.subclassId) {
      const subMeta = getSubclassEntry(entry.subclassId);
      if (subMeta && subMeta.classId !== entry.classId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['subclassId'],
          message: `La subclasse "${subMeta.labelCa}" a l’historial no correspon a la classe "${entry.classId}".`,
        });
      }
    }
  });

const abilityScoreSchema = z
  .number()
  .int('La puntuació de característica ha de ser un enter.')
  .min(1, 'La puntuació mínima d’una característica és 1.')
  .max(30, 'La puntuació màxima oficial d’una característica és 30.')
  .nullable();

const abilityScoresSchema = z
  .object({
    str: abilityScoreSchema,
    dex: abilityScoreSchema,
    con: abilityScoreSchema,
    int: abilityScoreSchema,
    wis: abilityScoreSchema,
    cha: abilityScoreSchema,
  })
  .strict();

const proficiencyStringArraySchema = z
  .array(z.string().trim().min(1).max(100))
  .max(50)
  .transform(dedupeArray);

const resourceUsageRecordSchema = z
  .record(z.string().trim().min(1).max(120), z.number().int().min(0).max(1000))
  .superRefine((rec, ctx) => {
    if (Object.keys(rec).length > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Massa entrades d’ús de recursos (màxim 100).',
      });
    }
  });

const resourceUsagePatchRecordSchema = z
  .record(z.string().trim().min(1).max(120), z.number().int().min(0).max(1000).nullable())
  .superRefine((rec, ctx) => {
    if (Object.keys(rec).length > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Massa entrades d’ús de recursos (màxim 100).',
      });
    }
  });

export const dnd5e2014SheetSchema = z
  .object({
    generalInfo: z
      .object({
        name: z.string().trim().min(1).max(100),
        playerName: nullableTrimmedString(100),
        alignment: nullableTrimmedString(80),
        faith: nullableTrimmedString(120),
        age: nullableTrimmedString(40),
        size: nullableTrimmedString(40),
        senses: nullableTrimmedString(160),
        appearanceNotes: z.string().max(4000),
      })
      .strict(),
    raceAndClass: z
      .object({
        race: nullableTrimmedString(100),
        subrace: nullableTrimmedString(100),
        classes: classListSchema,
      })
      .strict(),
    abilities: abilityScoresSchema,
    savingThrows: z
      .object({
        proficient: z.array(z.enum(ABILITY_KEYS)).max(6).transform(dedupeArray),
        overrides: buildFixedKeysNumberMap(ABILITY_KEYS, -20, 40),
        rollModes: buildFixedKeysRollModeMap(ABILITY_KEYS),
      })
      .strict(),
    skills: z
      .object({
        proficient: z.array(z.enum(SKILL_IDS)).max(18).transform(dedupeArray),
        expertise: z.array(z.enum(SKILL_IDS)).max(18).transform(dedupeArray),
        halfProficient: z.boolean(),
        overrides: buildFixedKeysNumberMap(SKILL_IDS, -20, 40),
        rollModes: buildFixedKeysRollModeMap(SKILL_IDS),
      })
      .strict(),
    proficiencies: z
      .object({
        armor: proficiencyStringArraySchema,
        weapons: proficiencyStringArraySchema,
        tools: proficiencyStringArraySchema,
        languages: proficiencyStringArraySchema,
      })
      .strict(),
    hitPoints: z
      .object({
        max: z.number().int().min(0).max(9999).nullable(),
        current: z.number().int().min(0).max(9999).nullable(),
        temporary: z.number().int().min(0).max(9999).nullable(),
        hitDice: nullableTrimmedString(60),
        hitDiceUsed: z.number().int().min(0).max(20),
        deathSaves: z
          .object({
            successes: z.number().int().min(0).max(3),
            failures: z.number().int().min(0).max(3),
          })
          .strict(),
      })
      .strict(),
    armorClass: z
      .object({
        override: z.number().int().min(0).max(50).nullable(),
        unarmoredFormula: z.enum(['none', 'barbarian', 'monk']),
        notes: z.string().max(1000),
      })
      .strict(),
    initiative: z
      .object({
        override: z.number().int().min(-20).max(40).nullable(),
        bonus: z.number().int().min(-20).max(40),
      })
      .strict(),
    speed: z
      .object({
        walk: z.number().int().min(0).max(1000).nullable(),
        fly: z.number().int().min(0).max(1000).nullable(),
        swim: z.number().int().min(0).max(1000).nullable(),
        climb: z.number().int().min(0).max(1000).nullable(),
      })
      .strict(),
    attacks: z.array(dnd5e2014AttackEntrySchema).max(50),
    inventory: z.array(dnd5e2014InventoryItemSchema).max(300),
    attunement: z
      .object({
        limitOverride: z.number().int().min(0).max(10).nullable(),
      })
      .strict(),
    currency: z
      .object({
        cp: z.number().int().min(0).max(100000000),
        sp: z.number().int().min(0).max(100000000),
        ep: z.number().int().min(0).max(100000000),
        gp: z.number().int().min(0).max(100000000),
        pp: z.number().int().min(0).max(100000000),
      })
      .strict(),
    traitsAndFeatures: z.array(dnd5e2014TraitEntrySchema).max(150),
    spellcasting: z
      .object({
        abilityOverride: z.enum(ABILITY_KEYS).nullable(),
        saveDcOverride: z.number().int().min(1).max(40).nullable(),
        attackBonusOverride: z.number().int().min(-20).max(40).nullable(),
        usesSpellbook: z.boolean(),
        notes: z.string().max(4000),
      })
      .strict(),
    spells: z.array(dnd5e2014SpellEntrySchema).max(200),
    spellSlotsUsed: buildFixedKeysNumberMap(SPELL_SLOT_KEYS, 0, 20),
    spellSlotOverrides: buildFixedKeysNumberMap(SPELL_SLOT_KEYS, 0, 20),
    resourceUsage: resourceUsageRecordSchema,
    customResources: z.array(dnd5e2014CustomResourceSchema).max(50),
    progression: z
      .object({
        totalLevel: z
          .number()
          .int()
          .min(MIN_OFFICIAL_LEVEL_2014)
          .max(MAX_OFFICIAL_LEVEL_2014)
          .nullable(),
        experiencePoints: z.number().int().min(0).max(10000000),
        inspiration: z.boolean(),
        abilityScoreImprovements: z.array(dnd5e2014AsiEntrySchema).max(20),
        levelHistory: z.array(dnd5e2014LevelHistoryEntrySchema).max(20),
      })
      .strict(),
    background: z
      .object({
        backgroundName: nullableTrimmedString(120),
        personalityTraits: z.string().max(2000),
        ideals: z.string().max(2000),
        bonds: z.string().max(2000),
        flaws: z.string().max(2000),
        backstory: z.string().max(8000),
        sessionNotes: z.array(dnd5e2014SessionNoteSchema).max(200),
        additionalNotes: z.string().max(8000),
      })
      .strict(),
  })
  .strict()
  .superRefine((sheet, ctx) => {
    const classSum = sheet.raceAndClass.classes.reduce((sum, c) => sum + c.level, 0);
    if (sheet.raceAndClass.classes.length > 0 && sheet.progression.totalLevel !== null) {
      if (sheet.progression.totalLevel !== classSum) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['progression', 'totalLevel'],
          message: `El nivell total (${sheet.progression.totalLevel}) no coincideix amb la suma dels nivells de classe (${classSum}).`,
        });
      }
    }

    // Attunement consistency
    const invById = new Map<string, (typeof sheet.inventory)[number]>();
    let attunedCount = 0;
    for (let i = 0; i < sheet.inventory.length; i++) {
      const item = sheet.inventory[i];
      invById.set(item.id, item);
      if (item.attuned) {
        if (!item.requiresAttunement) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['inventory', i, 'attuned'],
            message: `L’objecte "${item.name}" no es pot sintonitzar perquè no requereix sintonització.`,
          });
        }
        attunedCount += 1;
      }
    }
    const maxAttune = sheet.attunement.limitOverride ?? DEFAULT_ATTUNEMENT_LIMIT_2014;
    if (attunedCount > maxAttune) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['inventory'],
        message: `Hi ha ${attunedCount} objectes sintonitzats i el màxim actual és de ${maxAttune}.`,
      });
    }

    // Linked attacks consistency (never duplicate or point to missing/non-weapon inventory items)
    const seenLinkedItems = new Set<string>();
    for (let i = 0; i < sheet.attacks.length; i++) {
      const atk = sheet.attacks[i];
      if (!atk.inventoryItemId) continue;
      if (seenLinkedItems.has(atk.inventoryItemId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['attacks', i, 'inventoryItemId'],
          message: 'No es pot enllaçar el mateix objecte d’inventari més d’una vegada dins atacs.',
        });
      }
      seenLinkedItems.add(atk.inventoryItemId);
      const linkedItem = invById.get(atk.inventoryItemId);
      if (!linkedItem || linkedItem.category !== 'weapon') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['attacks', i, 'inventoryItemId'],
          message: `L’atac "${atk.name}" referencia una arma inexistent o que no és de categoria arma.`,
        });
      }
    }

    // Level history consistency against character level and classes
    const effectiveTotalLevel =
      sheet.raceAndClass.classes.length > 0
        ? classSum
        : (sheet.progression.totalLevel ?? 1);

    const classLevelsByKey = new Map<string, { level: number; subclassId: string | null }>();
    for (const cls of sheet.raceAndClass.classes) {
      const key = cls.classId === 'custom' ? `custom:${cls.customClassName ?? ''}` : cls.classId;
      classLevelsByKey.set(key, { level: cls.level, subclassId: cls.subclassId ?? null });
    }

    const seenHistoryLevels = new Set<number>();
    const historyCountsByClass = new Map<string, number>();

    for (let i = 0; i < sheet.progression.levelHistory.length; i++) {
      const entry = sheet.progression.levelHistory[i];
      if (seenHistoryLevels.has(entry.level)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['progression', 'levelHistory', i, 'level'],
          message: `L’historial de progressió conté entrades duplicades per al nivell ${entry.level}.`,
        });
      }
      seenHistoryLevels.add(entry.level);

      if (entry.level > effectiveTotalLevel) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['progression', 'levelHistory', i, 'level'],
          message: `El nivell ${entry.level} de l’historial supera el nivell actual del personatge (${effectiveTotalLevel}).`,
        });
      }

      if (sheet.raceAndClass.classes.length > 0) {
        const key =
          entry.classId === 'custom' ? `custom:${entry.customClassName ?? ''}` : entry.classId;
        const currentClassInfo = classLevelsByKey.get(key);
        if (!currentClassInfo) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['progression', 'levelHistory', i, 'classId'],
            message: `La classe "${entry.customClassName || entry.classId}" de l’historial no correspon a cap classe activa del personatge.`,
          });
        } else {
          const nextCount = (historyCountsByClass.get(key) ?? 0) + 1;
          historyCountsByClass.set(key, nextCount);
          if (nextCount > currentClassInfo.level) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['progression', 'levelHistory', i, 'classId'],
              message: `L’historial registra més nivells de "${entry.customClassName || entry.classId}" (${nextCount}) dels que té actualment (${currentClassInfo.level}).`,
            });
          }
          if (
            currentClassInfo.subclassId &&
            entry.subclassId &&
            currentClassInfo.subclassId !== entry.subclassId
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['progression', 'levelHistory', i, 'subclassId'],
              message: `La subclasse "${entry.subclassId}" a l’historial contradiu la subclasse actual "${currentClassInfo.subclassId}".`,
            });
          }
        }
      }
    }
  });

export const dnd5e2014SheetPatchSchema = z
  .object({
    generalInfo: z
      .object({
        name: z.string().trim().min(1).max(100).optional(),
        playerName: nullableTrimmedString(100).optional(),
        alignment: nullableTrimmedString(80).optional(),
        faith: nullableTrimmedString(120).optional(),
        age: nullableTrimmedString(40).optional(),
        size: nullableTrimmedString(40).optional(),
        senses: nullableTrimmedString(160).optional(),
        appearanceNotes: z.string().max(4000).optional(),
      })
      .strict()
      .optional(),
    raceAndClass: z
      .object({
        race: nullableTrimmedString(100).optional(),
        subrace: nullableTrimmedString(100).optional(),
        classes: classListSchema.optional(),
      })
      .strict()
      .optional(),
    abilities: abilityScoresSchema.partial().strict().optional(),
    savingThrows: z
      .object({
        proficient: z.array(z.enum(ABILITY_KEYS)).max(6).transform(dedupeArray).optional(),
        overrides: buildFixedKeysNullableNumberMap(ABILITY_KEYS, -20, 40).optional(),
        rollModes: buildFixedKeysNullableRollModeMap(ABILITY_KEYS).optional(),
      })
      .strict()
      .optional(),
    skills: z
      .object({
        proficient: z.array(z.enum(SKILL_IDS)).max(18).transform(dedupeArray).optional(),
        expertise: z.array(z.enum(SKILL_IDS)).max(18).transform(dedupeArray).optional(),
        halfProficient: z.boolean().optional(),
        overrides: buildFixedKeysNullableNumberMap(SKILL_IDS, -20, 40).optional(),
        rollModes: buildFixedKeysNullableRollModeMap(SKILL_IDS).optional(),
      })
      .strict()
      .optional(),
    proficiencies: z
      .object({
        armor: proficiencyStringArraySchema.optional(),
        weapons: proficiencyStringArraySchema.optional(),
        tools: proficiencyStringArraySchema.optional(),
        languages: proficiencyStringArraySchema.optional(),
      })
      .strict()
      .optional(),
    hitPoints: z
      .object({
        max: z.number().int().min(0).max(9999).nullable().optional(),
        current: z.number().int().min(0).max(9999).nullable().optional(),
        temporary: z.number().int().min(0).max(9999).nullable().optional(),
        hitDice: nullableTrimmedString(60).optional(),
        hitDiceUsed: z.number().int().min(0).max(20).optional(),
        deathSaves: z
          .object({
            successes: z.number().int().min(0).max(3).optional(),
            failures: z.number().int().min(0).max(3).optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    armorClass: z
      .object({
        override: z.number().int().min(0).max(50).nullable().optional(),
        unarmoredFormula: z.enum(['none', 'barbarian', 'monk']).optional(),
        notes: z.string().max(1000).optional(),
      })
      .strict()
      .optional(),
    initiative: z
      .object({
        override: z.number().int().min(-20).max(40).nullable().optional(),
        bonus: z.number().int().min(-20).max(40).optional(),
      })
      .strict()
      .optional(),
    speed: z
      .object({
        walk: z.number().int().min(0).max(1000).nullable().optional(),
        fly: z.number().int().min(0).max(1000).nullable().optional(),
        swim: z.number().int().min(0).max(1000).nullable().optional(),
        climb: z.number().int().min(0).max(1000).nullable().optional(),
      })
      .strict()
      .optional(),
    attacks: z.array(dnd5e2014AttackEntrySchema).max(50).optional(),
    inventory: z.array(dnd5e2014InventoryItemSchema).max(300).optional(),
    attunement: z
      .object({
        limitOverride: z.number().int().min(0).max(10).nullable().optional(),
      })
      .strict()
      .optional(),
    currency: z
      .object({
        cp: z.number().int().min(0).max(100000000).optional(),
        sp: z.number().int().min(0).max(100000000).optional(),
        ep: z.number().int().min(0).max(100000000).optional(),
        gp: z.number().int().min(0).max(100000000).optional(),
        pp: z.number().int().min(0).max(100000000).optional(),
      })
      .strict()
      .optional(),
    traitsAndFeatures: z.array(dnd5e2014TraitEntrySchema).max(150).optional(),
    spellcasting: z
      .object({
        abilityOverride: z.enum(ABILITY_KEYS).nullable().optional(),
        saveDcOverride: z.number().int().min(1).max(40).nullable().optional(),
        attackBonusOverride: z.number().int().min(-20).max(40).nullable().optional(),
        usesSpellbook: z.boolean().optional(),
        notes: z.string().max(4000).optional(),
      })
      .strict()
      .optional(),
    spells: z.array(dnd5e2014SpellEntrySchema).max(200).optional(),
    spellSlotsUsed: buildFixedKeysNullableNumberMap(SPELL_SLOT_KEYS, 0, 20).optional(),
    spellSlotOverrides: buildFixedKeysNullableNumberMap(SPELL_SLOT_KEYS, 0, 20).optional(),
    resourceUsage: resourceUsagePatchRecordSchema.optional(),
    customResources: z.array(dnd5e2014CustomResourceSchema).max(50).optional(),
    progression: z
      .object({
        totalLevel: z
          .number()
          .int()
          .min(MIN_OFFICIAL_LEVEL_2014)
          .max(MAX_OFFICIAL_LEVEL_2014)
          .nullable()
          .optional(),
        experiencePoints: z.number().int().min(0).max(10000000).optional(),
        inspiration: z.boolean().optional(),
        abilityScoreImprovements: z.array(dnd5e2014AsiEntrySchema).max(20).optional(),
        levelHistory: z.array(dnd5e2014LevelHistoryEntrySchema).max(20).optional(),
      })
      .strict()
      .optional(),
    background: z
      .object({
        backgroundName: nullableTrimmedString(120).optional(),
        personalityTraits: z.string().max(2000).optional(),
        ideals: z.string().max(2000).optional(),
        bonds: z.string().max(2000).optional(),
        flaws: z.string().max(2000).optional(),
        backstory: z.string().max(8000).optional(),
        sessionNotes: z.array(dnd5e2014SessionNoteSchema).max(200).optional(),
        additionalNotes: z.string().max(8000).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type Dnd5e2014SheetPatchInput = z.input<typeof dnd5e2014SheetPatchSchema>;
export type Dnd5e2014SheetPatchOutput = z.output<typeof dnd5e2014SheetPatchSchema>;

export const characterFieldPermissionsSchema = z
  .object({
    playerEditableFields: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
    gmOnlyFields: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
    authorizedOverrideFields: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  })
  .strict();

export const customFieldsPatchSchema = z.record(
  z.string().max(80),
  z.union([z.string().max(2000), z.number(), z.boolean(), z.null()])
);

export const createCharacterRequestSchema = z
  .object({
    name: z.string().trim().min(1, 'El nom del personatge és obligatori.').max(100),
    memberId: z.string().uuid().nullable().optional(),
    overrideLimit: z.boolean().optional(),
    sheetData: dnd5e2014SheetPatchSchema.optional(),
    customFields: customFieldsPatchSchema.optional(),
    gmNotes: z.string().max(8000).optional(),
    fieldPermissions: characterFieldPermissionsSchema.optional(),
  })
  .strict();

export const updateCharacterRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    sheetFields: z
      .object({
        'generalInfo.appearanceNotes': z.string().max(4000).optional(),
        'background.backstory': z.string().max(8000).optional(),
      })
      .strict()
      .optional(),
    sheetPatch: dnd5e2014SheetPatchSchema.optional(),
    customFields: customFieldsPatchSchema.optional(),
    gmNotes: z.string().max(8000).optional(),
    fieldPermissions: characterFieldPermissionsSchema.optional(),
    memberId: z.string().uuid().nullable().optional(),
  })
  .strict();

function applyNumericMapPatch<TKey extends string>(
  current: Record<string, number>,
  patch: Partial<Record<TKey, number | null>> | undefined
): Record<string, number> {
  const next: Record<string, number> = { ...current };
  if (!patch) return next;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value === null) {
      delete next[key];
    } else if (typeof value === 'number') {
      next[key] = value;
    }
  }
  return next;
}

function applyRollModeMapPatch<TKey extends string>(
  current: Partial<Record<TKey, RollMode>>,
  patch: Partial<Record<TKey, RollMode | null>> | undefined
): Partial<Record<TKey, RollMode>> {
  const next: Partial<Record<TKey, RollMode>> = { ...current };
  if (!patch) return next;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value === null) {
      delete next[key as TKey];
    } else if (value === 'disadvantage' || value === 'normal' || value === 'advantage') {
      next[key as TKey] = value;
    }
  }
  return next;
}

/**
 * Pure deep merge of a validated v2 sheet patch into a normalized v2 sheet object.
 * Preserves untouched fields, allows explicit null deletion inside override/roll-mode maps,
 * and keeps `progression.totalLevel` aligned with class levels when classes exist.
 */
export function mergeDnd5e2014SheetPatch(
  base: Dnd5e2014SheetData,
  patch: Dnd5e2014SheetPatchOutput
): Dnd5e2014SheetData {
  const next: Dnd5e2014SheetData = structuredClone(base);

  if (patch.generalInfo) {
    next.generalInfo = { ...next.generalInfo, ...patch.generalInfo };
  }
  if (patch.raceAndClass) {
    next.raceAndClass = {
      race:
        patch.raceAndClass.race !== undefined ? patch.raceAndClass.race : next.raceAndClass.race,
      subrace:
        patch.raceAndClass.subrace !== undefined
          ? patch.raceAndClass.subrace
          : next.raceAndClass.subrace,
      classes:
        patch.raceAndClass.classes !== undefined
          ? patch.raceAndClass.classes.map((c) => ({ ...c }))
          : next.raceAndClass.classes,
    };
  }
  if (patch.abilities) {
    next.abilities = { ...next.abilities, ...patch.abilities };
  }
  if (patch.savingThrows) {
    next.savingThrows = {
      proficient: patch.savingThrows.proficient ?? next.savingThrows.proficient,
      overrides: applyNumericMapPatch(
        next.savingThrows.overrides,
        patch.savingThrows.overrides
      ) as Dnd5e2014SheetData['savingThrows']['overrides'],
      rollModes: applyRollModeMapPatch(
        next.savingThrows.rollModes,
        patch.savingThrows.rollModes as Partial<Record<AbilityKey, RollMode | null>> | undefined
      ),
    };
  }
  if (patch.skills) {
    next.skills = {
      proficient: patch.skills.proficient ?? next.skills.proficient,
      expertise: patch.skills.expertise ?? next.skills.expertise,
      halfProficient: patch.skills.halfProficient ?? next.skills.halfProficient,
      overrides: applyNumericMapPatch(
        next.skills.overrides,
        patch.skills.overrides
      ) as Dnd5e2014SheetData['skills']['overrides'],
      rollModes: applyRollModeMapPatch(
        next.skills.rollModes,
        patch.skills.rollModes as Partial<Record<SkillId, RollMode | null>> | undefined
      ),
    };
  }
  if (patch.proficiencies) {
    next.proficiencies = { ...next.proficiencies, ...patch.proficiencies };
  }
  if (patch.hitPoints) {
    next.hitPoints = {
      ...next.hitPoints,
      ...patch.hitPoints,
      deathSaves: patch.hitPoints.deathSaves
        ? { ...next.hitPoints.deathSaves, ...patch.hitPoints.deathSaves }
        : next.hitPoints.deathSaves,
    };
  }
  if (patch.armorClass) {
    next.armorClass = { ...next.armorClass, ...patch.armorClass };
  }
  if (patch.initiative) {
    next.initiative = { ...next.initiative, ...patch.initiative };
  }
  if (patch.speed) {
    next.speed = { ...next.speed, ...patch.speed };
  }
  if (patch.attacks !== undefined) {
    next.attacks = patch.attacks.map((a) => ({ ...a }));
  }
  if (patch.inventory !== undefined) {
    next.inventory = patch.inventory.map((i) => ({ ...i }));
  }
  if (patch.attunement) {
    next.attunement = { ...next.attunement, ...patch.attunement };
  }
  if (patch.currency) {
    next.currency = { ...next.currency, ...patch.currency };
  }
  if (patch.traitsAndFeatures !== undefined) {
    next.traitsAndFeatures = patch.traitsAndFeatures.map((t) => ({ ...t }));
  }
  if (patch.spellcasting) {
    next.spellcasting = { ...next.spellcasting, ...patch.spellcasting };
  }
  if (patch.spells !== undefined) {
    next.spells = patch.spells.map((s) => ({ ...s }));
  }
  if (patch.spellSlotsUsed) {
    next.spellSlotsUsed = applyNumericMapPatch(next.spellSlotsUsed, patch.spellSlotsUsed);
  }
  if (patch.spellSlotOverrides) {
    next.spellSlotOverrides = applyNumericMapPatch(
      next.spellSlotOverrides,
      patch.spellSlotOverrides
    );
  }
  if (patch.resourceUsage) {
    next.resourceUsage = applyNumericMapPatch(next.resourceUsage, patch.resourceUsage);
  }
  if (patch.customResources !== undefined) {
    next.customResources = patch.customResources.map((r) => ({ ...r }));
  }
  if (patch.progression) {
    next.progression = {
      ...next.progression,
      ...patch.progression,
      abilityScoreImprovements:
        patch.progression.abilityScoreImprovements ?? next.progression.abilityScoreImprovements,
      levelHistory:
        patch.progression.levelHistory !== undefined
          ? patch.progression.levelHistory.map((h) => ({ ...h })).sort((a, b) => a.level - b.level)
          : next.progression.levelHistory,
    };
  }
  if (patch.background) {
    next.background = {
      ...next.background,
      ...patch.background,
      sessionNotes: patch.background.sessionNotes ?? next.background.sessionNotes,
    };
  }

  // Keep totalLevel synchronized with class progression when classes are defined
  // and caller did not explicitly supply a conflicting progression.totalLevel.
  if (
    next.raceAndClass.classes.length > 0 &&
    patch.raceAndClass?.classes !== undefined &&
    patch.progression?.totalLevel === undefined
  ) {
    next.progression.totalLevel = next.raceAndClass.classes.reduce((sum, c) => sum + c.level, 0);
  }

  return next;
}

export function buildEmptySheetFromPatch(
  name: string,
  startingLevel: number,
  initialPatch?: Dnd5e2014SheetPatchOutput
): Dnd5e2014SheetData {
  const empty = createEmptyDnd5e2014Sheet(name);
  empty.progression.totalLevel = startingLevel;
  if (!initialPatch) {
    return empty;
  }
  const merged = mergeDnd5e2014SheetPatch(empty, initialPatch);
  merged.generalInfo.name = name;
  return merged;
}
