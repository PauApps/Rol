import { badRequest } from '@/domain/errors';
import {
  evaluatePlayerFieldAccess,
  type NormalizedCharacterFieldPermissions,
} from './permissions';
import { computeCharacterResources } from './resources';
import {
  calculateProficiencyBonus,
  calculateTotalLevel,
  computeAbilityModifiers,
  computeHitDiceSummary,
  computeSpellcasting,
} from './rules';
import {
  HIT_DIE_KEYS,
  hitDieSizeToKey,
  sumHitDiceUsedByDie,
  type Dnd5e2014HitDiceUsedByDie,
  type Dnd5e2014SheetData,
  type HitDieKey,
  type HitDieSize,
} from './schema';
import type { Dnd5e2014SheetPatchInput } from './validation';

export interface SpendHitDieRequest {
  dieSize: HitDieSize;
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
  hitDiceSpentByDie: Dnd5e2014HitDiceUsedByDie;
  hitDieRolls: Array<{ dieSize: HitDieSize; roll: number; conMod: number; healed: number }>;
  hpRestored: number;
  newCurrentHp: number | null;
  pactSlotsReset: boolean;
  resetResourceKeys: string[];
  skippedByPermissions: string[];
}

export interface LongRestOptions {
  includeDawnResources?: boolean;
  hitDiceToRecover?: Dnd5e2014HitDiceUsedByDie;
  permissions?: NormalizedCharacterFieldPermissions;
  isGm?: boolean;
}

export interface LongRestSummary {
  newCurrentHp: number | null;
  temporaryHpCleared: number;
  hitDiceRecovered: number;
  hitDiceRecoveredByDie: Dnd5e2014HitDiceUsedByDie | null;
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

function pruneZeroHitDice(byDie: Dnd5e2014HitDiceUsedByDie): Dnd5e2014HitDiceUsedByDie {
  const out: Dnd5e2014HitDiceUsedByDie = {};
  for (const key of HIT_DIE_KEYS) {
    const val = byDie[key];
    if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
      out[key] = Math.floor(val);
    }
  }
  return out;
}

/**
 * Pure D&D 5e (2014) Short Rest patch builder:
 * - Resets resources with `recovery === 'short_rest'`.
 * - Resets Warlock Pact Magic slots (`spellSlotsUsed.pact = 0`) without touching regular slots.
 * - Spends Hit Dice ONLY when explicitly requested in `hitDiceToSpend`, validating per-die
 *   class availability when tracked (`hitDiceUsedByDie !== null`) and never inventing legacy splits.
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
  const hitDicePool = computeHitDiceSummary(sheet, totalLevel);
  const byDieEntryMap = new Map(hitDicePool.byDie.map((entry) => [entry.dieSize, entry]));
  const hasDefinedClassPool = hitDicePool.byDie.length > 0;
  const isTrackedByDie = sheet.hitPoints.hitDiceUsedByDie !== null;

  const hitDieRolls: ShortRestSummary['hitDieRolls'] = [];
  const requestedBySize = new Map<HitDieSize, number>();
  let totalSpent = 0;
  let totalHealed = 0;

  if (options?.hitDiceToSpend && options.hitDiceToSpend.length > 0) {
    if (!isAllowed('hitPoints.hitDiceUsed', options)) {
      skippedByPermissions.push('hitPoints.hitDiceUsed');
    } else {
      const rng = options.rng ?? Math.random;

      for (const req of options.hitDiceToSpend) {
        if (!Number.isInteger(req.count) || req.count < 0) {
          throw badRequest('INVALID_HIT_DICE_SPEND', 'El nombre de daus de cop a gastar no és vàlid.');
        }
        if (req.count === 0) continue;

        const cumulativeForSize = (requestedBySize.get(req.dieSize) ?? 0) + req.count;

        if (hasDefinedClassPool) {
          const entry = byDieEntryMap.get(req.dieSize);
          if (!entry || cumulativeForSize > entry.total) {
            throw badRequest(
              'INVALID_HIT_DICE_SIZE',
              `El personatge no disposa de ${cumulativeForSize} dau(s) d${req.dieSize}.`
            );
          }
          if (isTrackedByDie && entry.available !== null && cumulativeForSize > entry.available) {
            throw badRequest(
              'INSUFFICIENT_HIT_DICE_FOR_SIZE',
              `Només tens ${entry.available} dau(s) d${req.dieSize} disponibles.`
            );
          }
        }

        if (req.rolls && req.rolls.length !== req.count) {
          throw badRequest(
            'INVALID_HIT_DICE_ROLLS',
            'El nombre de tirades de dau de cop ha de coincidir amb els daus gastats.'
          );
        }

        requestedBySize.set(req.dieSize, cumulativeForSize);

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

      if (totalSpent > hitDicePool.available) {
        throw badRequest(
          'INSUFFICIENT_HIT_DICE',
          `Només tens ${hitDicePool.available} dau(s) de cop disponibles.`
        );
      }
    }
  }

  const spentByDie: Dnd5e2014HitDiceUsedByDie = {};
  for (const [size, count] of requestedBySize.entries()) {
    if (count > 0) {
      spentByDie[hitDieSizeToKey(size)] = count;
    }
  }

  let newCurrentHp: number | null = sheet.hitPoints.current;
  if (totalSpent > 0) {
    const hpPatch: NonNullable<Dnd5e2014SheetPatchInput['hitPoints']> = {};

    if (isAllowed('hitPoints.hitDiceUsed', options)) {
      if (isTrackedByDie) {
        const nextByDie = { ...(sheet.hitPoints.hitDiceUsedByDie ?? {}) };
        for (const [key, val] of Object.entries(spentByDie) as Array<[HitDieKey, number]>) {
          nextByDie[key] = (nextByDie[key] ?? 0) + val;
        }
        const cleanedByDie = pruneZeroHitDice(nextByDie);
        hpPatch.hitDiceUsed = sumHitDiceUsedByDie(cleanedByDie);
        if (isAllowed('hitPoints.hitDiceUsedByDie', options)) {
          hpPatch.hitDiceUsedByDie = cleanedByDie;
        }
      } else if (hitDicePool.used === 0) {
        hpPatch.hitDiceUsed = totalSpent;
        if (isAllowed('hitPoints.hitDiceUsedByDie', options)) {
          hpPatch.hitDiceUsedByDie = pruneZeroHitDice(spentByDie);
        }
      } else {
        // Legacy multiclass unallocated usage: increment global counter without inventing per-die history
        hpPatch.hitDiceUsed = hitDicePool.used + totalSpent;
      }
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
      hitDiceSpentByDie: spentByDie,
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
 * - Recovers up to half total Hit Dice (rounded down, minimum 1), bounded per die size
 *   when per-die tracking is present (`hitDiceUsedByDie !== null`), and never invents splits
 *   on legacy unallocated multiclass sheets.
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
  const hitDicePool = computeHitDiceSummary(sheet, totalLevel);

  // 1. Hit Points, Temporary HP, Death Saves, and Hit Dice recovery
  const hpPatch: NonNullable<Dnd5e2014SheetPatchInput['hitPoints']> = {};
  let newCurrentHp: number | null = sheet.hitPoints.current;
  let temporaryHpCleared = 0;
  let hitDiceRecovered = 0;
  let newHitDiceUsed = hitDicePool.used;
  let hitDiceRecoveredByDie: Dnd5e2014HitDiceUsedByDie | null =
    sheet.hitPoints.hitDiceUsedByDie !== null ? {} : null;

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

  const spentDice = hitDicePool.used;
  if (spentDice > 0) {
    const allowance = Math.max(1, Math.floor(totalLevel / 2));
    const maxRecoverable = Math.min(spentDice, allowance);

    if (sheet.hitPoints.hitDiceUsedByDie !== null) {
      const currentByDie = pruneZeroHitDice(sheet.hitPoints.hitDiceUsedByDie);
      const nextByDie: Dnd5e2014HitDiceUsedByDie = { ...currentByDie };
      const recoveredMap: Dnd5e2014HitDiceUsedByDie = {};

      if (options?.hitDiceToRecover !== undefined) {
        let requestedTotal = 0;
        for (const key of HIT_DIE_KEYS) {
          const reqVal = options.hitDiceToRecover[key];
          if (reqVal === undefined) continue;
          if (!Number.isInteger(reqVal) || reqVal < 0) {
            throw badRequest(
              'INVALID_HIT_DICE_RECOVERY',
              `La recuperació de daus de cop ${key} ha de ser un enter no negatiu.`
            );
          }
          if (reqVal === 0) continue;
          const currentlySpent = currentByDie[key] ?? 0;
          if (reqVal > currentlySpent) {
            throw badRequest(
              'INVALID_HIT_DICE_RECOVERY',
              `No pots recuperar ${reqVal} dau(s) ${key} perquè només se n’havien gastat ${currentlySpent}.`
            );
          }
          requestedTotal += reqVal;
          recoveredMap[key] = reqVal;
          const remainingForKey = currentlySpent - reqVal;
          if (remainingForKey > 0) {
            nextByDie[key] = remainingForKey;
          } else {
            delete nextByDie[key];
          }
        }
        if (requestedTotal > maxRecoverable) {
          throw badRequest(
            'INVALID_HIT_DICE_RECOVERY',
            `En un descans llarg pots recuperar com a màxim ${maxRecoverable} dau(s) de cop.`
          );
        }
      } else {
        // Recover largest spent dice first (d12 -> d10 -> d8 -> d6) without exceeding each die pool
        let remainingAllowance = maxRecoverable;
        for (const key of ['d12', 'd10', 'd8', 'd6'] as const) {
          if (remainingAllowance <= 0) break;
          const currentlySpent = nextByDie[key] ?? 0;
          if (currentlySpent <= 0) continue;
          const take = Math.min(remainingAllowance, currentlySpent);
          recoveredMap[key] = take;
          remainingAllowance -= take;
          const remainingForKey = currentlySpent - take;
          if (remainingForKey > 0) {
            nextByDie[key] = remainingForKey;
          } else {
            delete nextByDie[key];
          }
        }
      }

      const cleanedNextByDie = pruneZeroHitDice(nextByDie);
      const nextUsed = sumHitDiceUsedByDie(cleanedNextByDie);
      const actualRecovered = Math.max(0, spentDice - nextUsed);

      if (isAllowed('hitPoints.hitDiceUsed', options)) {
        hitDiceRecovered = actualRecovered;
        hitDiceRecoveredByDie = recoveredMap;
        newHitDiceUsed = nextUsed;
        hpPatch.hitDiceUsed = newHitDiceUsed;
        if (isAllowed('hitPoints.hitDiceUsedByDie', options)) {
          const patchByDie: Dnd5e2014HitDiceUsedByDie = { ...cleanedNextByDie };
          for (const key of HIT_DIE_KEYS) {
            if ((currentByDie[key] ?? 0) > 0 && patchByDie[key] === undefined) {
              patchByDie[key] = 0;
            }
          }
          hpPatch.hitDiceUsedByDie = patchByDie;
        }
      } else {
        skippedByPermissions.push('hitPoints.hitDiceUsed');
      }
    } else {
      // Legacy unallocated multiclass usage
      if (options?.hitDiceToRecover && sumHitDiceUsedByDie(options.hitDiceToRecover) > 0) {
        throw badRequest(
          'UNALLOCATED_LEGACY_HIT_DICE',
          'Aquesta fitxa antiga no té desglossament per mida dels daus gastats; executa el descans llarg sense especificar mides individuals.'
        );
      }

      if (isAllowed('hitPoints.hitDiceUsed', options)) {
        hitDiceRecovered = maxRecoverable;
        newHitDiceUsed = Math.max(0, spentDice - hitDiceRecovered);
        hitDiceRecoveredByDie = null;
        hpPatch.hitDiceUsed = newHitDiceUsed;
        if (newHitDiceUsed === 0 && isAllowed('hitPoints.hitDiceUsedByDie', options)) {
          // Zero ambiguity left once all spent dice recover
          hpPatch.hitDiceUsedByDie = {};
        }
      } else {
        skippedByPermissions.push('hitPoints.hitDiceUsed');
      }
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
      hitDiceRecoveredByDie,
      newHitDiceUsed,
      resetSpellSlotKeys,
      resetResourceKeys,
      skippedDawnResourceKeys,
      skippedManualCustomResourceKeys,
      skippedByPermissions,
    },
  };
}
