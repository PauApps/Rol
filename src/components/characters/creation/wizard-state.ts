import type { CampaignCreationConfig } from '@/domain/campaigns/creation-config';
import {
  ABILITY_KEYS,
  ABILITY_LABELS_CA,
  DND5E_CLASSES,
  DND5E_SKILLS,
  DND5E_SUBCLASSES,
  STANDARD_ARRAY_2014,
  buildEmptySheetFromPatch,
  calculatePointBuyCost,
  calculateStartingHitPoints,
  computeDnd5e2014Sheet,
  computeFixedRacialBonuses,
  getBackgroundEntry,
  getClassCreationRule,
  getClassEntry,
  getRaceEntry,
  getSubclassEntry,
  getSubraceEntry,
  type AbilityKey,
  type ComputedDnd5e2014Snapshot,
  type Dnd5e2014AbilityScores,
  type Dnd5e2014InventoryItem,
  type Dnd5e2014SheetData,
  type Dnd5e2014SheetPatchInput,
  type Dnd5e2014SpellEntry,
  type Dnd5e2014TraitEntry,
  type RolledAbilityResult,
  type SkillId,
  type StartingItemTemplate,
  DND5E_FIGHTING_STYLES,
} from '@/domain/systems/dnd5e-2014';

export type WizardStepId = 1 | 2 | 3 | 4 | 5 | 6;

export const WIZARD_STEPS: ReadonlyArray<{
  id: WizardStepId;
  title: string;
  short: string;
}> = [
  { id: 1, title: 'Identitat', short: 'Identitat' },
  { id: 2, title: 'Característiques', short: 'Atributs' },
  { id: 3, title: 'Trasfons i competències', short: 'Competències' },
  { id: 4, title: 'Classe i capacitats', short: 'Classe' },
  { id: 5, title: 'Equipament inicial', short: 'Equipament' },
  { id: 6, title: 'Revisió i creació', short: 'Revisió' },
] as const;

export interface CharacterWizardState {
  name: string;
  memberId: string | null;
  raceMode: 'catalog' | 'custom';
  raceId: string;
  subraceId: string;
  customRace: string;
  customSubrace: string;
  classMode: 'official' | 'custom';
  classId: string;
  subclassId: string;
  customClassName: string;
  customSubclassName: string;
  level: number;
  alignment: string;
  appearanceNotes: string;
  backstory: string;

  baseAbilities: Record<AbilityKey, number | null>;
  rolledPool: RolledAbilityResult[];
  flexibleRacialAbilities: AbilityKey[];

  backgroundMode: 'catalog' | 'custom';
  backgroundId: string;
  customBackground: string;
  classSkills: SkillId[];
  racialExtraSkills: SkillId[];
  extraLanguages: string[];
  extraArmorProfs: string[];
  extraWeaponProfs: string[];
  extraToolProfs: string[];

  fightingStyleId: string | null;
  hpMode: 'official_average' | 'custom';
  customHpMax: number | null;
  initialSpells: Dnd5e2014SpellEntry[];

  equipmentSelections: Record<string, string>;
  starterInventory: Dnd5e2014InventoryItem[];
  customInventory: Dnd5e2014InventoryItem[];
  startingGoldOverride: number | null;
}

function defaultBaseAbilities(method: CampaignCreationConfig['abilityScoreMethod']): Record<AbilityKey, number | null> {
  if (method === 'standard_array') {
    return {
      str: STANDARD_ARRAY_2014[0],
      dex: STANDARD_ARRAY_2014[1],
      con: STANDARD_ARRAY_2014[2],
      int: STANDARD_ARRAY_2014[3],
      wis: STANDARD_ARRAY_2014[4],
      cha: STANDARD_ARRAY_2014[5],
    };
  }
  if (method === 'point_buy') {
    return { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
  }
  if (method === 'rolled_4d6_drop_lowest' || method === 'manual_gm') {
    return { str: null, dex: null, con: null, int: null, wis: null, cha: null };
  }
  return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
}

function templateToInventoryItem(id: string, tpl: StartingItemTemplate): Dnd5e2014InventoryItem {
  return {
    id,
    name: tpl.name,
    category: tpl.category,
    quantity: tpl.quantity,
    weight: tpl.weight,
    equipped: Boolean(tpl.equipped),
    armorType: tpl.armorType ?? null,
    baseAc: tpl.baseAc ?? null,
    acBonus: tpl.acBonus ?? null,
    requiresAttunement: false,
    attuned: false,
    weaponAbility: null,
    weaponAbilityOverride: null,
    weaponProficient: false,
    damage: tpl.damage ?? null,
    damageType: tpl.damageType ?? null,
    weaponRange: tpl.weaponRange ?? null,
    weaponProperties: tpl.weaponProperties ?? '',
    notes: tpl.notes ?? '',
  };
}

export function buildDefaultEquipmentSelections(classId: string): Record<string, string> {
  const rule = getClassCreationRule(classId);
  if (!rule) return {};
  const map: Record<string, string> = {};
  for (const grp of rule.startingEquipmentChoices) {
    if (grp.options[0]) {
      map[grp.id] = grp.options[0].id;
    }
  }
  return map;
}

export function buildStarterInventoryList(params: {
  classId: string;
  classMode: 'official' | 'custom';
  equipmentSelections: Record<string, string>;
  backgroundId: string;
  backgroundMode: 'catalog' | 'custom';
  previousStarter?: readonly Dnd5e2014InventoryItem[];
}): Dnd5e2014InventoryItem[] {
  const prevById = new Map((params.previousStarter ?? []).map((item) => [item.id, item]));
  const items: Dnd5e2014InventoryItem[] = [];

  if (params.classMode === 'official') {
    const rule = getClassCreationRule(params.classId);
    if (rule) {
      for (const grp of rule.startingEquipmentChoices) {
        const chosenId = params.equipmentSelections[grp.id] ?? grp.options[0]?.id;
        const opt = grp.options.find((o) => o.id === chosenId) ?? grp.options[0];
        if (!opt) continue;
        opt.items.forEach((tpl, idx) => {
          const id = `init-choice-${grp.id}-${opt.id}-${idx}`;
          const prev = prevById.get(id);
          const item = templateToInventoryItem(id, tpl);
          if (prev) item.equipped = prev.equipped;
          items.push(item);
        });
      }
      rule.fixedEquipment.forEach((tpl, idx) => {
        const id = `init-fixed-${params.classId}-${idx}`;
        const prev = prevById.get(id);
        const item = templateToInventoryItem(id, tpl);
        if (prev) item.equipped = prev.equipped;
        items.push(item);
      });
    }
  }

  if (params.backgroundMode === 'catalog') {
    const bg = getBackgroundEntry(params.backgroundId);
    if (bg) {
      bg.startingEquipment.forEach((tpl, idx) => {
        const id = `init-bg-${bg.id}-${idx}`;
        const prev = prevById.get(id);
        const item = templateToInventoryItem(id, tpl);
        if (prev) item.equipped = prev.equipped;
        items.push(item);
      });
    }
  }

  return items;
}

export function createInitialWizardState(config: CampaignCreationConfig): CharacterWizardState {
  const firstAllowedRace =
    config.allowedRaces.length > 0 ? getRaceEntry(config.allowedRaces[0]) : undefined;
  const raceId = firstAllowedRace?.id ?? 'human';
  const raceObj = getRaceEntry(raceId);
  const subraceId = raceObj?.subraces[0]?.id ?? '';

  const firstAllowedClass =
    config.allowedClasses.length > 0
      ? DND5E_CLASSES.find(
          (c) =>
            c.id === config.allowedClasses[0].toLowerCase() ||
            c.labelCa.toLowerCase().includes(config.allowedClasses[0].toLowerCase())
        )
      : undefined;
  const classId = firstAllowedClass?.id ?? 'fighter';

  const firstAllowedBg =
    config.allowedBackgrounds.length > 0
      ? getBackgroundEntry(config.allowedBackgrounds[0])
      : undefined;
  const backgroundId = firstAllowedBg?.id ?? 'soldier';

  const equipmentSelections = buildDefaultEquipmentSelections(classId);
  const starterInventory = buildStarterInventoryList({
    classId,
    classMode: 'official',
    equipmentSelections,
    backgroundId,
    backgroundMode: 'catalog',
  });

  const startingSubclasses = DND5E_SUBCLASSES.filter((s) => s.classId === classId);
  const classMeta = getClassEntry(classId);
  const subclassId =
    classMeta && config.startingLevel >= classMeta.subclassLevel
      ? (startingSubclasses[0]?.id ?? '')
      : '';

  return {
    name: '',
    memberId: null,
    raceMode: 'catalog',
    raceId,
    subraceId,
    customRace: '',
    customSubrace: '',
    classMode: 'official',
    classId,
    subclassId,
    customClassName: '',
    customSubclassName: '',
    level: config.startingLevel,
    alignment: '',
    appearanceNotes: '',
    backstory: '',

    baseAbilities: defaultBaseAbilities(config.abilityScoreMethod),
    rolledPool: [],
    flexibleRacialAbilities: [],

    backgroundMode: 'catalog',
    backgroundId,
    customBackground: '',
    classSkills: [],
    racialExtraSkills: [],
    extraLanguages: [],
    extraArmorProfs: [],
    extraWeaponProfs: [],
    extraToolProfs: [],

    fightingStyleId:
      getClassCreationRule(classId)?.fightingStyleLevel !== null &&
      config.startingLevel >= (getClassCreationRule(classId)?.fightingStyleLevel ?? 99)
        ? (getClassCreationRule(classId)?.fightingStyleIds[0] ?? null)
        : null,
    hpMode: 'official_average',
    customHpMax: null,
    initialSpells: [],

    equipmentSelections,
    starterInventory,
    customInventory: [],
    startingGoldOverride: null,
  };
}

export function getWizardRacialBonusVector(state: CharacterWizardState): Record<AbilityKey, number> {
  if (state.raceMode !== 'catalog') {
    return { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
  }
  const race = getRaceEntry(state.raceId);
  const subrace = getSubraceEntry(race, state.subraceId);
  const vec = computeFixedRacialBonuses(race, subrace);
  const flexCount = subrace?.flexibleBonusCount ?? race?.flexibleBonusCount ?? 0;
  if (flexCount > 0) {
    for (const k of state.flexibleRacialAbilities.slice(0, flexCount)) {
      vec[k] = (vec[k] ?? 0) + 1;
    }
  }
  return vec;
}

export function getWizardFinalAbilities(
  state: CharacterWizardState,
  method: CampaignCreationConfig['abilityScoreMethod'],
  isGm: boolean
): Dnd5e2014AbilityScores {
  if (method === 'manual_gm' && !isGm) {
    return { str: null, dex: null, con: null, int: null, wis: null, cha: null };
  }
  const racial = getWizardRacialBonusVector(state);
  const out: Dnd5e2014AbilityScores = {
    str: null,
    dex: null,
    con: null,
    int: null,
    wis: null,
    cha: null,
  };
  for (const key of ABILITY_KEYS) {
    const base = state.baseAbilities[key];
    out[key] = base === null ? null : Math.min(30, Math.max(1, base + racial[key]));
  }
  return out;
}

export function getFixedSkillsFromRaceAndBackground(state: CharacterWizardState): SkillId[] {
  const fixed = new Set<SkillId>();
  if (state.raceMode === 'catalog') {
    const race = getRaceEntry(state.raceId);
    for (const sk of race?.skillProficiencies ?? []) {
      fixed.add(sk);
    }
  }
  if (state.backgroundMode === 'catalog') {
    const bg = getBackgroundEntry(state.backgroundId);
    for (const sk of bg?.skillProficiencies ?? []) {
      fixed.add(sk);
    }
  }
  return Array.from(fixed);
}

export function buildSheetPatchFromWizard(
  state: CharacterWizardState,
  config: CampaignCreationConfig,
  isGm: boolean
): {
  name: string;
  memberId?: string | null;
  sheetData: Dnd5e2014SheetPatchInput;
} {
  const cleanName = state.name.trim() || 'Aventurer';
  const race = state.raceMode === 'catalog' ? getRaceEntry(state.raceId) : undefined;
  const subrace = getSubraceEntry(race, state.subraceId);
  const bg = state.backgroundMode === 'catalog' ? getBackgroundEntry(state.backgroundId) : undefined;
  const classMeta = state.classMode === 'official' ? getClassEntry(state.classId) : undefined;
  const subclassMeta =
    classMeta && state.level >= classMeta.subclassLevel && state.subclassId
      ? getSubclassEntry(state.subclassId)
      : undefined;
  const classRule = state.classMode === 'official' ? getClassCreationRule(state.classId) : undefined;

  const finalAbilities = getWizardFinalAbilities(state, config.abilityScoreMethod, isGm);
  const officialHp =
    state.classMode === 'official'
      ? calculateStartingHitPoints(state.classId, state.level, finalAbilities.con, subrace?.id)
      : 8;
  const resolvedHpMax =
    state.hpMode === 'custom' && state.customHpMax !== null ? state.customHpMax : officialHp;

  const fixedSkills = getFixedSkillsFromRaceAndBackground(state);
  const allSkills = Array.from(
    new Set<SkillId>([...fixedSkills, ...state.classSkills, ...state.racialExtraSkills])
  );

  const armorProfs = Array.from(
    new Set([
      ...(race?.armorProficiencies ?? []),
      ...(subrace?.armorProficiencies ?? []),
      ...(classRule?.armorProficiencies ?? []),
      ...state.extraArmorProfs,
    ])
  );
  const weaponProfs = Array.from(
    new Set([
      ...(race?.weaponProficiencies ?? []),
      ...(subrace?.weaponProficiencies ?? []),
      ...(classRule?.weaponProficiencies ?? []),
      ...state.extraWeaponProfs,
    ])
  );
  const toolProfs = Array.from(
    new Set([
      ...(bg?.toolProficiencies ?? []),
      ...(classRule?.toolProficiencies ?? []),
      ...state.extraToolProfs,
    ])
  );
  const languages = Array.from(
    new Set([...(race?.languages ?? []), ...state.extraLanguages])
  );

  const traits: Dnd5e2014TraitEntry[] = [];
  let tIdx = 1;
  for (const t of [...(race?.traits ?? []), ...(subrace?.traits ?? [])]) {
    traits.push({
      id: `init-trait-${tIdx++}`,
      name: t.name,
      source: t.source,
      levelUnlocked: 1,
      description: t.description,
    });
  }
  for (const t of classRule?.startingTraits ?? []) {
    traits.push({
      id: `init-trait-${tIdx++}`,
      name: t.name,
      source: t.source,
      levelUnlocked: 1,
      description: t.description,
    });
  }
  if (
    classRule?.fightingStyleLevel !== null &&
    classRule?.fightingStyleLevel !== undefined &&
    state.level >= classRule.fightingStyleLevel &&
    state.fightingStyleId
  ) {
    const fs = DND5E_FIGHTING_STYLES.find((f) => f.id === state.fightingStyleId);
    if (fs) {
      traits.push({
        id: `init-trait-${tIdx++}`,
        name: `Estil de combat: ${fs.labelCa}`,
        source: `Classe (${classMeta?.labelCa ?? state.classId})`,
        levelUnlocked: classRule.fightingStyleLevel,
        description: fs.descriptionCa,
      });
    }
  }
  if (bg) {
    traits.push({
      id: `init-trait-${tIdx++}`,
      name: bg.featureName,
      source: `Antecedent (${bg.labelCa})`,
      levelUnlocked: null,
      description: bg.featureDescription,
    });
  }

  const speedWalk = subrace?.speedWalkOverride ?? race?.speedWalk ?? 9;
  const senses = subrace?.sensesOverride !== undefined ? subrace.sensesOverride : (race?.senses ?? null);

  const startingGp =
    state.startingGoldOverride !== null
      ? state.startingGoldOverride
      : (bg?.startingGold ?? 0) + (classRule?.startingGoldDefault ?? 0);

  const sheetData: Dnd5e2014SheetPatchInput = {
    generalInfo: {
      name: cleanName,
      alignment: state.alignment.trim() || null,
      size: race?.size ?? null,
      senses,
      appearanceNotes: state.appearanceNotes.trim(),
    },
    raceAndClass: {
      race:
        state.raceMode === 'catalog'
          ? (race?.labelCa ?? null)
          : state.customRace.trim() || null,
      subrace:
        state.raceMode === 'catalog'
          ? (subrace?.labelCa ?? null)
          : state.customSubrace.trim() || null,
      classes: [
        state.classMode === 'official'
          ? {
              classId: state.classId,
              subclassId: subclassMeta?.id ?? null,
              customSubclassName:
                !subclassMeta && state.customSubclassName.trim()
                  ? state.customSubclassName.trim()
                  : null,
              level: state.level,
            }
          : {
              classId: 'custom',
              customClassName: state.customClassName.trim() || 'Classe personalitzada',
              customSubclassName: state.customSubclassName.trim() || null,
              level: state.level,
            },
      ],
    },
    abilities: finalAbilities,
    savingThrows: {
      proficient: [...(classMeta?.savingThrows ?? [])],
    },
    skills: {
      proficient: allSkills,
    },
    proficiencies: {
      armor: armorProfs,
      weapons: weaponProfs,
      tools: toolProfs,
      languages,
    },
    hitPoints: {
      max: resolvedHpMax,
      current: resolvedHpMax,
      hitDiceUsed: 0,
      hitDiceUsedByDie: {},
    },
    speed: {
      walk: speedWalk,
    },
    inventory: [...state.starterInventory, ...state.customInventory],
    currency: {
      gp: Math.max(0, Math.floor(startingGp)),
    },
    traitsAndFeatures: traits,
    spellcasting: {
      usesSpellbook: Boolean(classMeta?.usesSpellbook),
    },
    spells: state.initialSpells,
    progression: {
      totalLevel: state.level,
    },
    background: {
      backgroundName:
        state.backgroundMode === 'catalog'
          ? (bg?.labelCa ?? null)
          : state.customBackground.trim() || null,
      backstory: state.backstory.trim(),
    },
  };

  return {
    name: cleanName,
    ...(isGm && state.memberId ? { memberId: state.memberId } : {}),
    sheetData,
  };
}

export function buildPreviewFromWizard(
  state: CharacterWizardState,
  config: CampaignCreationConfig,
  isGm: boolean
): { sheet: Dnd5e2014SheetData; computed: ComputedDnd5e2014Snapshot } {
  const built = buildSheetPatchFromWizard(state, config, isGm);
  const sheet = buildEmptySheetFromPatch(built.name, state.level, built.sheetData as never);
  return {
    sheet,
    computed: computeDnd5e2014Sheet(sheet),
  };
}

export function validateWizardStep(
  step: WizardStepId,
  state: CharacterWizardState,
  config: CampaignCreationConfig,
  isGm: boolean
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const strictBlock = config.freedomMode === 'strict' && !isGm;

  if (step === 1) {
    if (!state.name.trim()) {
      errors.push('El nom del personatge és obligatori.');
    }
    const raceValue =
      state.raceMode === 'catalog' ? getRaceEntry(state.raceId)?.labelCa ?? '' : state.customRace.trim();
    if (config.requiredFields.includes('race') && !raceValue) {
      errors.push('Cal seleccionar o indicar una raça.');
    }
    if (state.classMode === 'custom' && !state.customClassName.trim()) {
      errors.push('Cal indicar el nom de la classe personalitzada.');
    }
    if (config.requiredFields.includes('alignment') && !state.alignment.trim()) {
      errors.push('L’alineament és obligatori en aquesta campanya.');
    }
    if (config.requiredFields.includes('appearanceNotes') && !state.appearanceNotes.trim()) {
      errors.push('La descripció i aspecte és obligatòria en aquesta campanya.');
    }
    if (config.requiredFields.includes('backstory') && !state.backstory.trim()) {
      errors.push('La història personal és obligatòria en aquesta campanya.');
    }
    if (config.freedomMode !== 'free' && state.level !== config.startingLevel) {
      const msg = `El nivell inicial configurat per la campanya és ${config.startingLevel} (actualment ${state.level}).`;
      if (strictBlock) errors.push(msg);
      else warnings.push(msg);
    }
  }

  if (step === 2) {
    const race = state.raceMode === 'catalog' ? getRaceEntry(state.raceId) : undefined;
    const subrace = getSubraceEntry(race, state.subraceId);
    const flexNeeded = subrace?.flexibleBonusCount ?? race?.flexibleBonusCount ?? 0;

    if (flexNeeded > 0 && state.flexibleRacialAbilities.length !== flexNeeded) {
      errors.push(
        `Has de triar ${flexNeeded} característiques diferents per al bonificador racial flexible.`
      );
    }

    if (config.abilityScoreMethod !== 'manual_gm' || isGm) {
      for (const k of ABILITY_KEYS) {
        if (state.baseAbilities[k] === null && config.abilityScoreMethod !== 'manual_gm') {
          const msg = `Falta assignar la puntuació de ${ABILITY_LABELS_CA[k]}.`;
          if (strictBlock || config.abilityScoreMethod === 'rolled_4d6_drop_lowest') {
            errors.push(msg);
          } else {
            warnings.push(msg);
          }
          break;
        }
      }

      if (config.abilityScoreMethod === 'point_buy') {
        const pb = calculatePointBuyCost(state.baseAbilities);
        if (!pb.valid) {
          if (strictBlock) errors.push(pb.error ?? 'Compra de punts invàlida.');
          else warnings.push(pb.error ?? 'Compra de punts fora de pressupost.');
        }
      }

      if (config.abilityScoreMethod === 'standard_array') {
        const vals = ABILITY_KEYS.map((k) => state.baseAbilities[k]).filter(
          (v): v is number => v !== null
        );
        const sorted = [...vals].sort((a, b) => b - a);
        const matches =
          vals.length === 6 && sorted.every((v, idx) => v === STANDARD_ARRAY_2014[idx]);
        if (!matches) {
          const msg = 'Cal assignar exactament els sis valors de l’array estàndard (15, 14, 13, 12, 10, 8).';
          if (strictBlock) errors.push(msg);
          else warnings.push(msg);
        }
      }
    }
  }

  if (step === 3) {
    const bgVal =
      state.backgroundMode === 'catalog'
        ? getBackgroundEntry(state.backgroundId)?.labelCa ?? ''
        : state.customBackground.trim();
    if (config.requiredFields.includes('background') && !bgVal) {
      errors.push('L’antecedent és obligatori en aquesta campanya.');
    }

    const fixedSkills = new Set(getFixedSkillsFromRaceAndBackground(state));
    const dupClassSkill = state.classSkills.find((s) => fixedSkills.has(s));
    if (dupClassSkill) {
      const lbl = DND5E_SKILLS.find((s) => s.id === dupClassSkill)?.labelCa ?? dupClassSkill;
      errors.push(`L’habilitat "${lbl}" ja ve donada per la raça o l’antecedent; tria’n una altra.`);
    }

    const rule = state.classMode === 'official' ? getClassCreationRule(state.classId) : undefined;
    if (rule && state.classSkills.length > rule.skillChoiceCount) {
      errors.push(`Aquesta classe permet com a màxim ${rule.skillChoiceCount} habilitats inicials.`);
    }
    if (rule && state.classSkills.length < rule.skillChoiceCount) {
      warnings.push(
        `Pots seleccionar fins a ${rule.skillChoiceCount} habilitats de classe (actualment ${state.classSkills.length}).`
      );
    }
  }

  if (step === 4) {
    const { computed } = buildPreviewFromWizard(state, config, isGm);
    const exceeded = computed.spellcasting?.sources.find((s) => s.exceedsPreparedLimit);
    if (exceeded) {
      const msg = `Has preparat ${exceeded.preparedCount} conjurs de ${exceeded.classLabelCa}, però el màxim oficial és ${exceeded.preparedLimit}.`;
      if (!isGm) errors.push(msg);
      else warnings.push(msg);
    }
  }

  return { errors, warnings };
}
