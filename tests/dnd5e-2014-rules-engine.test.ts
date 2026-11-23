import { describe, expect, it } from 'vitest';
import {
  DND5E_SKILLS,
  calculateAbilityModifier,
  calculateProficiencyBonus,
  computeDnd5e2014Sheet,
  createEmptyDnd5e2014Sheet,
  normalizeDnd5e2014Sheet,
  resolveRollMode,
  rollD20Check,
} from '@/domain/systems/dnd5e-2014';

describe('Motor de regles D&D 5e (2014)', () => {
  it('calcula correctament tots sis modificadors de característiques i casos null', () => {
    expect(calculateAbilityModifier(null)).toBeNull();
    expect(calculateAbilityModifier(1)).toBe(-5);
    expect(calculateAbilityModifier(8)).toBe(-1);
    expect(calculateAbilityModifier(9)).toBe(-1);
    expect(calculateAbilityModifier(10)).toBe(0);
    expect(calculateAbilityModifier(11)).toBe(0);
    expect(calculateAbilityModifier(14)).toBe(2);
    expect(calculateAbilityModifier(17)).toBe(3);
    expect(calculateAbilityModifier(20)).toBe(5);
    expect(calculateAbilityModifier(30)).toBe(10);

    const sheet = createEmptyDnd5e2014Sheet('Tordek');
    sheet.abilities = { str: 16, dex: 12, con: 15, int: 8, wis: 13, cha: 10 };
    const snap = computeDnd5e2014Sheet(sheet);

    expect(snap.abilities.str.modifier).toBe(3);
    expect(snap.abilities.dex.modifier).toBe(1);
    expect(snap.abilities.con.modifier).toBe(2);
    expect(snap.abilities.int.modifier).toBe(-1);
    expect(snap.abilities.wis.modifier).toBe(1);
    expect(snap.abilities.cha.modifier).toBe(0);
  });

  it('calcula la bonificació de competència oficial 2014 (1–20) i respecta el límit de nivell 20', () => {
    const expected: Array<[number, number]> = [
      [1, 2],
      [4, 2],
      [5, 3],
      [8, 3],
      [9, 4],
      [12, 4],
      [13, 5],
      [16, 5],
      [17, 6],
      [20, 6],
      // No extrapola per damunt de nivell 20 en regles oficials 2014
      [21, 6],
      [25, 6],
    ];
    for (const [lvl, bonus] of expected) {
      expect(calculateProficiencyBonus(lvl)).toBe(bonus);
    }

    const highLevelSheet = createEmptyDnd5e2014Sheet('Valeria');
    highLevelSheet.raceAndClass.classes = [{ classId: 'fighter', subclassId: 'battle-master', level: 15 }];
    highLevelSheet.progression.experiencePoints = 175000;
    const snap15 = computeDnd5e2014Sheet(highLevelSheet);

    expect(snap15.totalLevel).toBe(15);
    expect(snap15.proficiencyBonus).toBe(5);
    expect(snap15.progression.isMaxLevel).toBe(false);
    expect(snap15.progression.nextLevel).toBe(16);
    expect(snap15.progression.nextLevelXp).toBe(195000);
    expect(snap15.progression.xpToNextLevel).toBe(20000);
    expect(snap15.progression.unlockedAsiCount).toBe(5); // Fighter ASIs: 4, 6, 8, 12, 14

    highLevelSheet.raceAndClass.classes = [{ classId: 'wizard', subclassId: 'evocation', level: 20 }];
    highLevelSheet.progression.experiencePoints = 355000;
    const snap20 = computeDnd5e2014Sheet(highLevelSheet);
    expect(snap20.totalLevel).toBe(20);
    expect(snap20.proficiencyBonus).toBe(6);
    expect(snap20.progression.isMaxLevel).toBe(true);
    expect(snap20.progression.nextLevel).toBeNull();
    expect(snap20.progression.nextLevelXp).toBeNull();
    expect(snap20.progression.xpToNextLevel).toBeNull();
    expect(snap20.progression.progressPercent).toBe(100);

    // Fins i tot si una fitxa antiga o corrupta tingués nivell > 20, el motor l'acota a 20
    highLevelSheet.raceAndClass.classes = [{ classId: 'wizard', subclassId: 'evocation', level: 22 }];
    const snapClamped = computeDnd5e2014Sheet(highLevelSheet);
    expect(snapClamped.totalLevel).toBe(20);
    expect(snapClamped.proficiencyBonus).toBe(6);
    expect(snapClamped.progression.isMaxLevel).toBe(true);
  });

  it('calcula les 18 habilitats i les 6 salvacions diferenciant competència, expertesa i excepcions', () => {
    const sheet = createEmptyDnd5e2014Sheet('Vex');
    sheet.raceAndClass.classes = [{ classId: 'rogue', subclassId: 'thief', level: 5 }]; // prof +3
    sheet.abilities = { str: 10, dex: 18, con: 12, int: 14, wis: 12, cha: 16 };
    sheet.savingThrows.proficient = ['dex', 'int'];
    sheet.savingThrows.overrides = { wis: 5 };
    sheet.skills.proficient = ['acrobatics', 'perception', 'persuasion'];
    sheet.skills.expertise = ['stealth']; // 2 * prof (+6)
    sheet.skills.halfProficient = true; // +1 (floor(3/2)) on non-proficient skills
    sheet.skills.overrides = { investigation: 10 };

    const snap = computeDnd5e2014Sheet(sheet);

    expect(snap.skills).toHaveLength(18);
    expect(DND5E_SKILLS).toHaveLength(18);
    expect(snap.savingThrows).toHaveLength(6);

    const bySkill = new Map(snap.skills.map((s) => [s.id, s]));
    const bySave = new Map(snap.savingThrows.map((s) => [s.ability, s]));

    // Saves
    expect(bySave.get('dex')?.proficient).toBe(true);
    expect(bySave.get('dex')?.total).toBe(7); // +4 dex +3 prof
    expect(bySave.get('str')?.proficient).toBe(false);
    expect(bySave.get('str')?.total).toBe(0);
    expect(bySave.get('wis')?.total).toBe(5); // override

    // Skills
    expect(bySkill.get('stealth')?.proficiencyLevel).toBe('expertise');
    expect(bySkill.get('stealth')?.total).toBe(10); // +4 dex +6 expertise
    expect(bySkill.get('perception')?.proficiencyLevel).toBe('proficient');
    expect(bySkill.get('perception')?.total).toBe(4); // +1 wis +3 prof
    expect(bySkill.get('athletics')?.proficiencyLevel).toBe('half');
    expect(bySkill.get('athletics')?.total).toBe(1); // +0 str +1 half
    expect(bySkill.get('investigation')?.total).toBe(10); // override
    expect(snap.passives.perception).toBe(14);
  });

  it('aplica avantatge, desavantatge i cancel·lació mútua segons D&D 5e 2014', () => {
    expect(resolveRollMode({ explicitMode: 'advantage' })).toBe('advantage');
    expect(resolveRollMode({ explicitMode: 'disadvantage' })).toBe('disadvantage');
    expect(resolveRollMode({ explicitMode: 'normal' })).toBe('normal');
    // 1v1 and 3v1 cancel out strictly to 'normal'
    expect(resolveRollMode({ advantageSources: 1, disadvantageSources: 1 })).toBe('normal');
    expect(resolveRollMode({ advantageSources: 3, disadvantageSources: 1 })).toBe('normal');
    expect(
      resolveRollMode({ explicitMode: 'advantage', disadvantageSources: 1 })
    ).toBe('normal');

    // Deterministic RNG returning 0.15 (-> 4) then 0.85 (-> 18)
    const seq = [0.15, 0.85];
    let idx = 0;
    const advRoll = rollD20Check({
      modifier: 5,
      mode: 'advantage',
      rng: () => seq[idx++],
    });
    expect(advRoll.mode).toBe('advantage');
    expect(advRoll.dice).toEqual([4, 18]);
    expect(advRoll.keptDie).toBe(18);
    expect(advRoll.discardedDie).toBe(4);
    expect(advRoll.total).toBe(23);

    idx = 0;
    const disRoll = rollD20Check({
      modifier: 5,
      mode: 'disadvantage',
      rng: () => seq[idx++],
    });
    expect(disRoll.mode).toBe('disadvantage');
    expect(disRoll.dice).toEqual([4, 18]);
    expect(disRoll.keptDie).toBe(4);
    expect(disRoll.discardedDie).toBe(18);
    expect(disRoll.total).toBe(9);

    idx = 0;
    const cancelledRoll = rollD20Check({
      modifier: 5,
      mode: 'advantage',
      disadvantageSources: 1,
      rng: () => seq[idx++],
    });
    expect(cancelledRoll.mode).toBe('normal');
    expect(cancelledRoll.dice).toEqual([4]);
    expect(cancelledRoll.discardedDie).toBeNull();
    expect(cancelledRoll.total).toBe(9);

    // D&D 5e (2014): 20 natural / 1 natural només són crítics en tirades d'atac, NO en habilitats ni salvacions
    const nat20Skill = rollD20Check({
      modifier: 3,
      checkType: 'skill',
      rng: () => 0.99, // 20
    });
    expect(nat20Skill.keptDie).toBe(20);
    expect(nat20Skill.isNatural20).toBe(true);
    expect(nat20Skill.isCriticalHit).toBe(false);
    expect(nat20Skill.total).toBe(23);

    const nat1Save = rollD20Check({
      modifier: 6,
      checkType: 'saving_throw',
      rng: () => 0.0, // 1
    });
    expect(nat1Save.keptDie).toBe(1);
    expect(nat1Save.isNatural1).toBe(true);
    expect(nat1Save.isCriticalMiss).toBe(false);
    expect(nat1Save.total).toBe(7);

    const nat20AbilityDefault = rollD20Check({
      modifier: 2,
      rng: () => 0.99, // 20
    });
    expect(nat20AbilityDefault.checkType).toBe('ability');
    expect(nat20AbilityDefault.isNatural20).toBe(true);
    expect(nat20AbilityDefault.isCriticalHit).toBe(false);

    const critAttack = rollD20Check({
      modifier: 5,
      checkType: 'attack',
      rng: () => 0.99, // 20
    });
    expect(critAttack.isNatural20).toBe(true);
    expect(critAttack.isCriticalHit).toBe(true);
    expect(critAttack.isCriticalMiss).toBe(false);

    const fumbleAttack = rollD20Check({
      modifier: 5,
      checkType: 'attack',
      rng: () => 0.0, // 1
    });
    expect(fumbleAttack.isNatural1).toBe(true);
    expect(fumbleAttack.isCriticalMiss).toBe(true);
    expect(fumbleAttack.isCriticalHit).toBe(false);
  });

  it('calcula classe d’armadura i màgia segons equipament, fórmules i classe', () => {
    const barbarian = createEmptyDnd5e2014Sheet('Grog');
    barbarian.raceAndClass.classes = [{ classId: 'barbarian', level: 4 }];
    barbarian.abilities = { str: 18, dex: 14, con: 16, int: 8, wis: 10, cha: 8 };
    barbarian.armorClass.unarmoredFormula = 'barbarian';
    barbarian.inventory = [
      {
        id: 's1',
        name: 'Escut de fusta',
        category: 'shield',
        quantity: 1,
        weight: 6,
        equipped: true,
        armorType: null,
        baseAc: null,
        acBonus: 2,
        notes: '',
      },
    ];
    const barbSnap = computeDnd5e2014Sheet(barbarian);
    expect(barbSnap.combat.armorClass.value).toBe(17); // 10 + 2 dex + 3 con + 2 shield
    expect(barbSnap.spellcasting).toBeNull();

    // Medium armor caps DEX at +2
    const cleric = createEmptyDnd5e2014Sheet('Jester');
    cleric.raceAndClass.classes = [{ classId: 'cleric', subclassId: 'life-domain', level: 5 }];
    cleric.abilities = { str: 12, dex: 18, con: 14, int: 10, wis: 18, cha: 12 };
    cleric.inventory = [
      {
        id: 'a1',
        name: 'Cota d’escames',
        category: 'armor',
        quantity: 1,
        weight: 45,
        equipped: true,
        armorType: 'medium',
        baseAc: 14,
        acBonus: 0,
        notes: '',
      },
    ];
    const clericSnap = computeDnd5e2014Sheet(cleric);
    expect(clericSnap.combat.armorClass.value).toBe(16); // 14 + min(2, +4)
    expect(clericSnap.spellcasting?.ability).toBe('wis');
    expect(clericSnap.spellcasting?.saveDc).toBe(15); // 8 + 3 + 4
    expect(clericSnap.spellcasting?.attackBonus).toBe(7); // 3 + 4
    expect(clericSnap.spellcasting?.slots.map((s) => s.total)).toEqual([4, 3, 2]);
  });

  it('genera recursos diferents segons classe, subclasse i nivell i no inclou dades de Pim per defecte', () => {
    const empty = createEmptyDnd5e2014Sheet('Aventurer Neutre');
    expect(empty.raceAndClass.classes).toEqual([]);
    expect(empty.generalInfo.name).toBe('Aventurer Neutre');
    expect(JSON.stringify(empty)).not.toContain('Pim');
    expect(computeDnd5e2014Sheet(empty).resources).toEqual([]);

    // Bàrbar nivell 3 vs nivell 20 (Ira il·limitada)
    const barb = createEmptyDnd5e2014Sheet('Kael');
    barb.raceAndClass.classes = [{ classId: 'barbarian', level: 3 }];
    const barb3 = computeDnd5e2014Sheet(barb).resources;
    expect(barb3.map((r) => r.name)).toEqual(['Ira']);
    expect(barb3[0].totalUses).toBe(3);

    barb.raceAndClass.classes = [{ classId: 'barbarian', level: 20 }];
    const barb20 = computeDnd5e2014Sheet(barb).resources;
    expect(barb20[0].unlimited).toBe(true);

    // Monjo nivell 5 -> 5 punts de Ki (res de druida ni bàrbar)
    const monk = createEmptyDnd5e2014Sheet('Shen');
    monk.raceAndClass.classes = [{ classId: 'monk', subclassId: 'open-hand', level: 5 }];
    const monkRes = computeDnd5e2014Sheet(monk).resources;
    expect(monkRes.map((r) => r.name)).toEqual(['Punts de Ki']);
    expect(monkRes[0].totalUses).toBe(5);

    // Guerrer Mestre de Batalla nivell 5
    const fighter = createEmptyDnd5e2014Sheet('Aric');
    fighter.raceAndClass.classes = [{ classId: 'fighter', subclassId: 'battle-master', level: 5 }];
    const fighterRes = computeDnd5e2014Sheet(fighter).resources;
    expect(fighterRes.map((r) => r.name)).toEqual([
      'Segon alè',
      'Acció sobtada',
      'Daus de superioritat',
    ]);

    // Druida Cercle de la Lluna vs Cercle de les Estrelles
    const moonDruid = createEmptyDnd5e2014Sheet('Selene');
    moonDruid.raceAndClass.classes = [{ classId: 'druid', subclassId: 'circle-of-the-moon', level: 4 }];
    expect(computeDnd5e2014Sheet(moonDruid).resources.map((r) => r.name)).toEqual(['Forma salvatge']);

    const starDruid = createEmptyDnd5e2014Sheet('Lyra');
    starDruid.raceAndClass.classes = [{ classId: 'druid', subclassId: 'circle-of-stars', level: 5 }];
    expect(computeDnd5e2014Sheet(starDruid).resources.map((r) => r.name)).toEqual([
      'Forma salvatge',
      'Forma estel·lar',
      'Mapa estel·lar (Guia / Raig traçador)',
    ]);
  });

  it('migra netament fitxes v1 a v2 sense perdre dades existents', () => {
    const legacyV1 = {
      generalInfo: { name: 'Eldrin', appearanceNotes: 'Capa blava' },
      raceAndClass: {
        race: 'Elf',
        classes: [{ name: 'Wizard', subclass: 'Evocació', level: 7 }],
      },
      abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 13, cha: 10 },
      spellSlots: { '1': { total: 4, used: 2 }, '2': { total: 3, used: 1 } },
      background: { backstory: 'Antic aprenent.' },
    };

    const normalized = normalizeDnd5e2014Sheet(legacyV1, 'Eldrin');
    expect(normalized.raceAndClass.classes[0].classId).toBe('wizard');
    expect(normalized.raceAndClass.classes[0].level).toBe(7);
    expect(normalized.spellSlotsUsed).toEqual({ '1': 2, '2': 1 });

    const snap = computeDnd5e2014Sheet(normalized);
    expect(snap.spellcasting?.usesSpellbook).toBe(true);
    expect(snap.spellcasting?.slots.find((s) => s.level === 1)?.available).toBe(2);
    expect(snap.spellcasting?.slots.find((s) => s.level === 4)?.total).toBe(1);
  });
});
