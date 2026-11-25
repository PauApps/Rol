import {
  getAllowedOfficialAttackAbilities,
  getAllowedOfficialWeaponAbilities,
} from './attacks';
import type {
  Dnd5e2014AttackEntry,
  Dnd5e2014SheetData,
  Dnd5e2014SpellcastingSourceOverride,
} from './schema';
import type { Dnd5e2014SheetPatchOutput } from './validation';

/**
 * Derived / homebrew override paths in D&D 5e (2014) that alter official rules-engine
 * calculations. Non-GM players CANNOT set or alter these fields unless the GM explicitly
 * unlocks the specific path in `fieldPermissions.authorizedOverrideFields`.
 */
export const PROTECTED_OFFICIAL_CALCULATION_PATHS = [
  'savingThrows.overrides',
  'skills.overrides',
  'armorClass.override',
  'initiative.override',
  'initiative.bonus',
  'attacks.ability',
  'attacks.proficient',
  'attacks.gmCustom',
  'attacks.bonusOverride',
  'attacks.attackBonus',
  'inventory.weaponProficient',
  'inventory.weaponAbilityOverride',
  'attunement.limitOverride',
  'spellcasting.abilityOverride',
  'spellcasting.saveDcOverride',
  'spellcasting.attackBonusOverride',
  'spellcasting.sourceOverrides',
  'spellSlotOverrides',
  'customResources',
] as const;

export type ProtectedOfficialCalculationPath =
  (typeof PROTECTED_OFFICIAL_CALCULATION_PATHS)[number];

const PROTECTED_PATH_SET = new Set<string>(PROTECTED_OFFICIAL_CALCULATION_PATHS);

export type CharacterFieldPermissions = {
  playerEditableFields?: string[];
  gmOnlyFields?: string[];
  authorizedOverrideFields?: string[];
};

export type NormalizedCharacterFieldPermissions = {
  playerEditableFields: string[];
  gmOnlyFields: string[];
  authorizedOverrideFields: string[];
};

/**
 * Default editable paths for character owners in v2 sheets.
 * Notice: protected override paths are NEVER granted here (even when their parent
 * section is listed), and `customFields` remains opt-in per GM configuration.
 */
export const DEFAULT_PLAYER_EDITABLE_FIELDS = [
  'name',
  'generalInfo.playerName',
  'generalInfo.alignment',
  'generalInfo.faith',
  'generalInfo.age',
  'generalInfo.size',
  'generalInfo.senses',
  'generalInfo.appearanceNotes',
  'raceAndClass.race',
  'raceAndClass.subrace',
  'abilities',
  'savingThrows',
  'skills',
  'proficiencies',
  'hitPoints',
  'armorClass',
  'speed',
  'attacks',
  'inventory',
  'currency',
  'traitsAndFeatures',
  'spellcasting',
  'spells',
  'spellSlotsUsed',
  'resourceUsage',
  'progression.inspiration',
  'progression.abilityScoreImprovements',
  'progression.levelHistory',
  'background.backgroundName',
  'background.personalityTraits',
  'background.ideals',
  'background.bonds',
  'background.flaws',
  'background.backstory',
  'background.sessionNotes',
  'background.additionalNotes',
] as const;

/**
 * Complete list of non-override paths that a GM may optionally enable for a player.
 * Note: `raceAndClass.classes`, `progression.experiencePoints`, and `progression.totalLevel`
 * are controlled exclusively by the GM by default and only granted to players when explicit.
 */
export const GM_GRANTABLE_PLAYER_FIELDS = [
  ...DEFAULT_PLAYER_EDITABLE_FIELDS,
  'raceAndClass.classes',
  'progression.experiencePoints',
  'progression.totalLevel',
] as const;

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const set = new Set<string>();
  for (const item of value) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed) set.add(trimmed);
    }
  }
  return Array.from(set);
}

function matchesFieldOrAncestor(fieldPath: string, listSet: Set<string>): boolean {
  if (listSet.has('*') || listSet.has(fieldPath)) return true;
  if (fieldPath === 'generalInfo.name' && listSet.has('name')) return true;
  if (fieldPath === 'name' && (listSet.has('generalInfo.name') || listSet.has('generalInfo'))) {
    return true;
  }
  const parts = fieldPath.split('.');
  for (let i = parts.length - 1; i >= 1; i--) {
    if (listSet.has(parts.slice(0, i).join('.'))) {
      return true;
    }
  }
  return false;
}

export function findCanonicalProtectedPath(fieldPath: string): string | null {
  if (PROTECTED_PATH_SET.has(fieldPath)) {
    return fieldPath;
  }
  for (const protectedPath of PROTECTED_OFFICIAL_CALCULATION_PATHS) {
    if (fieldPath.startsWith(`${protectedPath}.`)) {
      return protectedPath;
    }
  }
  return null;
}

export function normalizeFieldPermissions(raw: unknown): NormalizedCharacterFieldPermissions {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const gmOnlyFields = normalizeStringArray(obj.gmOnlyFields) ?? [];
  const gmOnlySet = new Set(gmOnlyFields);

  const rawEditable = normalizeStringArray(obj.playerEditableFields);
  const baseEditable =
    rawEditable !== undefined ? rawEditable : [...DEFAULT_PLAYER_EDITABLE_FIELDS];

  const rawAuthorizedOverrides = normalizeStringArray(obj.authorizedOverrideFields) ?? [];

  return {
    playerEditableFields: baseEditable.filter((field) => !matchesFieldOrAncestor(field, gmOnlySet)),
    gmOnlyFields,
    authorizedOverrideFields: rawAuthorizedOverrides.filter(
      (field) =>
        PROTECTED_PATH_SET.has(field) && !matchesFieldOrAncestor(field, gmOnlySet)
    ),
  };
}

export type PlayerFieldAccessDecision =
  | { allowed: true }
  | { allowed: false; reason: 'GM_ONLY' | 'OFFICIAL_CALCULATION_PROTECTED' | 'NOT_AUTHORIZED' };

export function evaluatePlayerFieldAccess(
  fieldPath: string,
  perms: NormalizedCharacterFieldPermissions
): PlayerFieldAccessDecision {
  const gmOnlySet = new Set(perms.gmOnlyFields);
  if (matchesFieldOrAncestor(fieldPath, gmOnlySet)) {
    return { allowed: false, reason: 'GM_ONLY' };
  }

  const protectedCanonical = findCanonicalProtectedPath(fieldPath);
  if (protectedCanonical !== null) {
    const authorizedSet = new Set(perms.authorizedOverrideFields);
    if (authorizedSet.has(protectedCanonical) || authorizedSet.has(fieldPath)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'OFFICIAL_CALCULATION_PROTECTED' };
  }

  const editableSet = new Set(perms.playerEditableFields);
  if (matchesFieldOrAncestor(fieldPath, editableSet)) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'NOT_AUTHORIZED' };
}

function numericMapDiffers<TKey extends string>(
  current: Record<string, number>,
  patch: Partial<Record<TKey, number | null>>
): boolean {
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const prev = current[k];
    if (v === null) {
      if (prev !== undefined) return true;
    } else if (prev !== v) {
      return true;
    }
  }
  return false;
}

function normalizedCustomResourcesEqual(
  a: Dnd5e2014SheetData['customResources'],
  b: NonNullable<Dnd5e2014SheetPatchOutput['customResources']>
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.name !== y.name ||
      x.maxUses !== y.maxUses ||
      x.recovery !== y.recovery ||
      x.description !== y.description
    ) {
      return false;
    }
  }
  return true;
}

function sameAttackEntry(a: Dnd5e2014AttackEntry, b: Dnd5e2014AttackEntry): boolean {
  return (
    a.id === b.id &&
    a.inventoryItemId === b.inventoryItemId &&
    a.kind === b.kind &&
    a.spellSourceClassId === b.spellSourceClassId &&
    a.name === b.name &&
    a.ability === b.ability &&
    a.abilityOverride === b.abilityOverride &&
    a.proficient === b.proficient &&
    a.proficientOverride === b.proficientOverride &&
    a.bonusOverride === b.bonusOverride &&
    a.attackBonus === b.attackBonus &&
    a.damage === b.damage &&
    a.damageType === b.damageType &&
    a.range === b.range &&
    a.notes === b.notes
  );
}

function canonicalAttackProficiencyAllowed(
  atk: Pick<Dnd5e2014AttackEntry, 'kind'>,
  allowedOfficialAbilities: readonly string[]
): boolean {
  if (atk.kind === 'unarmed') return true;
  if (atk.kind === 'spell') return allowedOfficialAbilities.length > 0;
  return false;
}

function normalizeComparableSourceOverride(
  val: Dnd5e2014SpellcastingSourceOverride | null | undefined
): { abilityOverride: string | null; saveDcOverride: number | null; attackBonusOverride: number | null } | null {
  if (!val) return null;
  const abilityOverride = val.abilityOverride ?? null;
  const saveDcOverride = val.saveDcOverride ?? null;
  const attackBonusOverride = val.attackBonusOverride ?? null;
  if (abilityOverride === null && saveDcOverride === null && attackBonusOverride === null) {
    return null;
  }
  return { abilityOverride, saveDcOverride, attackBonusOverride };
}

function sameSourceOverride(
  prev: Dnd5e2014SpellcastingSourceOverride | undefined,
  next: Dnd5e2014SpellcastingSourceOverride | null
): boolean {
  if (next === null) {
    return normalizeComparableSourceOverride(prev) === null;
  }
  const mergedNext: Dnd5e2014SpellcastingSourceOverride = {
    abilityOverride:
      next.abilityOverride !== undefined ? next.abilityOverride : prev?.abilityOverride ?? null,
    saveDcOverride:
      next.saveDcOverride !== undefined ? next.saveDcOverride : prev?.saveDcOverride ?? null,
    attackBonusOverride:
      next.attackBonusOverride !== undefined
        ? next.attackBonusOverride
        : prev?.attackBonusOverride ?? null,
  };
  const normPrev = normalizeComparableSourceOverride(prev);
  const normNext = normalizeComparableSourceOverride(mergedNext);
  if (!normPrev && !normNext) return true;
  if (!normPrev || !normNext) return false;
  return (
    normPrev.abilityOverride === normNext.abilityOverride &&
    normPrev.saveDcOverride === normNext.saveDcOverride &&
    normPrev.attackBonusOverride === normNext.attackBonusOverride
  );
}

function resolveResultingSpellcastingConfig(
  existing: Dnd5e2014SheetData['spellcasting'],
  patchSc: Dnd5e2014SheetPatchOutput['spellcasting']
): Pick<Dnd5e2014SheetData['spellcasting'], 'abilityOverride' | 'sourceOverrides'> {
  const sourceOverrides: Record<string, Dnd5e2014SpellcastingSourceOverride> = structuredClone(
    existing.sourceOverrides ?? {}
  );
  if (patchSc?.sourceOverrides) {
    for (const [classId, value] of Object.entries(patchSc.sourceOverrides)) {
      if (value === null) {
        delete sourceOverrides[classId];
      } else {
        sourceOverrides[classId] = { ...(sourceOverrides[classId] ?? {}), ...value };
      }
    }
  }
  return {
    abilityOverride:
      patchSc?.abilityOverride !== undefined ? patchSc.abilityOverride : existing.abilityOverride,
    sourceOverrides,
  };
}

/**
 * Extracts all canonical paths touched by a `sheetPatch` during PATCH.
 * - Any field explicitly marked `gmOnly` is always reported when present in the patch
 *   to prevent value-oracle probing.
 * - Protected official-calculation overrides are flagged whenever modified from existing state
 *   (or when marked `gmOnly`), ensuring players cannot alter derived rules values.
 */
export function extractTouchedPathsFromSheetPatch(
  patch: Dnd5e2014SheetPatchOutput,
  existingSheet: Dnd5e2014SheetData,
  perms: NormalizedCharacterFieldPermissions
): string[] {
  const touched = new Set<string>();
  const gmOnlySet = new Set(perms.gmOnlyFields);

  const isGmOnly = (path: string) => matchesFieldOrAncestor(path, gmOnlySet);

  if (patch.generalInfo) {
    for (const key of Object.keys(patch.generalInfo) as Array<keyof typeof patch.generalInfo>) {
      if (patch.generalInfo[key] === undefined) continue;
      if (key === 'name') {
        if (isGmOnly('name') || isGmOnly('generalInfo.name') || patch.generalInfo.name !== existingSheet.generalInfo.name) {
          touched.add('generalInfo.name');
        }
      } else {
        touched.add(`generalInfo.${key}`);
      }
    }
  }

  if (patch.raceAndClass) {
    if (patch.raceAndClass.race !== undefined) touched.add('raceAndClass.race');
    if (patch.raceAndClass.subrace !== undefined) touched.add('raceAndClass.subrace');
    if (patch.raceAndClass.classes !== undefined) touched.add('raceAndClass.classes');
  }

  if (patch.abilities) {
    for (const key of Object.keys(patch.abilities) as Array<keyof typeof patch.abilities>) {
      if (patch.abilities[key] !== undefined) {
        touched.add(`abilities.${key}`);
      }
    }
  }

  if (patch.savingThrows) {
    if (patch.savingThrows.proficient !== undefined) {
      touched.add('savingThrows.proficient');
    }
    if (patch.savingThrows.rollModes !== undefined) {
      touched.add('savingThrows.rollModes');
    }
    if (patch.savingThrows.overrides !== undefined) {
      if (
        isGmOnly('savingThrows.overrides') ||
        numericMapDiffers(existingSheet.savingThrows.overrides, patch.savingThrows.overrides)
      ) {
        touched.add('savingThrows.overrides');
      }
    }
  }

  if (patch.skills) {
    if (patch.skills.proficient !== undefined) touched.add('skills.proficient');
    if (patch.skills.expertise !== undefined) touched.add('skills.expertise');
    if (patch.skills.halfProficient !== undefined) touched.add('skills.halfProficient');
    if (patch.skills.rollModes !== undefined) touched.add('skills.rollModes');
    if (patch.skills.overrides !== undefined) {
      if (
        isGmOnly('skills.overrides') ||
        numericMapDiffers(existingSheet.skills.overrides, patch.skills.overrides)
      ) {
        touched.add('skills.overrides');
      }
    }
  }

  if (patch.proficiencies) {
    for (const key of Object.keys(patch.proficiencies) as Array<keyof typeof patch.proficiencies>) {
      if (patch.proficiencies[key] !== undefined) {
        touched.add(`proficiencies.${key}`);
      }
    }
  }

  if (patch.hitPoints) {
    for (const key of Object.keys(patch.hitPoints) as Array<keyof typeof patch.hitPoints>) {
      if (patch.hitPoints[key] !== undefined) {
        touched.add(`hitPoints.${key}`);
      }
    }
  }

  if (patch.armorClass) {
    if (patch.armorClass.unarmoredFormula !== undefined) {
      touched.add('armorClass.unarmoredFormula');
    }
    if (patch.armorClass.notes !== undefined) {
      touched.add('armorClass.notes');
    }
    if (patch.armorClass.override !== undefined) {
      if (
        isGmOnly('armorClass.override') ||
        patch.armorClass.override !== existingSheet.armorClass.override
      ) {
        touched.add('armorClass.override');
      }
    }
  }

  if (patch.initiative) {
    if (patch.initiative.override !== undefined) {
      if (
        isGmOnly('initiative.override') ||
        patch.initiative.override !== existingSheet.initiative.override
      ) {
        touched.add('initiative.override');
      }
    }
    if (patch.initiative.bonus !== undefined) {
      if (
        isGmOnly('initiative.bonus') ||
        patch.initiative.bonus !== existingSheet.initiative.bonus
      ) {
        touched.add('initiative.bonus');
      }
    }
  }

  if (patch.speed) {
    for (const key of Object.keys(patch.speed) as Array<keyof typeof patch.speed>) {
      if (patch.speed[key] !== undefined) {
        touched.add(`speed.${key}`);
      }
    }
  }

  if (patch.attacks !== undefined) {
    touched.add('attacks');
    const existingById = new Map(existingSheet.attacks.map((a) => [a.id, a]));
    const patchIds = new Set(patch.attacks.map((a) => a.id));
    const existingInvById = new Map(existingSheet.inventory.map((i) => [i.id, i]));
    const resultingClasses = patch.raceAndClass?.classes ?? existingSheet.raceAndClass.classes;
    const resultingInventory = patch.inventory ?? existingSheet.inventory;
    const resultingInvById = new Map(resultingInventory.map((i) => [i.id, i]));
    const resultingSpellcasting = resolveResultingSpellcastingConfig(
      existingSheet.spellcasting,
      patch.spellcasting
    );

    // Deleting an existing `gm_custom` entry requires GM / `attacks.gmCustom` permission
    for (const prev of existingSheet.attacks) {
      if (prev.kind === 'gm_custom' && !patchIds.has(prev.id)) {
        touched.add('attacks.gmCustom');
      }
    }

    for (const atk of patch.attacks) {
      const prev = existingById.get(atk.id);
      if (
        isGmOnly('attacks.bonusOverride') ||
        (prev ? atk.bonusOverride !== prev.bonusOverride : atk.bonusOverride !== null)
      ) {
        touched.add('attacks.bonusOverride');
      }
      if (
        isGmOnly('attacks.attackBonus') ||
        (prev ? atk.attackBonus !== prev.attackBonus : atk.attackBonus !== null)
      ) {
        touched.add('attacks.attackBonus');
      }

      if (
        isGmOnly('attacks.gmCustom') ||
        (atk.kind === 'gm_custom' && (!prev || prev.kind !== 'gm_custom' || !sameAttackEntry(prev, atk))) ||
        (prev && prev.kind === 'gm_custom' && atk.kind !== 'gm_custom')
      ) {
        touched.add('attacks.gmCustom');
      }

      const allowedNow = getAllowedOfficialAttackAbilities(
        atk,
        resultingInvById,
        resultingClasses,
        resultingSpellcasting
      );
      const isIllegalAbilityNow =
        atk.kind !== 'gm_custom' && atk.ability !== null && !allowedNow.includes(atk.ability);

      if (
        isGmOnly('attacks.ability') ||
        (prev ? atk.abilityOverride !== prev.abilityOverride : atk.abilityOverride !== null) ||
        (isIllegalAbilityNow && (!prev || atk.ability !== prev.ability))
      ) {
        touched.add('attacks.ability');
      } else if (prev && prev.kind !== 'gm_custom' && prev.ability !== null) {
        const allowedPrev = getAllowedOfficialAttackAbilities(
          prev,
          existingInvById,
          existingSheet.raceAndClass.classes,
          existingSheet.spellcasting
        );
        if (!allowedPrev.includes(prev.ability) && atk.ability !== prev.ability) {
          touched.add('attacks.ability');
        }
      }

      const canSelfGrantProf = canonicalAttackProficiencyAllowed(atk, allowedNow);
      const unauthorizedProficientFlag = !canSelfGrantProf && atk.proficient === true;
      if (
        isGmOnly('attacks.proficient') ||
        (prev ? atk.proficientOverride !== prev.proficientOverride : atk.proficientOverride !== null) ||
        (unauthorizedProficientFlag && (!prev || atk.proficient !== prev.proficient))
      ) {
        touched.add('attacks.proficient');
      }
    }
  }

  if (patch.inventory !== undefined) {
    touched.add('inventory');
    const existingInvById = new Map(existingSheet.inventory.map((i) => [i.id, i]));
    const resultingClasses = patch.raceAndClass?.classes ?? existingSheet.raceAndClass.classes;

    for (const item of patch.inventory) {
      const prev = existingInvById.get(item.id);
      if (
        isGmOnly('inventory.weaponProficient') ||
        (prev ? item.weaponProficient !== prev.weaponProficient : item.weaponProficient === true)
      ) {
        touched.add('inventory.weaponProficient');
      }

      const allowedNow = getAllowedOfficialWeaponAbilities(item, resultingClasses);
      const isCustomAbilityNow =
        item.weaponAbility !== null && !allowedNow.includes(item.weaponAbility);

      if (
        isGmOnly('inventory.weaponAbilityOverride') ||
        (prev
          ? item.weaponAbilityOverride !== prev.weaponAbilityOverride
          : item.weaponAbilityOverride !== null) ||
        (isCustomAbilityNow && (!prev || item.weaponAbility !== prev.weaponAbility))
      ) {
        touched.add('inventory.weaponAbilityOverride');
      } else if (prev && prev.weaponAbility !== null) {
        const allowedPrev = getAllowedOfficialWeaponAbilities(
          prev,
          existingSheet.raceAndClass.classes
        );
        if (!allowedPrev.includes(prev.weaponAbility) && item.weaponAbility !== prev.weaponAbility) {
          touched.add('inventory.weaponAbilityOverride');
        }
      }
    }
  }

  if (patch.attunement?.limitOverride !== undefined) {
    if (
      isGmOnly('attunement.limitOverride') ||
      patch.attunement.limitOverride !== existingSheet.attunement.limitOverride
    ) {
      touched.add('attunement.limitOverride');
    }
  }

  if (patch.currency) {
    for (const key of Object.keys(patch.currency) as Array<keyof typeof patch.currency>) {
      if (patch.currency[key] !== undefined) {
        touched.add(`currency.${key}`);
      }
    }
  }

  if (patch.traitsAndFeatures !== undefined) touched.add('traitsAndFeatures');

  if (patch.spellcasting) {
    if (patch.spellcasting.usesSpellbook !== undefined) touched.add('spellcasting.usesSpellbook');
    if (patch.spellcasting.notes !== undefined) touched.add('spellcasting.notes');
    if (patch.spellcasting.abilityOverride !== undefined) {
      if (
        isGmOnly('spellcasting.abilityOverride') ||
        patch.spellcasting.abilityOverride !== existingSheet.spellcasting.abilityOverride
      ) {
        touched.add('spellcasting.abilityOverride');
      }
    }
    if (patch.spellcasting.saveDcOverride !== undefined) {
      if (
        isGmOnly('spellcasting.saveDcOverride') ||
        patch.spellcasting.saveDcOverride !== existingSheet.spellcasting.saveDcOverride
      ) {
        touched.add('spellcasting.saveDcOverride');
      }
    }
    if (patch.spellcasting.attackBonusOverride !== undefined) {
      if (
        isGmOnly('spellcasting.attackBonusOverride') ||
        patch.spellcasting.attackBonusOverride !== existingSheet.spellcasting.attackBonusOverride
      ) {
        touched.add('spellcasting.attackBonusOverride');
      }
    }
    if (patch.spellcasting.sourceOverrides !== undefined) {
      const prevOverrides = existingSheet.spellcasting.sourceOverrides ?? {};
      const changed =
        isGmOnly('spellcasting.sourceOverrides') ||
        Object.entries(patch.spellcasting.sourceOverrides).some(
          ([classId, val]) => !sameSourceOverride(prevOverrides[classId], val)
        );
      if (changed) {
        touched.add('spellcasting.sourceOverrides');
      }
    }
  }

  if (patch.spells !== undefined) touched.add('spells');
  if (patch.spellSlotsUsed !== undefined) touched.add('spellSlotsUsed');

  if (patch.spellSlotOverrides !== undefined) {
    if (
      isGmOnly('spellSlotOverrides') ||
      numericMapDiffers(existingSheet.spellSlotOverrides, patch.spellSlotOverrides)
    ) {
      touched.add('spellSlotOverrides');
    }
  }

  if (patch.resourceUsage !== undefined) touched.add('resourceUsage');

  if (patch.customResources !== undefined) {
    if (
      isGmOnly('customResources') ||
      !normalizedCustomResourcesEqual(existingSheet.customResources, patch.customResources)
    ) {
      touched.add('customResources');
    }
  }

  if (patch.progression) {
    for (const key of Object.keys(patch.progression) as Array<keyof typeof patch.progression>) {
      if (patch.progression[key] !== undefined) {
        touched.add(`progression.${key}`);
      }
    }
  }

  if (patch.background) {
    for (const key of Object.keys(patch.background) as Array<keyof typeof patch.background>) {
      if (patch.background[key] !== undefined) {
        touched.add(`background.${key}`);
      }
    }
  }

  return Array.from(touched);
}

/**
 * Checks an initial creation payload (`POST`) for non-empty protected official-calculation
 * overrides so non-GM players cannot smuggle homebrew overrides on character creation.
 */
export function extractProtectedPathsFromCreationPatch(
  patch: Dnd5e2014SheetPatchOutput
): ProtectedOfficialCalculationPath[] {
  const violated: ProtectedOfficialCalculationPath[] = [];

  if (
    patch.savingThrows?.overrides &&
    Object.values(patch.savingThrows.overrides).some((v) => v !== undefined && v !== null)
  ) {
    violated.push('savingThrows.overrides');
  }
  if (
    patch.skills?.overrides &&
    Object.values(patch.skills.overrides).some((v) => v !== undefined && v !== null)
  ) {
    violated.push('skills.overrides');
  }
  if (patch.armorClass?.override !== undefined && patch.armorClass.override !== null) {
    violated.push('armorClass.override');
  }
  if (patch.initiative?.override !== undefined && patch.initiative.override !== null) {
    violated.push('initiative.override');
  }
  if (patch.initiative?.bonus !== undefined && patch.initiative.bonus !== 0) {
    violated.push('initiative.bonus');
  }
  if (patch.attacks?.some((a) => a.bonusOverride !== null)) {
    violated.push('attacks.bonusOverride');
  }
  if (patch.attacks?.some((a) => a.attackBonus !== null)) {
    violated.push('attacks.attackBonus');
  }
  if (patch.attacks?.some((a) => a.kind === 'gm_custom')) {
    violated.push('attacks.gmCustom');
  }
  if (patch.attacks) {
    const classes = patch.raceAndClass?.classes ?? [];
    const invById = new Map((patch.inventory ?? []).map((i) => [i.id, i]));
    const spellConfig = {
      abilityOverride: patch.spellcasting?.abilityOverride ?? null,
      sourceOverrides: (patch.spellcasting?.sourceOverrides ?? {}) as Dnd5e2014SheetData['spellcasting']['sourceOverrides'],
    };

    const hasProtectedAttackAbility = patch.attacks.some((a) => {
      if (a.abilityOverride !== null) return true;
      if (a.kind === 'gm_custom' || a.ability === null) return false;
      const allowed = getAllowedOfficialAttackAbilities(a, invById, classes, spellConfig);
      return !allowed.includes(a.ability);
    });
    if (hasProtectedAttackAbility) {
      violated.push('attacks.ability');
    }

    const hasProtectedAttackProficient = patch.attacks.some((a) => {
      if (a.proficientOverride !== null) return true;
      if (a.proficient !== true) return false;
      const allowed = getAllowedOfficialAttackAbilities(a, invById, classes, spellConfig);
      return !canonicalAttackProficiencyAllowed(a, allowed);
    });
    if (hasProtectedAttackProficient) {
      violated.push('attacks.proficient');
    }
  }
  if (patch.inventory?.some((i) => i.weaponProficient === true)) {
    violated.push('inventory.weaponProficient');
  }
  if (patch.inventory) {
    const classes = patch.raceAndClass?.classes ?? [];
    const hasCustomWeaponAbility = patch.inventory.some(
      (i) =>
        i.weaponAbilityOverride !== null ||
        (i.weaponAbility !== null &&
          !getAllowedOfficialWeaponAbilities(i, classes).includes(i.weaponAbility))
    );
    if (hasCustomWeaponAbility) {
      violated.push('inventory.weaponAbilityOverride');
    }
  }
  if (
    patch.attunement?.limitOverride !== undefined &&
    patch.attunement.limitOverride !== null
  ) {
    violated.push('attunement.limitOverride');
  }
  if (
    patch.spellcasting?.abilityOverride !== undefined &&
    patch.spellcasting.abilityOverride !== null
  ) {
    violated.push('spellcasting.abilityOverride');
  }
  if (
    patch.spellcasting?.saveDcOverride !== undefined &&
    patch.spellcasting.saveDcOverride !== null
  ) {
    violated.push('spellcasting.saveDcOverride');
  }
  if (
    patch.spellcasting?.attackBonusOverride !== undefined &&
    patch.spellcasting.attackBonusOverride !== null
  ) {
    violated.push('spellcasting.attackBonusOverride');
  }
  if (
    patch.spellcasting?.sourceOverrides &&
    Object.values(patch.spellcasting.sourceOverrides).some(
      (v) => normalizeComparableSourceOverride(v) !== null
    )
  ) {
    violated.push('spellcasting.sourceOverrides');
  }
  if (
    patch.spellSlotOverrides &&
    Object.values(patch.spellSlotOverrides).some((v) => v !== undefined && v !== null)
  ) {
    violated.push('spellSlotOverrides');
  }
  if (patch.customResources && patch.customResources.length > 0) {
    violated.push('customResources');
  }

  return violated;
}
