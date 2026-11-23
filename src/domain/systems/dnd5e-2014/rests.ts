import { badRequest } from '@/domain/errors';
import { getClassEntry } from './catalog';
import {
  evaluatePlayerFieldAccess,
  type NormalizedCharacterFieldPermissions,
} from './permissions';
import { computeCharacterResources } from './resources';
import {
  calculateProficiencyBonus,
  calculateTotalLevel,
  computeAbilityModifiers,
  computeSpellcasting,
} from './rules';
import type { Dnd5e2014SheetData } from './schema';
import type { Dnd5e2014SheetPatchInput } from './validation';

export interface SpendHitDieRequest {
  dieSize: 6 | 8 | 10 | 12;
  count: number;
  rolls?: number[];
}

export interface ShortRestOptions {
  hitDiceToSpend?: SpendHitDieRequest[];
  rng?: () => number;
  permissions?: NormalizedCharacterFieldPermissions;
  isGm?: boolean;
}

export interface ShortRestSummary {
  hitDiceSpent: number;
  hitDieRolls: Array<{ dieSize: 6 | 8 | 10 | 12; roll: number; conMod: number; healed: number }>;
  hpRestored: number;
  newCurrentHp: number | null;
  pactSlotsReset: boolean;
  resetResourceKeys: string[];
  skippedByPermissions: string[];
}

export interface LongRestOptions {
  includeDawnResources?: boolean;
  permissions?: NormalizedCharacterFieldPermissions;
  isGm?: boolean;
}

export interface LongRestSummary {
  newCurrentHp: number | null;
  temporaryHpCleared: number;
  hitDiceRecovered: number;
  newHitDiceUsed: number;
  resetSpellSlotKeys: string[];
  resetResourceKeys: string[];
  skippedDawnResourceKeys: string[];
  skippedManualCustomResourceKeys: string[];
  skippedByPermissions: string[];
}

function rollHitDie(dieSize: number, rng: () => number): number {
  const raw = Math.floor(rng() * dieSize) + 1;
  return Math.min(dieSize, Math.max(1, raw));
}

function isAllowed(
  fieldPath: string,
  options?: { isGm?: boolean; permissions?: NormalizedCharacterFieldPermissions }
): boolean {
  if (options?.isGm || !options?.permissions) {
    return true;
  }
  return evaluatePlayerFieldAccess(fieldPath, options.permissions).allowed;
}

function computeHitDiePoolBySize(sheet: Dnd5e2014SheetData): Map<6 | 8 | 10 | 12, number> {
  const pool = new Map<6 | 8 | 10 | 12, number>();
  for (const cls of sheet.raceAndClass.classes) {
    const meta = getClassEntry(cls.classId);
    if (meta) {
      pool.set(meta.hitDie, (pool.get(meta.hitDie) ?? 0) + Math.max(1, Math.floor(cls.level)));
    }
  }
  return pool;
}

/**
 * Pure D&D 5e (2014) Short Rest patch builder:
 * - Resets resources with `recovery === 'short_rest'`.
 * - Resets Warlock Pact Magic slots (`spellSlotsUsed.pact = 0`) without touching regular slots.
 * - Spends Hit Dice ONLY when explicitly requested in `hitDiceToSpend`.
 * - Respects player field permissions without ever altering official maximums or protected fields.
 */
export function buildShortRestPatch(
  sheet: Dnd5e2014SheetData,
  options?: ShortRestOptions
): { patch: Dnd5e2014SheetPatchInput; summary: ShortRestSummary } {
  const patch: Dnd5e2014SheetPatchInput = {};
  const skippedByPermissions: string[] = [];

  const totalLevel = calculateTotalLevel(sheet);
  const profBonus = calculateProficiencyBonus(totalLevel);
  const abilityMods = computeAbilityModifiers(sheet);
  const conMod = abilityMods.con ?? 0;
  const availableHitDice = Math.max(0, totalLevel - Math.max(0, sheet.hitPoints.hitDiceUsed));

  const hitDieRolls: ShortRestSummary['hitDieRolls'] = [];
  let totalSpent = 0;
  let totalHealed = 0;

  if (options?.hitDiceToSpend && options.hitDiceToSpend.length > 0) {
    if (!isAllowed('hitPoints.hitDiceUsed', options)) {
      skippedByPermissions.push('hitPoints.hitDiceUsed');
    } else {
      const poolBySize = computeHitDiePoolBySize(sheet);
    const hasDefinedClassPool = poolBySize.size > 0;
    const rng = options.rng ?? Math.random;

    for (const req of options.hitDiceToSpend) {
      if (!Number.isInteger(req.count) || req.count < 0) {
        throw badRequest('INVALID_HIT_DICE_SPEND', 'El nombre de daus de cop a gastar no és vàlid.');
      }
      if (req.count === 0) continue;

      if (hasDefinedClassPool) {
        const classPool = poolBySize.get(req.dieSize) ?? 0;
        if (req.count > classPool) {
          throw badRequest(
            'INVALID_HIT_DICE_SIZE',
            `El personatge no disposa de ${req.count} dau(s) d${req.dieSize}.`
          );
        }
      }

      if (req.rolls && req.rolls.length !== req.count) {
        throw badRequest(
          'INVALID_HIT_DICE_ROLLS',
          'El nombre de tirades de dau de cop ha de coincidir amb els daus gastats.'
        );
      }

      for (let i = 0; i < req.count; i++) {
        const rolled = req.rolls ? req.rolls[i] : rollHitDie(req.dieSize, rng);
        if (!Number.isInteger(rolled) || rolled < 1 || rolled > req.dieSize) {
          throw badRequest(
            'INVALID_HIT_DIE_ROLL',
            `La tirada del dau d${req.dieSize} ha d’estar entre 1 i ${req.dieSize}.`
          );
        }
        // Per PHB 2014 Errata: minimum 0 HP regained per Hit Die spent
        const healed = Math.max(0, rolled + conMod);
        hitDieRolls.push({ dieSize: req.dieSize, roll: rolled, conMod, healed });
        totalSpent += 1;
        totalHealed += healed;
      }
    }

    if (totalSpent > availableHitDice) {
      throw badRequest(
        'INSUFFICIENT_HIT_DICE',
        `Només tens ${availableHitDice} dau(s) de cop disponibles.`
      );
    }
    }
  }

  let newCurrentHp: number | null = sheet.hitPoints.current;
  if (totalSpent > 0) {
    const hpPatch: NonNullable<Dnd5e2014SheetPatchInput['hitPoints']> = {};

    if (isAllowed('hitPoints.hitDiceUsed', options)) {
      hpPatch.hitDiceUsed = sheet.hitPoints.hitDiceUsed + totalSpent;
    } else {
      skippedByPermissions.push('hitPoints.hitDiceUsed');
    }

    if (totalHealed > 0) {
      const baseline = sheet.hitPoints.current ?? 0;
      const uncapped = baseline + totalHealed;
      newCurrentHp = sheet.hitPoints.max !== null ? Math.min(sheet.hitPoints.max, uncapped) : uncapped;

      if (isAllowed('hitPoints.current', options)) {
        hpPatch.current = newCurrentHp;
      } else {
        skippedByPermissions.push('hitPoints.current');
        newCurrentHp = sheet.hitPoints.current;
      }
    }

    if (Object.keys(hpPatch).length > 0) {
      patch.hitPoints = hpPatch;
    }
  }

  // Pact Magic recovery on short rest
  const spellcasting = computeSpellcasting(sheet, abilityMods, profBonus);
  let pactSlotsReset = false;
  if (spellcasting?.pactMagic && (sheet.spellSlotsUsed.pact ?? 0) > 0) {
    if (isAllowed('spellSlotsUsed', options)) {
      patch.spellSlotsUsed = { pact: 0 };
      pactSlotsReset = true;
    } else {
      skippedByPermissions.push('spellSlotsUsed');
    }
  }

  // Reset ONLY `short_rest` resources
  const resources = computeCharacterResources(sheet, abilityMods, profBonus);
  const resourceUsagePatch: Record<string, number> = {};
  const resetResourceKeys: string[] = [];

  for (const res of resources) {
    if (res.recovery === 'short_rest' && (sheet.resourceUsage[res.usageKey] ?? 0) > 0) {
      if (resourceUsagePatch[res.usageKey] === undefined) {
        resourceUsagePatch[res.usageKey] = 0;
        resetResourceKeys.push(res.usageKey);
      }
    }
  }

  if (resetResourceKeys.length > 0) {
    if (isAllowed('resourceUsage', options)) {
      patch.resourceUsage = resourceUsagePatch;
    } else {
      skippedByPermissions.push('resourceUsage');
      resetResourceKeys.length = 0;
    }
  }

  return {
    patch,
    summary: {
      hitDiceSpent: totalSpent,
      hitDieRolls,
      hpRestored: totalHealed,
      newCurrentHp,
      pactSlotsReset,
      resetResourceKeys,
      skippedByPermissions,
    },
  };
}

/**
 * Pure D&D 5e (2014) Long Rest patch builder:
 * - Restores current HP to `hitPoints.max`, clears temporary HP to `0`, resets death saves.
 * - Recovers half total Hit Dice (rounded down, minimum 1), capped by spent Hit Dice.
 * - Resets all spent spell slots (`1..9` and `pact`) to `0`.
 * - Resets `short_rest` and `long_rest` resources; `dawn` ONLY when `includeDawnResources === true`;
 *   never auto-resets `other` / manual GM custom resources.
 */
export function buildLongRestPatch(
  sheet: Dnd5e2014SheetData,
  options?: LongRestOptions
): { patch: Dnd5e2014SheetPatchInput; summary: LongRestSummary } {
  const patch: Dnd5e2014SheetPatchInput = {};
  const skippedByPermissions: string[] = [];

  const totalLevel = calculateTotalLevel(sheet);
  const profBonus = calculateProficiencyBonus(totalLevel);
  const abilityMods = computeAbilityModifiers(sheet);

  // 1. Hit Points, Temporary HP, Death Saves, and Hit Dice recovery
  const hpPatch: NonNullable<Dnd5e2014SheetPatchInput['hitPoints']> = {};
  let newCurrentHp: number | null = sheet.hitPoints.current;
  let temporaryHpCleared = 0;
  let hitDiceRecovered = 0;
  let newHitDiceUsed = sheet.hitPoints.hitDiceUsed;

  if (sheet.hitPoints.max !== null && sheet.hitPoints.current !== sheet.hitPoints.max) {
    if (isAllowed('hitPoints.current', options)) {
      hpPatch.current = sheet.hitPoints.max;
      newCurrentHp = sheet.hitPoints.max;
    } else {
      skippedByPermissions.push('hitPoints.current');
    }
  }

  if ((sheet.hitPoints.temporary ?? 0) > 0) {
    if (isAllowed('hitPoints.temporary', options)) {
      temporaryHpCleared = sheet.hitPoints.temporary ?? 0;
      hpPatch.temporary = 0;
    } else {
      skippedByPermissions.push('hitPoints.temporary');
    }
  }

  if (sheet.hitPoints.deathSaves.successes > 0 || sheet.hitPoints.deathSaves.failures > 0) {
    if (isAllowed('hitPoints.deathSaves', options)) {
      hpPatch.deathSaves = { successes: 0, failures: 0 };
    } else {
      skippedByPermissions.push('hitPoints.deathSaves');
    }
  }

  const spentDice = Math.max(0, sheet.hitPoints.hitDiceUsed);
  if (spentDice > 0) {
    const allowance = Math.max(1, Math.floor(totalLevel / 2));
    const potentialRecovered = Math.min(spentDice, allowance);
    if (isAllowed('hitPoints.hitDiceUsed', options)) {
      hitDiceRecovered = potentialRecovered;
      newHitDiceUsed = spentDice - hitDiceRecovered;
      hpPatch.hitDiceUsed = newHitDiceUsed;
    } else {
      skippedByPermissions.push('hitPoints.hitDiceUsed');
    }
  }

  if (Object.keys(hpPatch).length > 0) {
    patch.hitPoints = hpPatch;
  }

  // 2. Spell slots recovery (regular 1..9 and Pact Magic)
  const slotResetEntries: Record<string, number> = {};
  const resetSpellSlotKeys: string[] = [];
  for (const [slotKey, usedCount] of Object.entries(sheet.spellSlotsUsed)) {
    if (typeof usedCount === 'number' && usedCount > 0) {
      slotResetEntries[slotKey] = 0;
      resetSpellSlotKeys.push(slotKey);
    }
  }
  if (resetSpellSlotKeys.length > 0) {
    if (isAllowed('spellSlotsUsed', options)) {
      patch.spellSlotsUsed = slotResetEntries;
    } else {
      skippedByPermissions.push('spellSlotsUsed');
      resetSpellSlotKeys.length = 0;
    }
  }

  // 3. Resources recovery
  const resources = computeCharacterResources(sheet, abilityMods, profBonus);
  const resourceUsagePatch: Record<string, number> = {};
  const resetResourceKeys: string[] = [];
  const skippedDawnResourceKeys: string[] = [];
  const skippedManualCustomResourceKeys: string[] = [];

  for (const res of resources) {
    const used = sheet.resourceUsage[res.usageKey] ?? 0;
    if (res.recovery === 'other') {
      if (res.isCustom && used > 0) {
        skippedManualCustomResourceKeys.push(res.usageKey);
      }
      continue;
    }
    if (res.recovery === 'dawn') {
      if (!options?.includeDawnResources) {
        if (used > 0) {
          skippedDawnResourceKeys.push(res.usageKey);
        }
        continue;
      }
    }
    if (used > 0 && resourceUsagePatch[res.usageKey] === undefined) {
      resourceUsagePatch[res.usageKey] = 0;
      resetResourceKeys.push(res.usageKey);
    }
  }

  if (resetResourceKeys.length > 0) {
    if (isAllowed('resourceUsage', options)) {
      patch.resourceUsage = resourceUsagePatch;
    } else {
      skippedByPermissions.push('resourceUsage');
      resetResourceKeys.length = 0;
    }
  }

  return {
    patch,
    summary: {
      newCurrentHp,
      temporaryHpCleared,
      hitDiceRecovered,
      newHitDiceUsed,
      resetSpellSlotKeys,
      resetResourceKeys,
      skippedDawnResourceKeys,
      skippedManualCustomResourceKeys,
      skippedByPermissions,
    },
  };
}
