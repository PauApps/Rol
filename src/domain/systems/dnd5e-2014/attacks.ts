import {
  MAX_OFFICIAL_LEVEL_2014,
  MIN_OFFICIAL_LEVEL_2014,
  lookupCoreWeapon,
  normalizeMatchText,
  resolveEffectiveClassSpellcasting,
  type AbilityKey,
  type CoreWeaponCatalogEntry,
} from './catalog';
import type {
  AttackEntryKind,
  Dnd5e2014AttackEntry,
  Dnd5e2014ClassEntry,
  Dnd5e2014InventoryItem,
  Dnd5e2014SheetData,
} from './schema';

export type WeaponProficiencySource =
  | 'character_proficiencies'
  | 'unarmed_official'
  | 'spellcasting_official'
  | 'gm_exception'
  | 'none';

export interface AttackSpellcastingSourceContext {
  classId: string;
  ability: AbilityKey | null;
  attackBonus: number | null;
}

export interface AttackSpellcastingContext {
  ability: AbilityKey | null;
  attackBonus: number | null;
  sources: readonly AttackSpellcastingSourceContext[];
}

export interface ComputedAttack {
  id: string;
  source: 'equipped_weapon' | 'manual';
  attackKind: 'weapon' | AttackEntryKind;
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

/**
 * Determines which ability score(s) are officially legal for a manual or linked attack entry
 * according to its `kind` (`weapon_override`, `unarmed`, `spell`, `special`, `gm_custom`).
 */
export function getAllowedOfficialAttackAbilities(
  atk: Pick<Dnd5e2014AttackEntry, 'kind' | 'inventoryItemId' | 'spellSourceClassId'>,
  inventoryById: ReadonlyMap<string, Dnd5e2014InventoryItem>,
  classes: readonly Dnd5e2014ClassEntry[],
  spellcastingConfig: Pick<
    Dnd5e2014SheetData['spellcasting'],
    'abilityOverride' | 'sourceOverrides'
  >
): AbilityKey[] {
  if (atk.kind === 'weapon_override') {
    if (!atk.inventoryItemId) return [];
    const linkedWeapon = inventoryById.get(atk.inventoryItemId);
    if (!linkedWeapon || linkedWeapon.category !== 'weapon') {
      return [];
    }
    return getAllowedOfficialWeaponAbilities(linkedWeapon, classes);
  }

  if (atk.kind === 'unarmed') {
    const hasMonkClass = classes.some((c) => c.classId === 'monk');
    return hasMonkClass ? ['str', 'dex'] : ['str'];
  }

  if (atk.kind === 'spell') {
    const activeSources: Array<{ classId: string; ability: AbilityKey | null }> = [];
    for (const cls of classes) {
      const level = Math.min(
        MAX_OFFICIAL_LEVEL_2014,
        Math.max(MIN_OFFICIAL_LEVEL_2014, Math.floor(cls.level))
      );
      const resolved = resolveEffectiveClassSpellcasting(cls.classId, cls.subclassId, level);
      if (!resolved.isActiveCaster) continue;
      const effectiveAbility =
        spellcastingConfig.sourceOverrides?.[cls.classId]?.abilityOverride ??
        spellcastingConfig.abilityOverride ??
        resolved.ability;
      activeSources.push({ classId: cls.classId, ability: effectiveAbility });
    }

    if (atk.spellSourceClassId) {
      const matching = activeSources.find((s) => s.classId === atk.spellSourceClassId);
      return matching?.ability ? [matching.ability] : [];
    }

    const abilities = new Set<AbilityKey>();
    for (const src of activeSources) {
      if (src.ability) abilities.add(src.ability);
    }
    if (abilities.size === 0 && spellcastingConfig.abilityOverride) {
      abilities.add(spellcastingConfig.abilityOverride);
    }
    return Array.from(abilities);
  }

  // `special` and `gm_custom` never authorize self-selected official ability scores
  return [];
}

function resolveFallbackSpellcastingContext(
  sheet: Dnd5e2014SheetData,
  abilityMods: Record<AbilityKey, number | null>,
  proficiencyBonus: number
): AttackSpellcastingContext {
  const sources: AttackSpellcastingSourceContext[] = [];
  for (const cls of sheet.raceAndClass.classes) {
    const level = Math.min(
      MAX_OFFICIAL_LEVEL_2014,
      Math.max(MIN_OFFICIAL_LEVEL_2014, Math.floor(cls.level))
    );
    const resolved = resolveEffectiveClassSpellcasting(cls.classId, cls.subclassId, level);
    if (!resolved.isActiveCaster) continue;

    const srcOverride = sheet.spellcasting.sourceOverrides?.[cls.classId];
    const effectiveAbility =
      srcOverride?.abilityOverride ?? sheet.spellcasting.abilityOverride ?? resolved.ability;
    const abilityMod = effectiveAbility ? (abilityMods[effectiveAbility] ?? 0) : 0;
    const attackBonus =
      srcOverride?.attackBonusOverride !== undefined && srcOverride.attackBonusOverride !== null
        ? srcOverride.attackBonusOverride
        : sheet.spellcasting.attackBonusOverride !== null
          ? sheet.spellcasting.attackBonusOverride
          : effectiveAbility
            ? proficiencyBonus + abilityMod
            : null;

    sources.push({
      classId: cls.classId,
      ability: effectiveAbility,
      attackBonus,
    });
  }

  const primary = sources[0];
  const fallbackAbility = primary?.ability ?? sheet.spellcasting.abilityOverride ?? null;
  const fallbackMod = fallbackAbility ? (abilityMods[fallbackAbility] ?? 0) : 0;
  const fallbackAttackBonus =
    primary?.attackBonus ??
    (sheet.spellcasting.attackBonusOverride !== null
      ? sheet.spellcasting.attackBonusOverride
      : fallbackAbility
        ? proficiencyBonus + fallbackMod
        : null);

  return {
    ability: fallbackAbility,
    attackBonus: fallbackAttackBonus,
    sources,
  };
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
 * Computes all active character attacks safely and without duplication:
 * - Equipped inventory weapons (`category === 'weapon' && equipped === true`) derive
 *   their attack from official rules + optional GM overrides, never trusting illegal
 *   `linked.ability`, `item.weaponAbility`, or `linked.proficient`.
 * - Unequipped weapons never appear in active attacks.
 * - Manual `sheet.attacks` entries (`inventoryItemId === null`) resolve rules strictly
 *   by `kind`: `unarmed`, `spell`, `special`, or GM-only `gm_custom`.
 */
export function computeAttacks(
  sheet: Dnd5e2014SheetData,
  abilityMods: Record<AbilityKey, number | null>,
  proficiencyBonus: number,
  spellcastingContext?: AttackSpellcastingContext | null
): ComputedAttack[] {
  const results: ComputedAttack[] = [];
  const inventoryById = new Map<string, Dnd5e2014InventoryItem>();
  for (const item of sheet.inventory) {
    inventoryById.set(item.id, item);
  }

  const linkedAttackByItemId = new Map<string, Dnd5e2014AttackEntry>();
  for (const atk of sheet.attacks) {
    if (atk.inventoryItemId && !linkedAttackByItemId.has(atk.inventoryItemId)) {
      linkedAttackByItemId.set(atk.inventoryItemId, atk);
    }
  }

  const effectiveSpellContext =
    spellcastingContext !== undefined
      ? spellcastingContext
      : resolveFallbackSpellcastingContext(sheet, abilityMods, proficiencyBonus);

  // 1. Equipped physical inventory weapons
  for (const item of sheet.inventory) {
    if (item.category !== 'weapon' || !item.equipped) {
      continue;
    }

    const linked = linkedAttackByItemId.get(item.id);
    const allowedOfficial = getAllowedOfficialWeaponAbilities(item, sheet.raceAndClass.classes);

    const gmAbilityOverride = item.weaponAbilityOverride ?? linked?.abilityOverride ?? null;
    let selectedAbility: AbilityKey;
    let isAbilityOverridden = false;

    if (gmAbilityOverride !== null) {
      selectedAbility = gmAbilityOverride;
      isAbilityOverridden = !allowedOfficial.includes(gmAbilityOverride);
    } else if (item.weaponAbility !== null && allowedOfficial.includes(item.weaponAbility)) {
      selectedAbility = item.weaponAbility;
    } else if (
      linked?.ability !== null &&
      linked?.ability !== undefined &&
      allowedOfficial.includes(linked.ability)
    ) {
      selectedAbility = linked.ability;
    } else {
      selectedAbility = selectAutoAbility(allowedOfficial, abilityMods);
    }

    const profResult =
      linked?.proficientOverride !== null && linked?.proficientOverride !== undefined
        ? { proficient: linked.proficientOverride, source: 'gm_exception' as const }
        : resolveWeaponProficiency(item, sheet);

    const abilityMod = abilityMods[selectedAbility] ?? 0;
    const proficiencyApplied = profResult.proficient ? proficiencyBonus : 0;
    const bonusOverride = linked?.bonusOverride ?? null;
    const totalBonus =
      bonusOverride !== null ? bonusOverride : abilityMod + proficiencyApplied;
    const attackBonusDisplay = linked?.attackBonus ?? formatSignedBonus(totalBonus);

    results.push({
      id: linked?.id ?? `weapon:${item.id}`,
      source: 'equipped_weapon',
      attackKind: 'weapon',
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
      properties: item.weaponProperties ?? '',
      notes: linked?.notes || item.notes,
    });
  }

  // 2. Manual entries (`inventoryItemId === null`) resolved strictly by `kind`
  for (const atk of sheet.attacks) {
    if (atk.inventoryItemId !== null) {
      continue;
    }

    const allowedOfficial = getAllowedOfficialAttackAbilities(
      atk,
      inventoryById,
      sheet.raceAndClass.classes,
      sheet.spellcasting
    );
    const bonusOverride = atk.bonusOverride ?? null;

    let selectedAbility: AbilityKey | null = null;
    let isAbilityOverridden = false;
    let proficient = false;
    let proficiencySource: WeaponProficiencySource = 'none';
    let totalBonus: number | null = null;

    if (atk.kind === 'unarmed') {
      if (atk.abilityOverride !== null) {
        selectedAbility = atk.abilityOverride;
        isAbilityOverridden = !allowedOfficial.includes(atk.abilityOverride);
      } else if (atk.ability !== null && allowedOfficial.includes(atk.ability)) {
        selectedAbility = atk.ability;
      } else {
        selectedAbility = selectAutoAbility(allowedOfficial, abilityMods);
      }

      if (atk.proficientOverride !== null) {
        proficient = atk.proficientOverride;
        proficiencySource = 'gm_exception';
      } else {
        // PHB 2014 p. 195 Errata: every creature is proficient with unarmed strikes
        proficient = true;
        proficiencySource = 'unarmed_official';
      }
    } else if (atk.kind === 'spell') {
      const sources = effectiveSpellContext?.sources ?? [];
      const matchedSource = atk.spellSourceClassId
        ? sources.find((s) => s.classId === atk.spellSourceClassId)
        : atk.ability !== null
          ? sources.find((s) => s.ability === atk.ability) ?? sources[0]
          : sources[0];

      if (atk.abilityOverride !== null) {
        selectedAbility = atk.abilityOverride;
        isAbilityOverridden = !allowedOfficial.includes(atk.abilityOverride);
      } else if (matchedSource) {
        selectedAbility = matchedSource.ability;
      } else if (!atk.spellSourceClassId && effectiveSpellContext?.ability) {
        selectedAbility = effectiveSpellContext.ability;
      }

      if (atk.proficientOverride !== null) {
        proficient = atk.proficientOverride;
        proficiencySource = 'gm_exception';
      } else if (selectedAbility !== null) {
        proficient = true;
        proficiencySource = 'spellcasting_official';
      }

      const abilityMod = selectedAbility ? (abilityMods[selectedAbility] ?? 0) : 0;
      const proficiencyApplied = proficient ? proficiencyBonus : 0;

      if (bonusOverride !== null) {
        totalBonus = bonusOverride;
      } else if (atk.abilityOverride === null && atk.proficientOverride === null) {
        if (matchedSource && matchedSource.attackBonus !== null) {
          totalBonus = matchedSource.attackBonus;
        } else if (
          !matchedSource &&
          !atk.spellSourceClassId &&
          effectiveSpellContext?.attackBonus !== null &&
          effectiveSpellContext?.attackBonus !== undefined
        ) {
          totalBonus = effectiveSpellContext.attackBonus;
        } else if (selectedAbility !== null) {
          totalBonus = abilityMod + proficiencyApplied;
        }
      } else if (selectedAbility !== null) {
        totalBonus = abilityMod + proficiencyApplied;
      } else if (proficient) {
        totalBonus = proficiencyBonus;
      }
    } else if (atk.kind === 'special') {
      // Non-weapon, non-spell special attacks never let players self-grant ability or proficiency
      if (atk.abilityOverride !== null) {
        selectedAbility = atk.abilityOverride;
        isAbilityOverridden = true;
      }
      if (atk.proficientOverride === true) {
        proficient = true;
        proficiencySource = 'gm_exception';
      }
    } else if (atk.kind === 'gm_custom') {
      selectedAbility = atk.abilityOverride ?? atk.ability;
      isAbilityOverridden = selectedAbility !== null;
      const gmProficient = atk.proficientOverride ?? atk.proficient;
      proficient = Boolean(gmProficient);
      proficiencySource = proficient ? 'gm_exception' : 'none';
    }

    const abilityMod = selectedAbility ? (abilityMods[selectedAbility] ?? 0) : 0;
    const proficiencyApplied = proficient ? proficiencyBonus : 0;

    if (atk.kind !== 'spell') {
      totalBonus =
        bonusOverride !== null
          ? bonusOverride
          : selectedAbility !== null
            ? abilityMod + proficiencyApplied
            : proficient
              ? proficiencyBonus
              : null;
    }

    const attackBonusDisplay =
      atk.attackBonus ?? (totalBonus !== null ? formatSignedBonus(totalBonus) : null);

    results.push({
      id: atk.id,
      source: 'manual',
      attackKind: atk.kind,
      inventoryItemId: null,
      name: atk.name,
      ability: selectedAbility,
      allowedOfficialAbilities: allowedOfficial,
      isAbilityOverridden,
      proficient,
      proficiencySource,
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
