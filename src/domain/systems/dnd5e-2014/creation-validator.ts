import {
  REQUIRED_FIELD_LABELS_CA,
  type CampaignCreationConfig,
  type CreationRequiredFieldKey,
} from '@/domain/campaigns/creation-config';
import { getClassEntry, normalizeMatchText, resolveClassId } from './catalog';
import { calculateTotalLevel } from './rules';
import type { Dnd5e2014ClassEntry, Dnd5e2014SheetData } from './schema';

export interface CreationValidationOptions {
  isGm: boolean;
  isCreation: boolean;
  touchedPaths?: string[];
}

export interface CreationValidationResult {
  valid: boolean;
  violations: string[];
  warnings: string[];
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function isAllowedStringMatch(candidate: string, allowedList: string[]): boolean {
  const normalizedCandidate = normalizeMatchText(candidate);
  return allowedList.some((allowed) => normalizeMatchText(allowed) === normalizedCandidate);
}

function isAllowedClassMatch(cls: Dnd5e2014ClassEntry, allowedClasses: string[]): boolean {
  const classMeta = getClassEntry(cls.classId);
  const candidateTokens = new Set<string>([normalizeMatchText(cls.classId)]);

  if (classMeta) {
    candidateTokens.add(normalizeMatchText(classMeta.labelCa));
    const parenIdx = classMeta.labelCa.indexOf('(');
    if (parenIdx > 0) {
      candidateTokens.add(normalizeMatchText(classMeta.labelCa.slice(0, parenIdx)));
    }
  }
  if (cls.customClassName) {
    candidateTokens.add(normalizeMatchText(cls.customClassName));
  }

  for (const allowed of allowedClasses) {
    const normalizedAllowed = normalizeMatchText(allowed);
    if (candidateTokens.has(normalizedAllowed)) {
      return true;
    }
    const resolvedAllowedId = resolveClassId(allowed);
    if (resolvedAllowedId !== 'custom' && resolvedAllowedId === cls.classId) {
      return true;
    }
  }

  return false;
}

function isRequiredFieldPresent(sheet: Dnd5e2014SheetData, key: CreationRequiredFieldKey): boolean {
  switch (key) {
    case 'name':
      return hasText(sheet.generalInfo.name);
    case 'race':
      return hasText(sheet.raceAndClass.race);
    case 'class':
      return sheet.raceAndClass.classes.length > 0;
    case 'background':
      return hasText(sheet.background.backgroundName);
    case 'alignment':
      return hasText(sheet.generalInfo.alignment);
    case 'backstory':
      return hasText(sheet.background.backstory);
    case 'appearanceNotes':
      return hasText(sheet.generalInfo.appearanceNotes);
  }
}

function wasRequiredFieldTouched(
  key: CreationRequiredFieldKey,
  touchedPaths: string[]
): boolean {
  const touched = new Set(touchedPaths);
  switch (key) {
    case 'name':
      return touched.has('name') || touched.has('generalInfo.name');
    case 'race':
      return touched.has('raceAndClass') || touched.has('raceAndClass.race');
    case 'class':
      return touched.has('raceAndClass') || touched.has('raceAndClass.classes');
    case 'background':
      return touched.has('background') || touched.has('background.backgroundName');
    case 'alignment':
      return touched.has('generalInfo') || touched.has('generalInfo.alignment');
    case 'backstory':
      return touched.has('background') || touched.has('background.backstory');
    case 'appearanceNotes':
      return touched.has('generalInfo') || touched.has('generalInfo.appearanceNotes');
  }
}

function wasSectionTouched(touchedPaths: string[] | undefined, exactPath: string, sectionPrefix: string): boolean {
  if (!touchedPaths) return true;
  return touchedPaths.includes(exactPath) || touchedPaths.includes(sectionPrefix);
}

/**
 * Validates a D&D 5e (2014) character sheet against the campaign's server-side `creationConfig`.
 * - `'strict'`: enforces `requiredFields`, `startingLevel` (on creation), and allowlists
 *   (`allowedRaces`, `allowedClasses`, `allowedBackgrounds`) for non-GM actors.
 * - `'guided'`: enforces `requiredFields` while converting allowlist / starting-level deviations
 *   into non-blocking warnings.
 * - `'free'`: enforces `requiredFields` (typically `['name']`) freely within level 1..20 bounds.
 * - GM actors keep override authority (`valid: true`), receiving deviations as advisory `warnings`.
 */
export function validateCharacterAgainstCampaignConfig(
  sheet: Dnd5e2014SheetData,
  config: CampaignCreationConfig,
  options: CreationValidationOptions
): CreationValidationResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  // 1. Required fields check
  for (const fieldKey of config.requiredFields) {
    const shouldCheck =
      options.isCreation ||
      !options.touchedPaths ||
      wasRequiredFieldTouched(fieldKey, options.touchedPaths);

    if (shouldCheck && !isRequiredFieldPresent(sheet, fieldKey)) {
      const msg = `El camp "${REQUIRED_FIELD_LABELS_CA[fieldKey]}" és obligatori segons la configuració de la campanya.`;
      if (options.isGm) {
        warnings.push(msg);
      } else {
        violations.push(msg);
      }
    }
  }

  // 2. Freedom mode checks (allowlists + starting level)
  if (config.freedomMode !== 'free') {
    const recordDeviation = (msg: string) => {
      if (config.freedomMode === 'strict' && !options.isGm) {
        violations.push(msg);
      } else {
        warnings.push(msg);
      }
    };

    const checkRace =
      options.isCreation || wasSectionTouched(options.touchedPaths, 'raceAndClass.race', 'raceAndClass');
    if (checkRace && config.allowedRaces.length > 0 && hasText(sheet.raceAndClass.race)) {
      const race = sheet.raceAndClass.race!;
      if (!isAllowedStringMatch(race, config.allowedRaces)) {
        recordDeviation(
          `La raça "${race}" no es troba entre les races permeses de la campanya (${config.allowedRaces.join(', ')}).`
        );
      }
    }

    const checkClasses =
      options.isCreation ||
      wasSectionTouched(options.touchedPaths, 'raceAndClass.classes', 'raceAndClass');
    if (
      checkClasses &&
      config.allowedClasses.length > 0 &&
      sheet.raceAndClass.classes.length > 0
    ) {
      for (const cls of sheet.raceAndClass.classes) {
        if (!isAllowedClassMatch(cls, config.allowedClasses)) {
          const classLabel =
            cls.customClassName?.trim() || getClassEntry(cls.classId)?.labelCa || cls.classId;
          recordDeviation(
            `La classe "${classLabel}" no es troba entre les classes permeses de la campanya (${config.allowedClasses.join(', ')}).`
          );
        }
      }
    }

    const checkBackground =
      options.isCreation ||
      wasSectionTouched(options.touchedPaths, 'background.backgroundName', 'background');
    if (
      checkBackground &&
      config.allowedBackgrounds.length > 0 &&
      hasText(sheet.background.backgroundName)
    ) {
      const bg = sheet.background.backgroundName!;
      if (!isAllowedStringMatch(bg, config.allowedBackgrounds)) {
        recordDeviation(
          `L’antecedent "${bg}" no es troba entre els antecedents permesos de la campanya (${config.allowedBackgrounds.join(', ')}).`
        );
      }
    }

    if (options.isCreation) {
      const computedLevel = calculateTotalLevel(sheet);
      if (computedLevel !== config.startingLevel) {
        recordDeviation(
          `El nivell inicial del personatge (${computedLevel}) ha de coincidir amb el nivell inicial de la campanya (${config.startingLevel}).`
        );
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    warnings,
  };
}
