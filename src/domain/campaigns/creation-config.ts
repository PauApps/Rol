import { z } from 'zod';

export type CreationFreedomMode = 'free' | 'guided' | 'strict';
export type AbilityScoreMethod =
  | 'free'
  | 'standard_array'
  | 'point_buy'
  | 'rolled_4d6_drop_lowest'
  | 'manual_gm';

export const CREATION_REQUIRED_FIELD_OPTIONS = [
  'name',
  'race',
  'class',
  'background',
  'alignment',
  'backstory',
  'appearanceNotes',
] as const;

export type CreationRequiredFieldKey = (typeof CREATION_REQUIRED_FIELD_OPTIONS)[number];

export type CampaignCreationConfig = {
  freedomMode: CreationFreedomMode;
  startingLevel: number;
  allowedRaces: string[];
  allowedClasses: string[];
  allowedBackgrounds: string[];
  abilityScoreMethod: AbilityScoreMethod;
  requiredFields: CreationRequiredFieldKey[];
  restrictions: string;
};

export const DEFAULT_CAMPAIGN_CREATION_CONFIG: CampaignCreationConfig = {
  freedomMode: 'free',
  startingLevel: 1,
  allowedRaces: [],
  allowedClasses: [],
  allowedBackgrounds: [],
  abilityScoreMethod: 'free',
  requiredFields: ['name'],
  restrictions: '',
};

export const FREEDOM_MODE_LABELS_CA: Record<CreationFreedomMode, string> = {
  free: 'Creació lliure',
  guided: 'Creació guiada (recomanacions del GM)',
  strict: 'Creació estricta (només opcions permeses)',
};

export const ABILITY_METHOD_LABELS_CA: Record<AbilityScoreMethod, string> = {
  free: 'Lliure (a criteri del jugador)',
  standard_array: 'Valors estàndard (15, 14, 13, 12, 10, 8)',
  point_buy: 'Compra per punts (27 punts)',
  rolled_4d6_drop_lowest: 'Tirada 4d6 (descartant el menor)',
  manual_gm: 'Assignació directa del GM',
};

export const REQUIRED_FIELD_LABELS_CA: Record<CreationRequiredFieldKey, string> = {
  name: 'Nom del personatge',
  race: 'Raça',
  class: 'Classe',
  background: 'Antecedents',
  alignment: 'Alineament',
  backstory: 'Història personal',
  appearanceNotes: 'Descripció i aspecte',
};

function normalizeStringList(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of items) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(trimmed);
    }
  }
  return result;
}

const stringListSchema = z
  .array(z.string().max(80))
  .max(60)
  .transform(normalizeStringList);

export const campaignCreationConfigSchema = z
  .object({
    freedomMode: z.enum(['free', 'guided', 'strict']).default('free'),
    startingLevel: z
      .number()
      .int('El nivell inicial ha de ser un nombre enter.')
      .min(1, 'El nivell inicial mínim és 1.')
      .max(20, 'El nivell inicial màxim és 20.')
      .default(1),
    allowedRaces: stringListSchema.default([]),
    allowedClasses: stringListSchema.default([]),
    allowedBackgrounds: stringListSchema.default([]),
    abilityScoreMethod: z
      .enum(['free', 'standard_array', 'point_buy', 'rolled_4d6_drop_lowest', 'manual_gm'])
      .default('free'),
    requiredFields: z
      .array(z.enum(CREATION_REQUIRED_FIELD_OPTIONS))
      .default(['name'])
      .transform((fields) => {
        const set = new Set<CreationRequiredFieldKey>(fields);
        set.add('name');
        return Array.from(set);
      }),
    restrictions: z
      .string()
      .max(2000, 'Les restriccions no poden superar els 2000 caràcters.')
      .transform((v) => v.trim())
      .default(''),
  });

export function normalizeCampaignCreationConfig(raw: unknown): CampaignCreationConfig {
  const parsed = campaignCreationConfigSchema.safeParse(raw ?? {});
  if (parsed.success) {
    return parsed.data;
  }
  return {
    ...DEFAULT_CAMPAIGN_CREATION_CONFIG,
    allowedRaces: [...DEFAULT_CAMPAIGN_CREATION_CONFIG.allowedRaces],
    allowedClasses: [...DEFAULT_CAMPAIGN_CREATION_CONFIG.allowedClasses],
    allowedBackgrounds: [...DEFAULT_CAMPAIGN_CREATION_CONFIG.allowedBackgrounds],
    requiredFields: [...DEFAULT_CAMPAIGN_CREATION_CONFIG.requiredFields],
  };
}
