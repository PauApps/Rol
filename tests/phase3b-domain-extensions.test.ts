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
        weaponAbilityOverride: null,
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
        weaponAbilityOverride: null,
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
        weaponAbilityOverride: null,
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
        weaponAbilityOverride: null,
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
        kind: 'weapon_override',
        spellSourceClassId: null,
        name: 'Maça beneïda',
        ability: null,
        abilityOverride: null,
        proficient: false,
        proficientOverride: null,
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
        kind: 'unarmed',
        spellSourceClassId: null,
        name: 'Cop desarmat',
        ability: 'str',
        abilityOverride: null,
        proficient: true,
        proficientOverride: null,
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
        weaponAbilityOverride: null,
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
      hitDiceUsed: 2, // 5 totals - 2 gastats (1d10 + 1d8) = 3 disponibles
      hitDiceUsedByDie: { d10: 1, d8: 1 },
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
    expect(shortWithDice.summary.hitDiceSpentByDie).toEqual({ d10: 1 });
    expect(shortWithDice.summary.hpRestored).toBe(8);
    expect(shortWithDice.patch.hitPoints).toEqual({
      hitDiceUsed: 3,
      hitDiceUsedByDie: { d10: 2, d8: 1 },
      current: 23,
    });

    // No permet gastar daus de mida aliena ni superar la reserva de classe o els disponibles per mida
    expect(() =>
      buildShortRestPatch(sheet, { hitDiceToSpend: [{ dieSize: 12, count: 1 }] })
    ).toThrow(/no disposa/);
    expect(() =>
      buildShortRestPatch(sheet, { hitDiceToSpend: [{ dieSize: 10, count: 4 }] })
    ).toThrow(/no disposa/);
    expect(() =>
      buildShortRestPatch(sheet, {
        hitDiceToSpend: [{ dieSize: 8, count: 2 }],
      })
    ).toThrow(/disponibles/);

    // Descans llarg sense incloure alba -> restaura PV, posa temp=0, salva mort, recupera floor(5/2)=2 daus, NO reinicia alba ni other
    const longDefault = buildLongRestPatch(sheet);
    expect(longDefault.patch.hitPoints).toEqual({
      current: 40,
      temporary: 0,
      deathSaves: { successes: 0, failures: 0 },
      hitDiceUsed: 0, // 2 gastats - min(2, floor(5/2)=2) = 0
      hitDiceUsedByDie: { d10: 0, d8: 0 },
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
            weaponAbilityOverride: null,
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
        weaponAbilityOverride: null,
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

  it('impedeix que el motor ni el jugador per PATCH alterin attacks.ability, attacks.proficient o atacs vinculats i distingeix tots els tipus d’atac', async () => {
    // 1. Defensa en profunditat al domini pur + rebuig Zod si arriben atacs il·legals
    const exploitSheet = createEmptyDnd5e2014Sheet('Explotador');
    exploitSheet.raceAndClass.classes = [{ classId: 'fighter', level: 5 }]; // prof +3
    exploitSheet.abilities = { str: 12, dex: 10, con: 14, int: 10, wis: 10, cha: 18 }; // +1 STR, +4 CHA
    exploitSheet.proficiencies.weapons = ['Armes senzilles']; // sense competència marcial ni espasa llarga
    exploitSheet.inventory = [
      {
        id: 'w-sword',
        name: 'Espasa llarga',
        category: 'weapon',
        quantity: 1,
        weight: 3,
        equipped: true,
        armorType: null,
        baseAc: null,
        acBonus: null,
        requiresAttunement: false,
        attuned: false,
        weaponAbility: null,
        weaponAbilityOverride: null,
        weaponProficient: false,
        damage: '1d8+1',
        damageType: 'tallant',
        weaponRange: 'Cos a cos (1,5 m)',
        weaponProperties: 'Versàtil (1d10)',
        notes: '',
      },
    ];
    exploitSheet.attacks = [
      {
        id: 'atk-bad-link',
        inventoryItemId: 'w-sword',
        kind: 'weapon_override',
        spellSourceClassId: null,
        name: 'Espasa amb Carisma fals',
        ability: 'cha',
        abilityOverride: null,
        proficient: true,
        proficientOverride: null,
        bonusOverride: null,
        attackBonus: null,
        damage: null,
        damageType: null,
        range: null,
        notes: '',
      },
      {
        id: 'atk-bad-special',
        inventoryItemId: null,
        kind: 'special',
        spellSourceClassId: null,
        name: 'Cop especial inflat',
        ability: 'cha',
        abilityOverride: null,
        proficient: true,
        proficientOverride: null,
        bonusOverride: null,
        attackBonus: null,
        damage: '2d6',
        damageType: 'força',
        range: '9 m',
        notes: '',
      },
    ];

    expect(dnd5e2014SheetSchema.safeParse(exploitSheet).success).toBe(false);
    const defenseSnap = computeDnd5e2014Sheet(exploitSheet);
    const swordAttack = defenseSnap.combat.attacks.find((a) => a.inventoryItemId === 'w-sword')!;
    // Mai usa 'cha' ni 'proficient: true' silenciosament: cau a oficial ('str', +1, no proficient)
    expect(swordAttack.ability).toBe('str');
    expect(swordAttack.isAbilityOverridden).toBe(false);
    expect(swordAttack.proficient).toBe(false);
    expect(swordAttack.proficiencySource).toBe('none');
    expect(swordAttack.attackBonus).toBe(1);

    const specialDefense = defenseSnap.combat.attacks.find((a) => a.id === 'atk-bad-special')!;
    expect(specialDefense.ability).toBeNull();
    expect(specialDefense.proficient).toBe(false);
    expect(specialDefense.attackBonus).toBeNull();

    // 2. Explotació real per servei / PATCH d'un jugador i excepcions del GM
    const { db, close } = await createTestDb();
    try {
      const admin = await bootstrapAdmin(db);
      const gm = await createInvitedGm(db, admin.ctx, 'gm.attacks@rol.test', 'GM Atacs');
      const camp = await createCampaign(db, gm.ctx, { name: 'Bastió', systemId: 'dnd5e-2014' });
      const inv = await createPlayerInvitation(db, gm.ctx, camp.id);
      const reg = await acceptPlayerInvitation(db, inv.rawToken, {
        mode: 'register',
        email: 'guerrer@rol.test',
        displayName: 'Bram',
        password: 'PlayerPassword123!',
      });
      const playerCtx = await resolveSession(db, reg.rawToken);

      const fighter = await createCharacterBase(db, playerCtx, camp.id, {
        name: 'Bram',
        sheetData: {
          raceAndClass: { classes: [{ classId: 'fighter', level: 5 }] }, // prof +3
          abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 18 }, // +3 STR, +2 DEX, +4 CHA
          proficiencies: { weapons: ['Estoc'] },
          inventory: [
            {
              id: 'w-sword',
              name: 'Espasa llarga',
              category: 'weapon',
              equipped: true,
              damage: '1d8+3',
              damageType: 'tallant',
            },
            {
              id: 'w-rapier',
              name: 'Estoc',
              category: 'weapon',
              equipped: true,
              damage: '1d8+2',
              damageType: 'perforant',
              weaponProperties: 'Sutil',
            },
          ],
        },
      });

      const cheatPatches = [
        // Atac vinculat a arma amb característica il·legal (CHA)
        {
          attacks: [
            { id: 'x1', inventoryItemId: 'w-sword', kind: 'weapon_override' as const, name: 'Espasa CHA', ability: 'cha' as const },
          ],
        },
        // Atac vinculat intentant concedir competència via `proficient`
        {
          attacks: [
            { id: 'x2', inventoryItemId: 'w-sword', kind: 'weapon_override' as const, name: 'Espasa prof', proficient: true },
          ],
        },
        // Cop desarmat amb DEX sent Guerrer (no Monjo)
        {
          attacks: [
            { id: 'x3', kind: 'unarmed' as const, name: 'Cop desarmat', ability: 'dex' as const },
          ],
        },
        // Atac especial intentant autoatribuir-se competència o característica
        {
          attacks: [{ id: 'x4', kind: 'special' as const, name: 'Alè', proficient: true }],
        },
        {
          attacks: [{ id: 'x5', kind: 'special' as const, name: 'Alè', ability: 'cha' as const }],
        },
        {
          attacks: [{ id: 'x6', kind: 'special' as const, name: 'Alè', abilityOverride: 'cha' as const }],
        },
        {
          attacks: [{ id: 'x7', kind: 'special' as const, name: 'Alè', proficientOverride: true }],
        },
        // Atac màgic sent Guerrer no-llançador
        {
          attacks: [{ id: 'x8', kind: 'spell' as const, name: 'Raig fals', ability: 'cha' as const, proficient: true }],
        },
        // Crear atac `gm_custom` des del jugador
        {
          attacks: [{ id: 'x9', kind: 'gm_custom' as const, name: 'Espasa divina', ability: 'cha' as const, proficient: true }],
        },
      ];

      for (const sheetPatch of cheatPatches) {
        await expect(
          updateCharacterBase(db, playerCtx, camp.id, fighter.id, { sheetPatch })
        ).rejects.toMatchObject({ status: 403, code: 'OFFICIAL_CALCULATION_PROTECTED' });
      }

      // Jugador pot canviar finesse (Estoc) entre STR (+6) i DEX (+5) lliurement, però no a CHA
      const currentSnap = await getCampaignCharacter(db, playerCtx, camp.id, fighter.id);
      const currentSheet = normalizeDnd5e2014Sheet(currentSnap.sheetData, 'Bram');
      const finesseStr = await updateCharacterBase(db, playerCtx, camp.id, fighter.id, {
        sheetPatch: {
          inventory: currentSheet.inventory.map((i) =>
            i.id === 'w-rapier' ? { ...i, weaponAbility: 'str' } : i
          ),
        },
      });
      expect(finesseStr.computed.combat.attacks.find((a) => a.inventoryItemId === 'w-rapier')?.ability).toBe('str');
      expect(finesseStr.computed.combat.attacks.find((a) => a.inventoryItemId === 'w-rapier')?.attackBonus).toBe(6);

      const finesseDex = await updateCharacterBase(db, playerCtx, camp.id, fighter.id, {
        sheetPatch: {
          inventory: currentSheet.inventory.map((i) =>
            i.id === 'w-rapier' ? { ...i, weaponAbility: 'dex' } : i
          ),
        },
      });
      expect(finesseDex.computed.combat.attacks.find((a) => a.inventoryItemId === 'w-rapier')?.ability).toBe('dex');
      expect(finesseDex.computed.combat.attacks.find((a) => a.inventoryItemId === 'w-rapier')?.attackBonus).toBe(5);

      await expect(
        updateCharacterBase(db, playerCtx, camp.id, fighter.id, {
          sheetPatch: {
            inventory: currentSheet.inventory.map((i) =>
              i.id === 'w-rapier' ? { ...i, weaponAbility: 'cha' } : i
            ),
          },
        })
      ).rejects.toMatchObject({ status: 403, code: 'OFFICIAL_CALCULATION_PROTECTED' });

      // Jugador pot crear atacs manuals legítims: `unarmed` (amb STR i competència oficial), `special` descriptiu i `spell` (en un llançador)
      const withLegitManual = await updateCharacterBase(db, playerCtx, camp.id, fighter.id, {
        sheetPatch: {
          attacks: [
            { id: 'u1', kind: 'unarmed', name: 'Cop desarmat', ability: 'str', damage: '1+3', damageType: 'contundent' },
            { id: 'sp1', kind: 'special', name: 'Crit intimidatori', damage: '—', notes: 'Efecte narratiu' },
          ],
        },
      });
      const unarmedAtk = withLegitManual.computed.combat.attacks.find((a) => a.id === 'u1')!;
      expect(unarmedAtk.attackKind).toBe('unarmed');
      expect(unarmedAtk.proficient).toBe(true);
      expect(unarmedAtk.proficiencySource).toBe('unarmed_official');
      expect(unarmedAtk.attackBonus).toBe(6); // +3 STR +3 prof

      const specAtk = withLegitManual.computed.combat.attacks.find((a) => a.id === 'sp1')!;
      expect(specAtk.attackKind).toBe('special');
      expect(specAtk.proficient).toBe(false);
      expect(specAtk.attackBonus).toBeNull();

      // Personatge Mag pot afegir atac màgic legítim (calcula INT + competència oficial)
      const mage = await createCharacterBase(db, playerCtx, camp.id, {
        name: 'Elara',
        sheetData: {
          raceAndClass: { classes: [{ classId: 'wizard', level: 5 }] },
          abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 10, cha: 10 },
          attacks: [{ id: 'm1', kind: 'spell', spellSourceClassId: 'wizard', name: 'Raig de foc', damage: '2d10', damageType: 'foc' }],
        },
      });
      const spellAtk = mage.computed.combat.attacks.find((a) => a.id === 'm1')!;
      expect(spellAtk.attackKind).toBe('spell');
      expect(spellAtk.ability).toBe('int');
      expect(spellAtk.proficient).toBe(true);
      expect(spellAtk.proficiencySource).toBe('spellcasting_official');
      expect(spellAtk.attackBonus).toBe(7); // +4 INT +3 prof

      // El GM pot concedir excepcions explícites: CHA a l'Espasa llarga + competència + gm_custom
      const afterGm = await updateCharacterBase(db, gm.ctx, camp.id, fighter.id, {
        sheetPatch: {
          inventory: currentSheet.inventory.map((i) =>
            i.id === 'w-sword'
              ? { ...i, weaponAbilityOverride: 'cha', weaponProficient: true }
              : i
          ),
          attacks: [
            { id: 'u1', kind: 'unarmed', name: 'Cop desarmat', ability: 'str', damage: '1+3', damageType: 'contundent' },
            { id: 'gm1', kind: 'gm_custom', name: 'Raig del pacte ocult', abilityOverride: 'cha', proficientOverride: true, damage: '3d8', damageType: 'radiant' },
          ],
        },
        fieldPermissions: {
          authorizedOverrideFields: ['attacks.ability'],
        },
      });
      const gmSword = afterGm.computed.combat.attacks.find((a) => a.inventoryItemId === 'w-sword')!;
      expect(gmSword.ability).toBe('cha');
      expect(gmSword.isAbilityOverridden).toBe(true);
      expect(gmSword.proficiencySource).toBe('gm_exception');
      expect(gmSword.attackBonus).toBe(7); // +4 CHA +3 prof

      const gmCustom = afterGm.computed.combat.attacks.find((a) => a.id === 'gm1')!;
      expect(gmCustom.attackKind).toBe('gm_custom');
      expect(gmCustom.attackBonus).toBe(7);

      // Si el GM autoritza `attacks.ability`, el jugador pot ajustar `abilityOverride` en un atac seu, però NO `attacks.proficient` ni `gm_custom`
      const updatedAuthAbility = await updateCharacterBase(db, playerCtx, camp.id, fighter.id, {
        sheetPatch: {
          attacks: [
            { id: 'u1', kind: 'unarmed', name: 'Cop desarmat', abilityOverride: 'cha', damage: '1+3', damageType: 'contundent' },
            { id: 'gm1', kind: 'gm_custom', name: 'Raig del pacte ocult', abilityOverride: 'cha', proficientOverride: true, damage: '3d8', damageType: 'radiant' },
          ],
        },
      });
      expect(updatedAuthAbility.computed.combat.attacks.find((a) => a.id === 'u1')?.ability).toBe('cha');

      await expect(
        updateCharacterBase(db, playerCtx, camp.id, fighter.id, {
          sheetPatch: {
            attacks: [
              { id: 'u1', kind: 'unarmed', name: 'Cop desarmat', ability: 'str', proficientOverride: false },
              { id: 'gm1', kind: 'gm_custom', name: 'Raig del pacte ocult', abilityOverride: 'cha', proficientOverride: true, damage: '3d8', damageType: 'radiant' },
            ],
          },
        })
      ).rejects.toMatchObject({ status: 403, code: 'OFFICIAL_CALCULATION_PROTECTED' });
    } finally {
      await close();
    }
  });

  it('controla daus de cop per mida (d6, d8, d10, d12) en multiclasse i normalitza fitxes antigues sense inventar dades', async () => {
    // 1. Multiclasse amb les 4 mides: Guerrer 3 (d10) + Bruixot Pacte 2 (d8) + Bruixot Innat 1 (d6) + Bàrbar 2 (d12) = 8 totals
    const multi = createEmptyDnd5e2014Sheet('Varian Multi');
    multi.raceAndClass.classes = [
      { classId: 'fighter', level: 3 },
      { classId: 'warlock', level: 2 },
      { classId: 'sorcerer', level: 1 },
      { classId: 'barbarian', level: 2 },
    ];
    multi.abilities = { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 16 }; // +2 CON
    multi.hitPoints = {
      max: 70,
      current: 30,
      temporary: 0,
      hitDice: null,
      hitDiceUsed: 3,
      hitDiceUsedByDie: { d10: 2, d8: 1 },
      deathSaves: { successes: 0, failures: 0 },
    };

    const snapBefore = computeDnd5e2014Sheet(multi);
    expect(snapBefore.combat.hitDicePool).toMatchObject({
      display: '3d10 + 2d8 + 1d6 + 2d12',
      total: 8,
      used: 3,
      available: 5,
      hasUnallocatedLegacyUsage: false,
      byDie: [
        { dieSize: 6, dieKey: 'd6', total: 1, used: 0, available: 1 },
        { dieSize: 8, dieKey: 'd8', total: 2, used: 1, available: 1 },
        { dieSize: 10, dieKey: 'd10', total: 3, used: 2, available: 1 },
        { dieSize: 12, dieKey: 'd12', total: 2, used: 0, available: 2 },
      ],
    });

    // Descans curt rebutja gastar 2d10 perquè només en queda 1 disponible (tot i que queden 5 daus en total)
    expect(() =>
      buildShortRestPatch(multi, { hitDiceToSpend: [{ dieSize: 10, count: 2 }] })
    ).toThrow(/Només tens 1 dau\(s\) d10 disponibles/);

    // Descans curt gastant 1d6 + 1d12 (tirades 4+2=6 i 8+2=10 => +16 PV)
    const shortRes = buildShortRestPatch(multi, {
      hitDiceToSpend: [
        { dieSize: 6, count: 1, rolls: [4] },
        { dieSize: 12, count: 1, rolls: [8] },
      ],
    });
    expect(shortRes.summary.hitDiceSpentByDie).toEqual({ d6: 1, d12: 1 });
    expect(shortRes.summary.hpRestored).toBe(16);
    expect(shortRes.patch.hitPoints).toEqual({
      hitDiceUsed: 5,
      hitDiceUsedByDie: { d10: 2, d8: 1, d6: 1, d12: 1 },
      current: 46,
    });

    // Descans llarg sobre els 5 gastats (allowance = floor(8/2) = 4): recupera d12(1), d10(2), d8(1) i deixa d6: 1
    const afterShort = normalizeDnd5e2014Sheet(
      { ...multi, hitPoints: { ...multi.hitPoints, ...shortRes.patch.hitPoints } },
      'Varian Multi'
    );
    const longDefault = buildLongRestPatch(afterShort);
    expect(longDefault.summary.hitDiceRecovered).toBe(4);
    expect(longDefault.summary.hitDiceRecoveredByDie).toEqual({ d12: 1, d10: 2, d8: 1 });
    expect(longDefault.patch.hitPoints?.hitDiceUsed).toBe(1);
    expect(longDefault.patch.hitPoints?.hitDiceUsedByDie).toEqual({ d6: 1, d12: 0, d10: 0, d8: 0 });

    // Selecció explícita de recuperació en descans llarg i validació d'excés
    const longExplicit = buildLongRestPatch(afterShort, {
      hitDiceToRecover: { d10: 2, d6: 1, d8: 1 },
    });
    expect(longExplicit.summary.hitDiceRecovered).toBe(4);
    expect(longExplicit.patch.hitPoints?.hitDiceUsedByDie).toEqual({ d12: 1, d10: 0, d6: 0, d8: 0 });
    expect(() =>
      buildLongRestPatch(afterShort, { hitDiceToRecover: { d12: 2 } })
    ).toThrow(/només se n’havien gastat 1/);

    // 2. Normalització i descansos amb fitxes antigues a BD (sense inventar dades multiclasse)
    const { db, close } = await createTestDb();
    try {
      const admin = await bootstrapAdmin(db);
      const gm = await createInvitedGm(db, admin.ctx, 'gm.hd@rol.test', 'GM HitDice');
      const camp = await createCampaign(db, gm.ctx, { name: 'Valors', systemId: 'dnd5e-2014' });
      const inv = await createPlayerInvitation(db, gm.ctx, camp.id);
      const reg = await acceptPlayerInvitation(db, inv.rawToken, {
        mode: 'register',
        email: 'hd.player@rol.test',
        displayName: 'Nora',
        password: 'PlayerPassword123!',
      });
      const playerCtx = await resolveSession(db, reg.rawToken);

      // Fitxa antiga monoclasse (Clergue 4, hitDiceUsed: 2, sense hitDiceUsedByDie) -> infereix { d8: 2 } sense ambigüitat
      const [legacySingle] = await db
        .insert(characters)
        .values({
          campaignId: camp.id,
          memberId: reg.memberId,
          systemId: 'dnd5e-2014',
          name: 'Clergue Antic',
          schemaVersion: 2,
          sheetData: {
            generalInfo: { name: 'Clergue Antic' },
            raceAndClass: { classes: [{ classId: 'cleric', level: 4 }] },
            hitPoints: { max: 32, current: 20, hitDiceUsed: 2 },
          },
          customFields: {},
          fieldPermissions: {},
          gmNotes: '',
        })
        .returning();

      const loadedSingle = await getCampaignCharacter(db, playerCtx, camp.id, legacySingle.id);
      expect(loadedSingle.computed.combat.hitDicePool.hasUnallocatedLegacyUsage).toBe(false);
      expect(loadedSingle.computed.combat.hitDicePool.byDie[0]).toMatchObject({
        dieSize: 8,
        total: 4,
        used: 2,
        available: 2,
      });

      // Fitxa antiga multiclasse mides mixtes (Guerrer 3 d10 + Mag 2 d6, hitDiceUsed: 3) -> manté hitDiceUsedByDie: null
      const [legacyMulti] = await db
        .insert(characters)
        .values({
          campaignId: camp.id,
          memberId: reg.memberId,
          systemId: 'dnd5e-2014',
          name: 'Espasamag Antic',
          schemaVersion: 2,
          sheetData: {
            generalInfo: { name: 'Espasamag Antic' },
            raceAndClass: {
              classes: [
                { classId: 'fighter', level: 3 },
                { classId: 'wizard', level: 2 },
              ],
            },
            abilities: { str: 14, dex: 12, con: 14, int: 16, wis: 10, cha: 10 },
            hitPoints: { max: 36, current: 15, hitDiceUsed: 3 },
          },
          customFields: {},
          fieldPermissions: {},
          gmNotes: '',
        })
        .returning();

      const loadedLegacyMulti = await getCampaignCharacter(db, playerCtx, camp.id, legacyMulti.id);
      expect((loadedLegacyMulti.sheetData.hitPoints as Record<string, unknown>).hitDiceUsedByDie).toBeNull();
      expect(loadedLegacyMulti.computed.combat.hitDicePool).toMatchObject({
        total: 5,
        used: 3,
        available: 2,
        hasUnallocatedLegacyUsage: true,
        unallocatedUsed: 3,
      });

      // Descans curt gasta 1d10 sense inventar `hitDiceUsedByDie` i persisteix hitDiceUsed: 4
      const normalizedLegacyMulti = normalizeDnd5e2014Sheet(
        loadedLegacyMulti.sheetData,
        'Espasamag Antic'
      );
      const legacyShort = buildShortRestPatch(normalizedLegacyMulti, {
        hitDiceToSpend: [{ dieSize: 10, count: 1, rolls: [7] }],
      });
      const afterShortDb = await updateCharacterBase(db, playerCtx, camp.id, legacyMulti.id, {
        sheetPatch: legacyShort.patch,
      });
      expect((afterShortDb.sheetData.hitPoints as Record<string, unknown>).hitDiceUsed).toBe(4);
      expect((afterShortDb.sheetData.hitPoints as Record<string, unknown>).hitDiceUsedByDie).toBeNull();

      // Dos descansos llargs (allowance = floor(5/2) = 2 cadascun): 4 -> 2 (encara null) -> 0 (gradua a {})
      const sheetAfterShort = normalizeDnd5e2014Sheet(afterShortDb.sheetData, 'Espasamag Antic');
      const long1 = buildLongRestPatch(sheetAfterShort);
      const afterLong1Db = await updateCharacterBase(db, playerCtx, camp.id, legacyMulti.id, {
        sheetPatch: long1.patch,
      });
      expect((afterLong1Db.sheetData.hitPoints as Record<string, unknown>).hitDiceUsed).toBe(2);
      expect((afterLong1Db.sheetData.hitPoints as Record<string, unknown>).hitDiceUsedByDie).toBeNull();

      const sheetAfterLong1 = normalizeDnd5e2014Sheet(afterLong1Db.sheetData, 'Espasamag Antic');
      const long2 = buildLongRestPatch(sheetAfterLong1);
      const afterLong2Db = await updateCharacterBase(db, playerCtx, camp.id, legacyMulti.id, {
        sheetPatch: long2.patch,
      });
      expect((afterLong2Db.sheetData.hitPoints as Record<string, unknown>).hitDiceUsed).toBe(0);
      expect((afterLong2Db.sheetData.hitPoints as Record<string, unknown>).hitDiceUsedByDie).toEqual({});
    } finally {
      await close();
    }
  });

  it('suporta overrides de màgia per classe en multiclasse amb retrocompatibilitat global i protecció del servidor', async () => {
    const { db, close } = await createTestDb();
    try {
      const admin = await bootstrapAdmin(db);
      const gm = await createInvitedGm(db, admin.ctx, 'gm.sc@rol.test', 'GM Màgia');
      const camp = await createCampaign(db, gm.ctx, { name: 'Arcànum', systemId: 'dnd5e-2014' });
      const inv = await createPlayerInvitation(db, gm.ctx, camp.id);
      const reg = await acceptPlayerInvitation(db, inv.rawToken, {
        mode: 'register',
        email: 'teurg@rol.test',
        displayName: 'Alara',
        password: 'PlayerPassword123!',
      });
      const playerCtx = await resolveSession(db, reg.rawToken);

      // Un jugador no pot definir `spellcasting.sourceOverrides` en creació ni en PATCH
      await expect(
        createCharacterBase(db, playerCtx, camp.id, {
          name: 'Trampós SourceOverride',
          sheetData: {
            raceAndClass: { classes: [{ classId: 'cleric', level: 3 }] },
            spellcasting: { sourceOverrides: { cleric: { saveDcOverride: 20 } } },
          },
        })
      ).rejects.toMatchObject({ status: 403, code: 'OFFICIAL_CALCULATION_PROTECTED' });

      const multiCaster = await createCharacterBase(db, playerCtx, camp.id, {
        name: 'Alara',
        sheetData: {
          raceAndClass: {
            classes: [
              { classId: 'cleric', level: 3 },
              { classId: 'wizard', level: 2 },
            ],
          },
          abilities: { str: 10, dex: 12, con: 14, int: 18, wis: 14, cha: 16 }, // +4 INT, +2 WIS, +3 CHA, prof +3
          attacks: [
            { id: 'sp-cleric', kind: 'spell', spellSourceClassId: 'cleric', name: 'Flama sagrada / Guiatge', damage: '4d6', damageType: 'radiant' },
            { id: 'sp-wizard', kind: 'spell', spellSourceClassId: 'wizard', name: 'Raig de gel', damage: '2d8', damageType: 'fred' },
          ],
        },
      });

      await expect(
        updateCharacterBase(db, playerCtx, camp.id, multiCaster.id, {
          sheetPatch: {
            spellcasting: { sourceOverrides: { wizard: { attackBonusOverride: 15 } } },
          },
        })
      ).rejects.toMatchObject({ status: 403, code: 'OFFICIAL_CALCULATION_PROTECTED' });

      // El GM aplica override específic NOMÉS a Clergue (CHA + CD 17 + atac +9); el Mag conserva INT oficial
      const gmOverridden = await updateCharacterBase(db, gm.ctx, camp.id, multiCaster.id, {
        sheetPatch: {
          spellcasting: {
            sourceOverrides: {
              cleric: { abilityOverride: 'cha', saveDcOverride: 17, attackBonusOverride: 9 },
            },
          },
        },
      });

      const clericSrc = gmOverridden.computed.spellcasting!.sources.find((s) => s.classId === 'cleric')!;
      const wizardSrc = gmOverridden.computed.spellcasting!.sources.find((s) => s.classId === 'wizard')!;

      expect(clericSrc.ability).toBe('cha');
      expect(clericSrc.saveDc).toBe(17);
      expect(clericSrc.attackBonus).toBe(9);
      expect(clericSrc.preparedLimit).toBe(6); // +3 CHA + 3 nivells de clergue

      expect(wizardSrc.ability).toBe('int');
      expect(wizardSrc.saveDc).toBe(15); // 8 + 3 prof + 4 INT
      expect(wizardSrc.attackBonus).toBe(7); // 3 prof + 4 INT
      expect(wizardSrc.preparedLimit).toBe(6); // +4 INT + 2 nivells de mag

      expect(gmOverridden.computed.combat.attacks.find((a) => a.id === 'sp-cleric')).toMatchObject({
        ability: 'cha',
        attackBonus: 9,
      });
      expect(gmOverridden.computed.combat.attacks.find((a) => a.id === 'sp-wizard')).toMatchObject({
        ability: 'int',
        attackBonus: 7,
      });

      // Retrocompatibilitat: un override global sense `sourceOverrides` continua aplicant-se a totes les fonts
      const globalFallback = await updateCharacterBase(db, gm.ctx, camp.id, multiCaster.id, {
        sheetPatch: {
          spellcasting: {
            abilityOverride: 'cha',
            sourceOverrides: { cleric: null },
          },
        },
      });
      expect(globalFallback.computed.spellcasting?.sources.every((s) => s.ability === 'cha')).toBe(
        true
      );
    } finally {
      await close();
    }
  });
});
