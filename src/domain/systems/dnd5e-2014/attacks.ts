import {
  lookupCoreWeapon,
  normalizeMatchText,
  type AbilityKey,
  type CoreWeaponCatalogEntry,
} from './catalog';
import type {
  Dnd5e2014AttackEntry,
  Dnd5e2014ClassEntry,
  Dnd5e2014InventoryItem,
  Dnd5e2014SheetData,
} from './schema';

export type WeaponProficiencySource =
  | 'character_proficiencies'
  | 'gm_exception'
  | 'manual_entry'
  | 'none';

export interface ComputedAttack {
  id: string;
  source: 'equipped_weapon' | 'manual';
  inventoryItemId: string | null;
  name: string;
  ability: AbilityKey | null;
  allowedOfficialAbilities: AbilityKey[];
  isAbilityOverridden: boolean;
  proficient: boolean;
  proficiencySource: WeaponProficiencySource;
  abilityMod: number;
  proficiencyApplied: number;
  bonusOverride: number | null;
  attackBonus: number | null;
  attackBonusDisplay: string | null;
  damage: string | null;
  damageType: string | null;
  range: string | null;
  properties: string;
  notes: string;
}

function formatSignedBonus(val: number): string {
  return val >= 0 ? `+${val}` : `${val}`;
}

function isMonkWeapon(
  coreWeapon: CoreWeaponCatalogEntry | undefined,
  normalizedProps: string
): boolean {
  if (normalizedProps.includes('arma de monjo') || normalizedProps.includes('monk weapon')) {
    return true;
  }
  if (!coreWeapon) return false;
  if (coreWeapon.id === 'shortsword') return true;
  return (
    coreWeapon.category === 'simple' &&
    coreWeapon.style === 'melee' &&
    !coreWeapon.heavy &&
    !coreWeapon.twoHanded
  );
}

/**
 * Determines which ability score(s) are officially legal for an inventory weapon under
 * D&D 5e (2014) PHB rules:
 * - Melee weapon: `['str']` (even if thrown, e.g. javelin/handaxe).
 * - Ranged weapon: `['dex']`.
 * - Finesse weapon (melee or dart) or eligible Monk Martial Arts weapon: `['str', 'dex']`.
 */
export function getAllowedOfficialWeaponAbilities(
  item: Pick<Dnd5e2014InventoryItem, 'name' | 'weaponProperties' | 'weaponRange'>,
  classes: readonly Dnd5e2014ClassEntry[]
): AbilityKey[] {
  const coreWeapon = lookupCoreWeapon(item.name);
  const propsNorm = normalizeMatchText(item.weaponProperties ?? '');
  const rangeNorm = normalizeMatchText(item.weaponRange ?? '');

  const hasFinesse =
    Boolean(coreWeapon?.finesse) || propsNorm.includes('finesse') || propsNorm.includes('sutil');

  const hasMonkClass = classes.some((c) => c.classId === 'monk');
  if (hasFinesse || (hasMonkClass && isMonkWeapon(coreWeapon, propsNorm))) {
    return ['str', 'dex'];
  }

  const explicitlyRanged =
    coreWeapon?.style === 'ranged' ||
    (!coreWeapon &&
      (propsNorm.includes('distancia') ||
        propsNorm.includes('ranged') ||
        propsNorm.includes('municio') ||
        propsNorm.includes('ammunition') ||
        rangeNorm.includes('m /') ||
        rangeNorm.includes('/')));

  if (explicitlyRanged) {
    return ['dex'];
  }

  return ['str'];
}

function matchesBlanketCategory(
  profNorm: string,
  category: 'simple' | 'martial',
  style: 'melee' | 'ranged'
): boolean {
  if (
    profNorm === 'totes' ||
    profNorm === 'totes les armes' ||
    profNorm === 'all weapons'
  ) {
    return true;
  }

  if (category === 'simple') {
    if (
      profNorm === 'senzilles' ||
      profNorm === 'armes senzilles' ||
      profNorm === 'simples' ||
      profNorm === 'armes simples' ||
      profNorm === 'simple' ||
      profNorm === 'simple weapons'
    ) {
      return true;
    }
    if (
      style === 'melee' &&
      (profNorm.includes('senzilles cos a cos') || profNorm.includes('simple melee'))
    ) {
      return true;
    }
    if (
      style === 'ranged' &&
      (profNorm.includes('senzilles a distancia') || profNorm.includes('simple ranged'))
    ) {
      return true;
    }
  }

  if (category === 'martial') {
    if (
      profNorm === 'marcials' ||
      profNorm === 'armes marcials' ||
      profNorm === 'martial' ||
      profNorm === 'martial weapons'
    ) {
      return true;
    }
    if (
      style === 'melee' &&
      (profNorm.includes('marcials cos a cos') || profNorm.includes('martial melee'))
    ) {
      return true;
    }
    if (
      style === 'ranged' &&
      (profNorm.includes('marcials a distancia') || profNorm.includes('martial ranged'))
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Resolves weapon proficiency strictly from `sheet.proficiencies.weapons`.
 * `item.weaponProficient === true` acts exclusively as a GM-controlled exception.
 */
export function resolveWeaponProficiency(
  item: Pick<Dnd5e2014InventoryItem, 'name' | 'weaponProperties' | 'weaponProficient'>,
  sheet: Pick<Dnd5e2014SheetData, 'proficiencies'>
): { proficient: boolean; source: WeaponProficiencySource } {
  const weaponProfs = sheet.proficiencies.weapons ?? [];
  const coreWeapon = lookupCoreWeapon(item.name);
  const itemNameNorm = normalizeMatchText(item.name);
  const propsNorm = normalizeMatchText(item.weaponProperties ?? '');

  const inferredCategory: 'simple' | 'martial' | null =
    coreWeapon?.category ??
    (propsNorm.includes('marcial') || propsNorm.includes('martial')
      ? 'martial'
      : propsNorm.includes('senzill') || propsNorm.includes('simple')
        ? 'simple'
        : null);

  const inferredStyle: 'melee' | 'ranged' =
    coreWeapon?.style ??
    (propsNorm.includes('distancia') || propsNorm.includes('ranged') ? 'ranged' : 'melee');

  for (const rawProf of weaponProfs) {
    const profNorm = normalizeMatchText(rawProf);
    if (!profNorm) continue;

    if (
      itemNameNorm === profNorm ||
      (!coreWeapon && itemNameNorm.includes(profNorm))
    ) {
      return { proficient: true, source: 'character_proficiencies' };
    }

    if (coreWeapon) {
      const aliasMatched = coreWeapon.aliases.some((alias) => {
        const aliasNorm = normalizeMatchText(alias);
        return profNorm === aliasNorm || profNorm.includes(aliasNorm);
      });
      if (aliasMatched) {
        return { proficient: true, source: 'character_proficiencies' };
      }
    }

    if (inferredCategory && matchesBlanketCategory(profNorm, inferredCategory, inferredStyle)) {
      return { proficient: true, source: 'character_proficiencies' };
    }
  }

  if (item.weaponProficient) {
    return { proficient: true, source: 'gm_exception' };
  }

  return { proficient: false, source: 'none' };
}

function selectAutoAbility(
  allowedOfficial: AbilityKey[],
  abilityMods: Record<AbilityKey, number | null>
): AbilityKey {
  if (allowedOfficial.length <= 1) {
    return allowedOfficial[0] ?? 'str';
  }
  const strMod = abilityMods.str ?? 0;
  const dexMod = abilityMods.dex ?? 0;
  return dexMod >= strMod ? 'dex' : 'str';
}

/**
 * Computes all active character attacks without duplicating physical weapons:
 * - Equipped inventory weapons (`category === 'weapon' && equipped === true`) automatically
 *   produce calculated attacks, optionally enriched with notes/GM override from a matching
 *   `sheet.attacks` entry linked via `inventoryItemId`.
 * - Unequipped weapons never appear in active attacks.
 * - Manual `sheet.attacks` entries (`inventoryItemId === null`) cover unarmed strikes,
 *   cantrips, special abilities, and GM overrides.
 */
export function computeAttacks(
  sheet: Dnd5e2014SheetData,
  abilityMods: Record<AbilityKey, number | null>,
  proficiencyBonus: number
): ComputedAttack[] {
  const results: ComputedAttack[] = [];
  const linkedAttackByItemId = new Map<string, Dnd5e2014AttackEntry>();

  for (const atk of sheet.attacks) {
    if (atk.inventoryItemId && !linkedAttackByItemId.has(atk.inventoryItemId)) {
      linkedAttackByItemId.set(atk.inventoryItemId, atk);
    }
  }

  for (const item of sheet.inventory) {
    if (item.category !== 'weapon' || !item.equipped) {
      continue;
    }

    const linked = linkedAttackByItemId.get(item.id);
    const allowedOfficial = getAllowedOfficialWeaponAbilities(item, sheet.raceAndClass.classes);
    const selectedAbility =
      item.weaponAbility ?? linked?.ability ?? selectAutoAbility(allowedOfficial, abilityMods);
    const isAbilityOverridden = !allowedOfficial.includes(selectedAbility);

    const profResult = resolveWeaponProficiency(item, sheet);
    const abilityMod = abilityMods[selectedAbility] ?? 0;
    const proficiencyApplied = profResult.proficient ? proficiencyBonus : 0;
    const bonusOverride = linked?.bonusOverride ?? null;

    const totalBonus =
      bonusOverride !== null ? bonusOverride : abilityMod + proficiencyApplied;

    const attackBonusDisplay =
      linked?.attackBonus ?? formatSignedBonus(totalBonus);

    results.push({
      id: linked?.id ?? `weapon:${item.id}`,
      source: 'equipped_weapon',
      inventoryItemId: item.id,
      name: item.name,
      ability: selectedAbility,
      allowedOfficialAbilities: allowedOfficial,
      isAbilityOverridden,
      proficient: profResult.proficient,
      proficiencySource: profResult.source,
      abilityMod,
      proficiencyApplied,
      bonusOverride,
      attackBonus: totalBonus,
      attackBonusDisplay,
      damage: item.damage ?? linked?.damage ?? null,
      damageType: item.damageType ?? linked?.damageType ?? null,
      range: item.weaponRange ?? linked?.range ?? null,
      properties: item.weaponProperties,
      notes: linked?.notes || item.notes,
    });
  }

  for (const atk of sheet.attacks) {
    if (atk.inventoryItemId !== null) {
      // Linked entries only render via equipped inventory items (prevents duplication and keeps unequipped weapons hidden)
      continue;
    }

    const abilityMod = atk.ability ? (abilityMods[atk.ability] ?? 0) : 0;
    const proficiencyApplied = atk.proficient ? proficiencyBonus : 0;
    const bonusOverride = atk.bonusOverride ?? null;

    const totalBonus =
      bonusOverride !== null
        ? bonusOverride
        : atk.ability !== null
          ? abilityMod + proficiencyApplied
          : atk.proficient
            ? proficiencyBonus
            : null;

    const attackBonusDisplay =
      atk.attackBonus ?? (totalBonus !== null ? formatSignedBonus(totalBonus) : null);

    results.push({
      id: atk.id,
      source: 'manual',
      inventoryItemId: null,
      name: atk.name,
      ability: atk.ability,
      allowedOfficialAbilities: atk.ability ? [atk.ability] : [],
      isAbilityOverridden: false,
      proficient: atk.proficient,
      proficiencySource: atk.proficient ? 'manual_entry' : 'none',
      abilityMod,
      proficiencyApplied,
      bonusOverride,
      attackBonus: totalBonus,
      attackBonusDisplay,
      damage: atk.damage,
      damageType: atk.damageType,
      range: atk.range,
      properties: '',
      notes: atk.notes,
    });
  }

  return results;
}
