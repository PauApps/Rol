import { describe, expect, it } from 'vitest';
import { createTestDb } from '@/db';
import { characters } from '@/db/schema';
import {
  buildLongRestPatch,
  buildShortRestPatch,
  computeAttacks,
  computeDnd5e2014Sheet,
  createEmptyDnd5e2014Sheet,
  dnd5e2014SheetSchema,
  executeVirtualD20Check,
  normalizeDnd5e2014Sheet,
  normalizeFieldPermissions,
  resolveRollMode,
  rollD20Check,
} from '@/domain/systems/dnd5e-2014';
import { resolveSession } from '@/server/auth/session';
import { createCampaign } from '@/server/services/campaign-service';
import {
  createCharacterBase,
  getCampaignCharacter,
  updateCharacterBase,
} from '@/server/services/character-service';
import {
  acceptPlayerInvitation,
  createPlayerInvitation,
} from '@/server/services/player-invitation-service';
import { bootstrapAdmin, createInvitedGm } from './helpers';

describe('Fase 3B: Extensions del model de dades, atacs, màgia, descansos, progressió i seguretat D&D 5e (2014)', () => {
  it('calcula atacs d’armes equipades, finesse, monjo, distància, competències, overrides i no duplica inventari', () => {
    const sheet = createEmptyDnd5e2014Sheet('Kaelen');
    sheet.raceAndClass.classes = [{ classId: 'fighter', level: 5 }]; // prof +3
    sheet.abilities = { str: 16, dex: 18, con: 14, int: 10, wis: 12, cha: 8 }; // +3 STR, +4 DEX
    sheet.proficiencies.weapons = ['Armes senzilles', 'Estoc', 'Arc llarg'];

    sheet.inventory = [
      {
        id: 'w-mace',
        name: 'Maça',
        category: 'weapon',
        quantity: 1,
        weight: 4,
        equipped: true,
        armorType: null,
        baseAc: null,
        acBonus: null,
        requiresAttunement: false,
        attuned: false,
        weaponAbility: null,
        weaponProficient: false,
        damage: '1d6+3',
        damageType: 'contundent',
        weaponRange: 'Cos a cos (1,5 m)',
        weaponProperties: '',
        notes: '',
      },
      {
        id: 'w-rapier',
        name: 'Estoc',
        category: 'weapon',
        quantity: 1,
        weight: 2,
        equipped: true,
        armorType: null,
        baseAc: null,
        acBonus: null,
        requiresAttunement: false,
        attuned: false,
        weaponAbility: null, // finesse -> auto-tria millor (+4 DEX > +3 STR)
        weaponProficient: false,
        damage: '1d8+4',
        damageType: 'perforant',
        weaponRange: 'Cos a cos (1,5 m)',
        weaponProperties: 'Sutil',
        notes: '',
      },
      {
        id: 'w-bow',
        name: 'Arc llarg',
        category: 'weapon',
        quantity: 1,
        weight: 2,
        equipped: false, // DESEQUIPADA -> no ha d'aparèixer a atacs
        armorType: null,
        baseAc: null,
        acBonus: null,
        requiresAttunement: false,
        attuned: false,
        weaponAbility: null,
        weaponProficient: false,
        damage: '1d8+4',
        damageType: 'perforant',
        weaponRange: '45/180 m',
        weaponProperties: 'Munició, pesada, a dues mans',
        notes: '',
      },
      {
        id: 'w-halberd',
        name: 'Alabarda rúnica',
        category: 'weapon',
        quantity: 1,
        weight: 6,
        equipped: true,
        armorType: null,
        baseAc: null,
        acBonus: null,
        requiresAttunement: false,
        attuned: false,
        weaponAbility: null,
        weaponProficient: false, // Sense competència en armes marcials ni alabarda
        damage: '1d10+3',
        damageType: 'tallant',
        weaponRange: '3 m',
        weaponProperties: 'Pesada, abast, a dues mans',
        notes: '',
      },
    ];

    // Atac enllaçat a w-mace per afegir nota/override del GM + 1 atac manual (desarmat)
    sheet.attacks = [
      {
        id: 'atk-link-mace',
        inventoryItemId: 'w-mace',
        name: 'Maça beneïda',
        ability: null,
        proficient: true,
        bonusOverride: 9,
        attackBonus: null,
        damage: null,
        damageType: null,
        range: null,
        notes: 'Override del GM (+9).',
      },
      {
        id: 'atk-unarmed',
        inventoryItemId: null,
        name: 'Cop desarmat',
        ability: 'str',
        proficient: true,
        bonusOverride: null,
        attackBonus: null,
        damage: '1+3',
        damageType: 'contundent',
        range: '1,5 m',
        notes: '',
      },
    ];

    const snap = computeDnd5e2014Sheet(sheet);
    const attacks = snap.combat.attacks;

    // 3 armes equipades (Maça fusionada sense duplicar, Estoc, Alabarda) + 1 manual = 4; Arc llarg desequipat exclòs
    expect(attacks).toHaveLength(4);
    expect(attacks.find((a) => a.inventoryItemId === 'w-bow')).toBeUndefined();

    const mace = attacks.find((a) => a.inventoryItemId === 'w-mace')!;
    expect(mace.proficient).toBe(true);
    expect(mace.attackBonus).toBe(9); // bonusOverride aplicat sense duplicar entrada
    expect(mace.attackBonusDisplay).toBe('+9');

    const rapier = attacks.find((a) => a.inventoryItemId === 'w-rapier')!;
    expect(rapier.ability).toBe('dex');
    expect(rapier.proficient).toBe(true);
    expect(rapier.attackBonus).toBe(7); // +4 DEX +3 prof
    expect(rapier.isAbilityOverridden).toBe(false);

    const halberd = attacks.find((a) => a.inventoryItemId === 'w-halberd')!;
    expect(halberd.ability).toBe('str');
    expect(halberd.proficient).toBe(false);
    expect(halberd.proficiencySource).toBe('none');
    expect(halberd.attackBonus).toBe(3); // +3 STR +0 prof

    // En equipar l'Arc llarg, es calcula automàticament amb Destresa (+4) i competència (+3) = +7
    sheet.inventory.find((i) => i.id === 'w-bow')!.equipped = true;
    const snapWithBow = computeDnd5e2014Sheet(sheet);
    const longbow = snapWithBow.combat.attacks.find((a) => a.inventoryItemId === 'w-bow')!;
    expect(longbow).toBeDefined();
    expect(longbow.ability).toBe('dex');
    expect(longbow.proficient).toBe(true);
    expect(longbow.attackBonus).toBe(7);

    // Monjo pot fer servir Destresa en un Bastó (simple melee sense heavy/twoHanded)
    const monkSheet = createEmptyDnd5e2014Sheet('Li');
    monkSheet.raceAndClass.classes = [{ classId: 'monk', level: 3 }];
    monkSheet.abilities = { str: 10, dex: 16, con: 14, int: 10, wis: 16, cha: 8 };
    monkSheet.proficiencies.weapons = ['Armes senzilles', 'Espasa curta'];
    monkSheet.inventory = [
      {
        id: 'w-staff',
        name: 'Bastó de fusta',
        category: 'weapon',
        quantity: 1,
        weight: 4,
        equipped: true,
        armorType: null,
        baseAc: null,
        acBonus: null,
        requiresAttunement: false,
        attuned: false,
        weaponAbility: 'dex',
        weaponProficient: false,
        damage: '1d6+3',
        damageType: 'contundent',
        weaponRange: '1,5 m',
        weaponProperties: 'Versàtil (1d8)',
        notes: '',
      },
    ];
    const monkAttacks = computeAttacks(monkSheet, { str: 0, dex: 3, con: 2, int: 0, wis: 3, cha: -1 }, 2);
    expect(monkAttacks[0].ability).toBe('dex');
    expect(monkAttacks[0].isAbilityOverridden).toBe(false);
    expect(monkAttacks[0].attackBonus).toBe(5);
  });

  it('calcula màgia per classe i multiclasse, límits de conjurs preparats, grimori i Màgia de Pacte', () => {
    // 1. Paladí nivell 1 no és encara llançador; a nivell 2 desbloqueja espais i límit preparats = mod + floor(lvl/2)
    const pal1 = createEmptyDnd5e2014Sheet('Galahad');
    pal1.raceAndClass.classes = [{ classId: 'paladin', level: 1 }];
    pal1.abilities = { str: 16, dex: 10, con: 14, int: 8, wis: 10, cha: 16 }; // +3 CHA
    expect(computeDnd5e2014Sheet(pal1).spellcasting).toBeNull();

    pal1.raceAndClass.classes = [{ classId: 'paladin', level: 4 }];
    const pal4Snap = computeDnd5e2014Sheet(pal1);
    expect(pal4Snap.spellcasting?.sources[0].preparedLimit).toBe(5); // +3 CHA + floor(4/2)=2
    expect(pal4Snap.spellcasting?.slots.map((s) => s.total)).toEqual([3]);

    // 2. Cavaller Arcà nivell 8 (third caster: floor((8+2)/3)=3 -> espais [4, 2])
    const ek = createEmptyDnd5e2014Sheet('Varian');
    ek.raceAndClass.classes = [{ classId: 'fighter', subclassId: 'eldritch-knight', level: 8 }];
    ek.abilities = { str: 18, dex: 12, con: 16, int: 14, wis: 10, cha: 10 };
    const ekSnap = computeDnd5e2014Sheet(ek);
    expect(ekSnap.spellcasting?.sources[0].model).toBe('known');
    expect(ekSnap.spellcasting?.sources[0].preparedLimit).toBeNull();
    expect(ekSnap.spellcasting?.slots.map((s) => s.total)).toEqual([4, 2]);

    // 3. Multiclasse complex: Clergue 3 (SAV +3) / Mag 2 (INT +4) -> 2 models diferents + 5 nivells compartits
    const multi = createEmptyDnd5e2014Sheet('Alara');
    multi.raceAndClass.classes = [
      { classId: 'cleric', subclassId: 'life-domain', level: 3 },
      { classId: 'wizard', subclassId: 'divination', level: 2 },
    ];
    multi.abilities = { str: 10, dex: 12, con: 14, int: 18, wis: 16, cha: 10 }; // prof +3
    multi.spells = [
      // Clergue: sempre preparat (Domini) + 2 preparats + 1 truc
      { id: 'c0', level: 0, name: 'Flama sagrada', castingTime: '', range: '', components: '', duration: '', school: null, sourceType: 'class', sourceClassId: 'cleric', alwaysPrepared: false, prepared: false, inSpellbook: false, ritual: false, concentration: false, notes: '' },
      { id: 'c1', level: 1, name: 'Beneir', castingTime: '', range: '', components: '', duration: '', school: null, sourceType: 'class', sourceClassId: 'cleric', alwaysPrepared: true, prepared: true, inSpellbook: false, ritual: false, concentration: true, notes: '' },
      { id: 'c2', level: 1, name: 'Curar ferides', castingTime: '', range: '', components: '', duration: '', school: null, sourceType: 'class', sourceClassId: 'cleric', alwaysPrepared: false, prepared: true, inSpellbook: false, ritual: false, concentration: false, notes: '' },
      { id: 'c3', level: 2, name: 'Restauració menor', castingTime: '', range: '', components: '', duration: '', school: null, sourceType: 'class', sourceClassId: 'cleric', alwaysPrepared: false, prepared: true, inSpellbook: false, ritual: false, concentration: false, notes: '' },
      // Mag: 4 al grimori, però només 2 preparats! No s'han de confondre grimori i preparats
      { id: 'w1', level: 1, name: 'Escut', castingTime: '', range: '', components: '', duration: '', school: null, sourceType: 'class', sourceClassId: 'wizard', alwaysPrepared: false, prepared: true, inSpellbook: true, ritual: false, concentration: false, notes: '' },
      { id: 'w2', level: 1, name: 'Projectil màgic', castingTime: '', range: '', components: '', duration: '', school: null, sourceType: 'class', sourceClassId: 'wizard', alwaysPrepared: false, prepared: true, inSpellbook: true, ritual: false, concentration: false, notes: '' },
      { id: 'w3', level: 1, name: 'Detectar màgia', castingTime: '', range: '', components: '', duration: '', school: null, sourceType: 'class', sourceClassId: 'wizard', alwaysPrepared: false, prepared: false, inSpellbook: true, ritual: true, concentration: false, notes: '' },
      { id: 'w4', level: 1, name: 'Identificar', castingTime: '', range: '', components: '', duration: '', school: null, sourceType: 'class', sourceClassId: 'wizard', alwaysPrepared: false, prepared: false, inSpellbook: true, ritual: true, concentration: false, notes: '' },
      // Conjur de tret/raça: no consumeix límit preparat de classe
      { id: 'f1', level: 1, name: 'Pas boirós', castingTime: '', range: '', components: '', duration: '', school: null, sourceType: 'feature', sourceClassId: null, alwaysPrepared: true, prepared: true, inSpellbook: false, ritual: false, concentration: false, notes: '' },
    ];

    const multiSnap = computeDnd5e2014Sheet(multi);
    expect(multiSnap.spellcasting?.effectiveCasterLevel).toBe(5);
    expect(multiSnap.spellcasting?.slots.map((s) => s.total)).toEqual([4, 3, 2]);
    expect(multiSnap.spellcasting?.specialSpellsCount).toBe(1);

    const clericSrc = multiSnap.spellcasting!.sources.find((s) => s.classId === 'cleric')!;
    expect(clericSrc.model).toBe('prepared');
    expect(clericSrc.ability).toBe('wis');
    expect(clericSrc.saveDc).toBe(14); // 8 + 3 + 3
    expect(clericSrc.preparedLimit).toBe(6); // +3 WIS + 3 lv
    expect(clericSrc.preparedCount).toBe(2); // alwaysPrepared i truc exclosos
    expect(clericSrc.alwaysPreparedCount).toBe(1);
    expect(clericSrc.maxClassSpellLevel).toBe(2);

    const wizardSrc = multiSnap.spellcasting!.sources.find((s) => s.classId === 'wizard')!;
    expect(wizardSrc.model).toBe('spellbook');
    expect(wizardSrc.ability).toBe('int');
    expect(wizardSrc.saveDc).toBe(15); // 8 + 3 + 4
    expect(wizardSrc.preparedLimit).toBe(6); // +4 INT + 2 lv
    expect(wizardSrc.spellbookCount).toBe(4);
    expect(wizardSrc.preparedCount).toBe(2);
    expect(wizardSrc.maxClassSpellLevel).toBe(1);

    // 4. Paladí 3 / Bruixot 2: Màgia de Pacte separada d'espais regulars
    const padlock = createEmptyDnd5e2014Sheet('Dorian');
    padlock.raceAndClass.classes = [
      { classId: 'paladin', level: 3 },
      { classId: 'warlock', level: 2 },
    ];
    padlock.abilities = { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 16 };
    const padSnap = computeDnd5e2014Sheet(padlock);
    expect(padSnap.spellcasting?.effectiveCasterLevel).toBe(2); // ceil(3/2), sense barrejar Warlock
    expect(padSnap.spellcasting?.slots.map((s) => s.total)).toEqual([3]);
    expect(padSnap.spellcasting?.pactMagic).toMatchObject({ count: 2, slotLevel: 1, available: 2 });

    // 5. Classe de conjurs coneguts (Bard nivell 3): sense límit de preparats, comptatge independent
    const bard = createEmptyDnd5e2014Sheet('Dandelion');
    bard.raceAndClass.classes = [{ classId: 'bard', subclassId: 'lore', level: 3 }];
    bard.abilities = { str: 8, dex: 14, con: 12, int: 12, wis: 10, cha: 16 };
    bard.spells = [
      { id: 'b1', level: 1, name: 'Paraula guaridora', castingTime: '', range: '', components: '', duration: '', school: null, sourceType: 'class', sourceClassId: 'bard', alwaysPrepared: false, prepared: false, inSpellbook: false, ritual: false, concentration: false, notes: '' },
      { id: 'b2', level: 2, name: 'Invisibilitat', castingTime: '', range: '', components: '', duration: '', school: null, sourceType: 'class', sourceClassId: 'bard', alwaysPrepared: false, prepared: false, inSpellbook: false, ritual: false, concentration: true, notes: '' },
    ];
    const bardSnap = computeDnd5e2014Sheet(bard);
    expect(bardSnap.spellcasting?.sources[0].model).toBe('known');
    expect(bardSnap.spellcasting?.sources[0].preparedLimit).toBeNull();
    expect(bardSnap.spellcasting?.sources[0].knownCount).toBe(2);
    expect(bardSnap.spellcasting?.slots.map((s) => s.total)).toEqual([4, 2]);
  });

  it('executa descans curt i llarg respectant daus de cop, Pacte, alba, recursos personalitzats i permisos', () => {
    const sheet = createEmptyDnd5e2014Sheet('Lyra');
    sheet.raceAndClass.classes = [
      { classId: 'fighter', level: 3 }, // d10, Second Wind + Action Surge (short_rest)
      { classId: 'warlock', level: 2 }, // d8, 2 Pact slots lv1 (short_rest)
    ];
    sheet.abilities = { str: 14, dex: 14, con: 14, int: 10, wis: 12, cha: 16 }; // +2 CON
    sheet.hitPoints = {
      max: 40,
      current: 15,
      temporary: 7,
      hitDice: null,
      hitDiceUsed: 2, // 5 totals - 2 gastats = 3 disponibles
      deathSaves: { successes: 2, failures: 1 },
    };
    sheet.spellSlotsUsed = { '1': 1, pact: 2 };
    sheet.customResources = [
      { id: 'c-short', name: 'Amuleto curt', maxUses: 1, recovery: 'short_rest', description: '' },
      { id: 'c-dawn', name: 'Vara de l’alba', maxUses: 3, recovery: 'dawn', description: '' },
      { id: 'c-other', name: 'Marca narrativa del GM', maxUses: 1, recovery: 'other', description: '' },
    ];
    sheet.resourceUsage = {
      'class:fighter:second_wind': 1,
      'class:fighter:action_surge': 1,
      'custom:c-short': 1,
      'custom:c-dawn': 2,
      'custom:c-other': 1,
    };

    // Descans curt sense gastar daus -> 0 daus gastats, recupera short_rest i Pacte, NO toca alba ni other
    const shortNoDice = buildShortRestPatch(sheet);
    expect(shortNoDice.summary.hitDiceSpent).toBe(0);
    expect(shortNoDice.patch.hitPoints).toBeUndefined();
    expect(shortNoDice.patch.spellSlotsUsed).toEqual({ pact: 0 });
    expect(shortNoDice.summary.resetResourceKeys.sort()).toEqual([
      'class:fighter:action_surge',
      'class:fighter:second_wind',
      'custom:c-short',
    ]);
    expect(shortNoDice.patch.resourceUsage?.['custom:c-dawn']).toBeUndefined();
    expect(shortNoDice.patch.resourceUsage?.['custom:c-other']).toBeUndefined();

    // Descans curt amb despesa voluntària d'1d10 (tirada 6 + CON +2 = +8 PV -> 23)
    const shortWithDice = buildShortRestPatch(sheet, {
      hitDiceToSpend: [{ dieSize: 10, count: 1, rolls: [6] }],
    });
    expect(shortWithDice.summary.hitDiceSpent).toBe(1);
    expect(shortWithDice.summary.hpRestored).toBe(8);
    expect(shortWithDice.patch.hitPoints).toEqual({ hitDiceUsed: 3, current: 23 });

    // No permet gastar daus de mida aliena ni superar la reserva de classe o els disponibles totals
    expect(() =>
      buildShortRestPatch(sheet, { hitDiceToSpend: [{ dieSize: 12, count: 1 }] })
    ).toThrow(/no disposa/);
    expect(() =>
      buildShortRestPatch(sheet, { hitDiceToSpend: [{ dieSize: 10, count: 4 }] })
    ).toThrow(/no disposa/);
    expect(() =>
      buildShortRestPatch(sheet, {
        hitDiceToSpend: [
          { dieSize: 10, count: 2 },
          { dieSize: 8, count: 2 },
        ],
      })
    ).toThrow(/disponibles/);

    // Descans llarg sense incloure alba -> restaura PV, posa temp=0, salva mort, recupera floor(5/2)=2 daus, NO reinicia alba ni other
    const longDefault = buildLongRestPatch(sheet);
    expect(longDefault.patch.hitPoints).toEqual({
      current: 40,
      temporary: 0,
      deathSaves: { successes: 0, failures: 0 },
      hitDiceUsed: 0, // 2 gastats - min(2, floor(5/2)=2) = 0
    });
    expect(longDefault.patch.spellSlotsUsed).toEqual({ '1': 0, pact: 0 });
    expect(longDefault.summary.skippedDawnResourceKeys).toEqual(['custom:c-dawn']);
    expect(longDefault.summary.skippedManualCustomResourceKeys).toEqual(['custom:c-other']);

    // Descans llarg amb includeDawnResources: true recupera 'dawn' però mai 'other'
    const longWithDawn = buildLongRestPatch(sheet, { includeDawnResources: true });
    expect(longWithDawn.summary.resetResourceKeys).toContain('custom:c-dawn');
    expect(longWithDawn.summary.skippedManualCustomResourceKeys).toEqual(['custom:c-other']);

    // Respecte de permisos granulars quan el GM bloqueja `hitPoints` i `spellSlotsUsed`
    const lockedPerms = normalizeFieldPermissions({
      playerEditableFields: ['resourceUsage'],
      gmOnlyFields: ['hitPoints'],
    });
    const restrictedShort = buildShortRestPatch(sheet, {
      hitDiceToSpend: [{ dieSize: 10, count: 1, rolls: [6] }],
      isGm: false,
      permissions: lockedPerms,
    });
    expect(restrictedShort.patch.hitPoints).toBeUndefined();
    expect(restrictedShort.patch.spellSlotsUsed).toBeUndefined();
    expect(restrictedShort.summary.skippedByPermissions).toEqual([
      'hitPoints.hitDiceUsed',
      'spellSlotsUsed',
    ]);
  });

  it('calcula fites de progressió fins al nivell 20, recursos modulars i avantatge/desavantatge sense alterar modificadors', () => {
    // 1. Multiclasse Druida Cercle Estrelles 6 / Explorador 3 (nivell total 9)
    const sheet = createEmptyDnd5e2014Sheet('Sira');
    sheet.raceAndClass.classes = [
      { classId: 'druid', subclassId: 'circle-of-stars', level: 6 },
      { classId: 'ranger', subclassId: 'hunter', level: 3 },
    ];
    sheet.abilities = { str: 10, dex: 16, con: 14, int: 12, wis: 18, cha: 10 }; // prof +4
    sheet.savingThrows.rollModes = { wis: 'advantage', dex: 'disadvantage' };
    sheet.skills.proficient = ['perception', 'stealth'];
    sheet.skills.rollModes = { perception: 'advantage', stealth: 'disadvantage' };

    const snap = computeDnd5e2014Sheet(sheet);

    // Recursos separats: cap de bàrbar ni monjo; Estrelles té Mapa estel·lar (+4) i Presagi còsmic (+4)
    expect(snap.resources.every((r) => r.origin === 'official')).toBe(true);
    expect(snap.resources.map((r) => r.key)).toEqual([
      'class:druid:wild_shape',
      'subclass:circle-of-stars:starry_form',
      'subclass:circle-of-stars:star_map',
      'subclass:circle-of-stars:cosmic_omen',
    ]);
    expect(snap.resources.find((r) => r.key === 'subclass:circle-of-stars:star_map')?.totalUses).toBe(4);
    expect(snap.resources.find((r) => r.key === 'subclass:circle-of-stars:cosmic_omen')?.totalUses).toBe(4);

    // Avantatge/desavantatge no alteren modificadors ni competència
    const perc = snap.skills.find((s) => s.id === 'perception')!;
    expect(perc.rollMode).toBe('advantage');
    expect(perc.abilityMod).toBe(4);
    expect(perc.proficiencyApplied).toBe(4);
    expect(perc.total).toBe(8);

    // Cancel·lació mútua quan s'afegeix una font contrària + bloqueig si virtualDiceEnabled === false
    expect(() =>
      executeVirtualD20Check({
        virtualDiceEnabled: false,
        modifier: perc.total,
        checkType: 'skill',
        storedMode: perc.rollMode,
      })
    ).toThrow(/desactivat/);

    const cancelledSkillRoll = executeVirtualD20Check({
      virtualDiceEnabled: true,
      modifier: perc.total,
      checkType: 'skill',
      storedMode: perc.rollMode,
      disadvantageSources: 1,
      rng: () => 0.99, // 20 natural, però en 'skill' NO és cop crític
    });
    expect(cancelledSkillRoll.mode).toBe('normal');
    expect(cancelledSkillRoll.isNatural20).toBe(true);
    expect(cancelledSkillRoll.isCriticalHit).toBe(false);
    expect(resolveRollMode({ explicitMode: 'disadvantage', advantageSources: 1 })).toBe('normal');

    const attackCritRoll = rollD20Check({ modifier: 7, checkType: 'attack', rng: () => 0.99 });
    expect(attackCritRoll.isCriticalHit).toBe(true);

    // Progressió multiclasse: salts de competència 13 i 17, pròxim ASI d'Explorador 4 i Druida 8, límit màxim 20
    expect(snap.progression.isMaxLevel).toBe(false);
    expect(snap.progression.maxLevelMessageCa).toBeNull();
    expect(snap.progression.upcomingMilestones.some((m) => m.category === 'proficiency_bonus' && m.targetTotalLevel === 13)).toBe(true);
    expect(snap.progression.upcomingMilestones.some((m) => m.classId === 'ranger' && m.targetClassLevel === 4 && m.category === 'asi')).toBe(true);
    // Cap fita sobrepassa nivell total 20
    expect(snap.progression.upcomingMilestones.every((m) => m.targetTotalLevel <= 20)).toBe(true);

    // A nivell 20 indica nivell màxim oficial i no extrapola
    sheet.raceAndClass.classes = [{ classId: 'wizard', subclassId: 'divination', level: 20 }];
    sheet.customResources = [
      { id: 'cr-1', name: 'Favor arcà', maxUses: 2, recovery: 'short_rest', description: '' },
    ];
    const snap20 = computeDnd5e2014Sheet(sheet);
    expect(snap20.progression.isMaxLevel).toBe(true);
    expect(snap20.progression.maxLevelMessageCa).toContain('nivell màxim oficial (20)');
    expect(snap20.progression.upcomingMilestones).toEqual([]);
    expect(snap20.resources.find((r) => r.key === 'subclass:divination:portent')?.totalUses).toBe(3);
    expect(snap20.resources.filter((r) => r.origin === 'official').every((r) => !r.isCustom)).toBe(true);
    expect(snap20.resources.find((r) => r.origin === 'custom')?.key).toBe('custom:cr-1');

    // Druida del Cercle de la Terra inclou Recuperació natural sense mostrar recursos d'Estrelles
    const landDruid = createEmptyDnd5e2014Sheet('Sylva');
    landDruid.raceAndClass.classes = [{ classId: 'druid', subclassId: 'circle-of-the-land', level: 4 }];
    const landRes = computeDnd5e2014Sheet(landDruid).resources;
    expect(landRes.map((r) => r.key)).toEqual([
      'class:druid:wild_shape',
      'subclass:circle-of-the-land:natural_recovery',
    ]);
  });

  it('valida camps nous amb Zod, protegeix excepcions d’arma/sintonització/conjurs i migra fitxes v1/v2 a BD', async () => {
    const { db, close } = await createTestDb();
    try {
      const admin = await bootstrapAdmin(db);
      const gm = await createInvitedGm(db, admin.ctx, 'gm.3b@rol.test', 'GM 3B');
      const camp = await createCampaign(db, gm.ctx, { name: 'Aethelgard', systemId: 'dnd5e-2014' });

      const inv = await createPlayerInvitation(db, gm.ctx, camp.id);
      const reg = await acceptPlayerInvitation(db, inv.rawToken, {
        mode: 'register',
        email: 'jugador.3b@rol.test',
        displayName: 'Oriol',
        password: 'PlayerPassword123!',
      });
      const playerCtx = await resolveSession(db, reg.rawToken);

      // 1. Rebuigs Zod: sintonitzar sense requerir-ho, >3 objectes sintonitzats, levelHistory incoherent
      const nonAttunable = dnd5e2014SheetSchema.safeParse({
        ...createEmptyDnd5e2014Sheet('Test'),
        inventory: [
          {
            id: 'i1',
            name: 'Motxilla',
            category: 'gear',
            quantity: 1,
            weight: 5,
            equipped: false,
            armorType: null,
            baseAc: null,
            acBonus: null,
            requiresAttunement: false,
            attuned: true,
            weaponAbility: null,
            weaponProficient: false,
            damage: null,
            damageType: null,
            weaponRange: null,
            weaponProperties: '',
            notes: '',
          },
        ],
      });
      expect(nonAttunable.success).toBe(false);

      const baseTooManyAttuned = createEmptyDnd5e2014Sheet('Attune');
      baseTooManyAttuned.inventory = [1, 2, 3, 4].map((n) => ({
        id: `m-${n}`,
        name: `Anell ${n}`,
        category: 'magic_item',
        quantity: 1,
        weight: null,
        equipped: true,
        armorType: null,
        baseAc: null,
        acBonus: null,
        requiresAttunement: true,
        attuned: true,
        weaponAbility: null,
        weaponProficient: false,
        damage: null,
        damageType: null,
        weaponRange: null,
        weaponProperties: '',
        notes: '',
      }));
      expect(dnd5e2014SheetSchema.safeParse(baseTooManyAttuned).success).toBe(false);

      const badHistory = createEmptyDnd5e2014Sheet('Història');
      badHistory.raceAndClass.classes = [{ classId: 'fighter', level: 2 }];
      badHistory.progression.totalLevel = 2;
      badHistory.progression.levelHistory = [
        { id: 'h1', level: 3, classId: 'fighter', customClassName: null, subclassId: null, hpGain: 7, notes: '', date: '' },
      ];
      expect(dnd5e2014SheetSchema.safeParse(badHistory).success).toBe(false);

      // 2. Protecció de permisos al servidor: un jugador no pot forçar weaponProficient, weaponAbilityOverride ni attunement.limitOverride
      await expect(
        createCharacterBase(db, playerCtx, camp.id, {
          name: 'Trampós Arma',
          sheetData: {
            raceAndClass: { classes: [{ classId: 'wizard', level: 1 }] },
            inventory: [
              { id: 'w1', name: 'Espasa llarga', category: 'weapon', weaponProficient: true },
            ],
          },
        })
      ).rejects.toMatchObject({ status: 403, code: 'OFFICIAL_CALCULATION_PROTECTED' });

      await expect(
        createCharacterBase(db, playerCtx, camp.id, {
          name: 'Trampós Destresa',
          sheetData: {
            raceAndClass: { classes: [{ classId: 'fighter', level: 1 }] },
            inventory: [
              { id: 'w1', name: 'Espasa llarga', category: 'weapon', weaponAbility: 'dex' },
            ],
          },
        })
      ).rejects.toMatchObject({ status: 403, code: 'OFFICIAL_CALCULATION_PROTECTED' });

      await expect(
        createCharacterBase(db, playerCtx, camp.id, {
          name: 'Trampós Sintonització',
          sheetData: { attunement: { limitOverride: 6 } },
        })
      ).rejects.toMatchObject({ status: 403, code: 'OFFICIAL_CALCULATION_PROTECTED' });

      // 3. Creació legítima + límit oficial de conjurs preparats (Clergue niv. 1, SAV +2 -> màx 3 preparats)
      const clericChar = await createCharacterBase(db, playerCtx, camp.id, {
        name: 'Talia',
        sheetData: {
          generalInfo: { size: 'Mitjana (M)', senses: 'Visió normal' },
          raceAndClass: { race: 'Humà', classes: [{ classId: 'cleric', level: 1 }] },
          abilities: { str: 14, dex: 10, con: 14, int: 10, wis: 14, cha: 12 },
          proficiencies: { weapons: ['Armes senzilles'] },
          hitPoints: { max: 10, current: 6, hitDiceUsed: 1 },
          inventory: [
            {
              id: 'mace-1',
              name: 'Maça',
              category: 'weapon',
              equipped: true,
              damage: '1d6+2',
              damageType: 'contundent',
            },
          ],
          progression: {
            levelHistory: [
              { id: 'lh-1', level: 1, classId: 'cleric', hpGain: 10, notes: 'Inici' },
            ],
          },
        },
      });

      await expect(
        updateCharacterBase(db, playerCtx, camp.id, clericChar.id, {
          sheetPatch: {
            spells: [1, 2, 3, 4].map((n) => ({
              id: `sp-${n}`,
              level: 1,
              name: `Conjur ${n}`,
              prepared: true,
            })),
          },
        })
      ).rejects.toMatchObject({ status: 400, code: 'SPELL_PREPARED_LIMIT_EXCEEDED' });

      // 3 preparats + 1 alwaysPrepared passa perfectament!
      const validSpells = await updateCharacterBase(db, playerCtx, camp.id, clericChar.id, {
        sheetPatch: {
          spells: [
            { id: 'sp-1', level: 1, name: 'Curar ferides', prepared: true },
            { id: 'sp-2', level: 1, name: 'Beneir', prepared: true },
            { id: 'sp-3', level: 1, name: 'Escut de fe', prepared: true },
            { id: 'sp-dom', level: 1, name: 'Ordre imperiosa', prepared: true, alwaysPrepared: true },
          ],
        },
      });
      expect(validSpells.computed.spellcasting?.sources[0].preparedCount).toBe(3);
      expect(validSpells.computed.combat.attacks).toHaveLength(1);
      expect(validSpells.computed.combat.attacks[0].attackBonus).toBe(4); // +2 STR +2 prof

      // 4. GM pot concedir excepció de sintonització i notes privades + jugador fa descans llarg parcial sense tocar gmOnlyFields
      await updateCharacterBase(db, gm.ctx, camp.id, clericChar.id, {
        gmNotes: 'Relíquia amagada',
        sheetPatch: { attunement: { limitOverride: 4 } },
        fieldPermissions: { gmOnlyFields: ['background.additionalNotes'] },
      });

      const fetched = await getCampaignCharacter(db, playerCtx, camp.id, clericChar.id);
      const normalized = normalizeDnd5e2014Sheet(fetched.sheetData, fetched.name);
      const { patch: restPatch } = buildLongRestPatch(normalized);
      const afterRest = await updateCharacterBase(db, playerCtx, camp.id, clericChar.id, {
        sheetPatch: restPatch,
      });
      expect(afterRest.computed.inventorySummary.attunement.maxSlots).toBe(4);
      expect((afterRest.sheetData.hitPoints as Record<string, unknown>).current).toBe(10);
      expect((afterRest.sheetData.hitPoints as Record<string, unknown>).hitDiceUsed).toBe(0);
      expect('gmNotes' in afterRest).toBe(false);

      // 5. Compatibilitat v1/v2 antiga sense camps nous directa a BD
      const [legacyRow] = await db
        .insert(characters)
        .values({
          campaignId: camp.id,
          memberId: reg.memberId,
          systemId: 'dnd5e-2014',
          name: 'Corvin Antic',
          schemaVersion: 1,
          sheetData: {
            generalInfo: { name: 'Corvin Antic' },
            raceAndClass: { race: 'Elf', classes: [{ name: 'Mag', level: 3 }] },
            abilities: { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 10 },
            spells: [{ id: 's1', level: 1, name: 'Escut', prepared: true, inSpellbook: true }],
          },
          customFields: {},
          fieldPermissions: {},
          gmNotes: '',
        })
        .returning();

      const loadedLegacy = await getCampaignCharacter(db, playerCtx, camp.id, legacyRow.id);
      expect(loadedLegacy.computed.spellcasting?.sources[0].spellbookCount).toBe(1);
      expect(loadedLegacy.computed.spellcasting?.sources[0].preparedLimit).toBe(6);
      expect(loadedLegacy.computed.inventorySummary.attunement.maxSlots).toBe(3);

      // També pot ser actualitzada amb els nous camps de rollModes i levelHistory
      const updatedLegacy = await updateCharacterBase(db, playerCtx, camp.id, legacyRow.id, {
        sheetPatch: {
          savingThrows: { rollModes: { int: 'advantage' } },
          progression: {
            levelHistory: [
              { id: 'lh-1', level: 1, classId: 'wizard', hpGain: 7 },
              { id: 'lh-2', level: 2, classId: 'wizard', subclassId: 'divination', hpGain: 5 },
              { id: 'lh-3', level: 3, classId: 'wizard', hpGain: 5 },
            ],
          },
        },
      });
      expect(updatedLegacy.schemaVersion).toBe(2);
      expect(updatedLegacy.computed.savingThrows.find((s) => s.ability === 'int')?.rollMode).toBe('advantage');
    } finally {
      await close();
    }
  });
});
