import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createTestDb } from '@/db';
import {
  DEFAULT_PLAYER_EDITABLE_FIELDS,
  DND5E_SKILLS,
  computeDnd5e2014Sheet,
  createEmptyDnd5e2014Sheet,
  normalizeDnd5e2014Sheet,
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
import { CharacterHeader } from '@/components/characters/CharacterHeader';
import { CharacterTabNav } from '@/components/characters/CharacterTabNav';
import { TabPlaceholder } from '@/components/characters/TabPlaceholder';
import { CombatStatsTab } from '@/components/characters/combat/CombatStatsTab';
import { buildCharacterSheetPatch, createDraftFromCharacter } from '@/components/characters/sheet-patch';
import { buildSheetAccessContext, canEditSheetField } from '@/components/characters/sheet-permissions';
import type { CharacterCampaignContext, CharacterSheetRecord } from '@/components/characters/types';
import { bootstrapAdmin, createInvitedGm } from './helpers';

function makeRecordFromSheet(
  name: string,
  mutator?: (sheet: ReturnType<typeof createEmptyDnd5e2014Sheet>) => void,
  overrides?: Partial<CharacterSheetRecord>
): CharacterSheetRecord {
  const sheet = createEmptyDnd5e2014Sheet(name);
  sheet.generalInfo.playerName = 'Laia';
  sheet.raceAndClass.race = 'Mig-elf';
  sheet.raceAndClass.subrace = 'Alt elf';
  sheet.raceAndClass.classes = [
    { classId: 'fighter', subclassId: 'champion', level: 3 },
    { classId: 'wizard', subclassId: 'evocation', level: 2 },
  ];
  sheet.abilities = { str: 16, dex: 14, con: 14, int: 16, wis: 10, cha: 12 };
  sheet.savingThrows.proficient = ['str', 'con'];
  sheet.savingThrows.rollModes = { con: 'advantage' };
  sheet.skills.proficient = ['athletics', 'perception'];
  sheet.skills.expertise = ['stealth'];
  sheet.skills.rollModes = { perception: 'disadvantage' };
  sheet.hitPoints = {
    max: 42,
    current: 31,
    temporary: 5,
    hitDice: null,
    hitDiceUsed: 1,
    hitDiceUsedByDie: { d10: 1 },
    deathSaves: { successes: 1, failures: 0 },
  };
  sheet.speed = { walk: 9, fly: null, swim: null, climb: null };
  sheet.proficiencies.weapons = ['Armes marcials'];
  sheet.inventory = [
    {
      id: 'wpn-1',
      name: 'Espasa llarga',
      category: 'weapon',
      quantity: 1,
      weight: 1.5,
      equipped: true,
      armorType: null,
      baseAc: null,
      acBonus: null,
      requiresAttunement: false,
      attuned: false,
      weaponAbility: null,
      weaponAbilityOverride: null,
      weaponProficient: false,
      damage: '1d8+3',
      damageType: 'tallant',
      weaponRange: '1,5 m',
      weaponProperties: 'Versàtil (1d10)',
      notes: '',
    },
  ];
  sheet.attacks = [
    {
      id: 'atk-gm-1',
      inventoryItemId: null,
      kind: 'gm_custom',
      spellSourceClassId: null,
      name: 'Marca arcana del GM',
      ability: 'int',
      abilityOverride: null,
      proficient: true,
      proficientOverride: null,
      bonusOverride: 9,
      attackBonus: '+9',
      damage: '2d6',
      damageType: 'força',
      range: '18 m',
      notes: 'Concedit en sessió',
    },
  ];

  mutator?.(sheet);
  const normalized = normalizeDnd5e2014Sheet(sheet, name);
  const computed = computeDnd5e2014Sheet(normalized);

  return {
    id: '00000000-0000-4000-8000-000000000010',
    campaignId: '00000000-0000-4000-8000-000000000001',
    memberId: '00000000-0000-4000-8000-000000000020',
    ownerDisplayName: 'Laia',
    systemId: 'dnd5e-2014',
    name,
    schemaVersion: 2,
    sheetData: normalized,
    computed,
    customFields: {},
    isMine: true,
    canEdit: true,
    editableFields: [...DEFAULT_PLAYER_EDITABLE_FIELDS],
    authorizedOverrideFields: [],
    createdAt: '2026-11-25T18:00:00.000Z',
    updatedAt: '2026-11-25T18:00:00.000Z',
    ...overrides,
  };
}

describe('Fase 3 (Increment 3C.1): Pantalla universal de personatge i primera pestanya', () => {
  it('calcula permisos d’edició i genera patches mínims sense tocar camps protegits ni inventar daus antics', () => {
    const record = makeRecordFromSheet('Kaelen');
    const playerAccess = buildSheetAccessContext(record, false);

    expect(canEditSheetField('abilities.str', playerAccess)).toBe(true);
    expect(canEditSheetField('savingThrows.rollModes', playerAccess)).toBe(true);
    expect(canEditSheetField('skills.rollModes', playerAccess)).toBe(true);
    expect(canEditSheetField('savingThrows.overrides', playerAccess)).toBe(false);
    expect(canEditSheetField('skills.overrides', playerAccess)).toBe(false);
    expect(canEditSheetField('armorClass.override', playerAccess)).toBe(false);
    expect(canEditSheetField('attacks.gmCustom', playerAccess)).toBe(false);
    expect(canEditSheetField('attacks.ability', playerAccess)).toBe(false);
    expect(canEditSheetField('attacks.proficient', playerAccess)).toBe(false);

    const draft = createDraftFromCharacter(record);
    draft.abilities.dex = 16;
    draft.savingThrows.rollModes.wis = 'disadvantage';
    draft.skills.rollModes.stealth = 'advantage';
    draft.hitPoints.current = 25;
    // Intent de manipulació d'override protegit i atacs gm_custom des del client jugador
    draft.savingThrows.overrides.wis = 99;
    draft.armorClass.override = 30;
    draft.attacks = draft.attacks.filter((a) => a.id !== 'atk-gm-1');
    draft.attacks.push({
      id: 'atk-special-1',
      inventoryItemId: null,
      kind: 'special',
      spellSourceClassId: null,
      name: 'Alè dracònic',
      ability: 'cha', // il·legal en `special`
      abilityOverride: null,
      proficient: true, // il·legal en `special`
      proficientOverride: null,
      bonusOverride: null,
      attackBonus: null,
      damage: '2d6',
      damageType: 'foc',
      range: '4,5 m',
      notes: '',
    });

    const built = buildCharacterSheetPatch(record, draft, playerAccess);
    expect(built.hasChanges).toBe(true);

    const sp = built.payload.sheetPatch as Record<string, unknown>;
    expect(sp.abilities).toEqual({ dex: 16 });
    expect(sp.savingThrows).toEqual({ rollModes: { wis: 'disadvantage' } });
    expect(sp.skills).toEqual({ rollModes: { stealth: 'advantage' } });
    expect(sp.hitPoints).toEqual({ current: 25 });
    expect(sp.armorClass).toBeUndefined();
    expect(sp.speed).toBeUndefined();

    const patchedAttacks = sp.attacks as Array<Record<string, unknown>>;
    expect(patchedAttacks.some((a) => a.id === 'atk-gm-1')).toBe(true);
    const specialAtk = patchedAttacks.find((a) => a.id === 'atk-special-1');
    expect(specialAtk).toMatchObject({
      kind: 'special',
      ability: null,
      proficient: false,
    });

    // Fitxa antiga amb distribució desconeguda: no inventa `hitDiceUsedByDie`
    const legacyRecord = makeRecordFromSheet('Antic', (s) => {
      s.hitPoints.hitDiceUsed = 3;
      s.hitPoints.hitDiceUsedByDie = null;
    });
    const legacyDraft = createDraftFromCharacter(legacyRecord);
    legacyDraft.hitPoints.hitDiceUsed = 2;
    const legacyBuilt = buildCharacterSheetPatch(legacyRecord, legacyDraft, playerAccess);
    expect((legacyBuilt.payload.sheetPatch as Record<string, unknown>).hitPoints).toEqual({
      hitDiceUsed: 2,
    });
  });

  it('renderitza capçalera persistent, les 5 pestanyes i tots els blocs de la primera pestanya sense inventar dades', () => {
    const record = makeRecordFromSheet('Kaelen', (s) => {
      s.hitPoints.hitDiceUsed = 3;
      s.hitPoints.hitDiceUsedByDie = null;
    });
    const draft = createDraftFromCharacter(record);
    const access = buildSheetAccessContext(record, false);
    const campaignCtx: CharacterCampaignContext = {
      id: record.campaignId,
      name: 'Cròniques de Valòria',
      systemId: 'dnd5e-2014',
      systemName: 'D&D 5e (2014)',
      virtualDiceEnabled: false,
      canManage: false,
      accessRole: 'player',
    };

    const headerHtml = renderToStaticMarkup(
      React.createElement(CharacterHeader, {
        character: record,
        campaign: campaignCtx,
        access,
        draftName: draft.name,
        onChangeName: () => undefined,
      })
    );
    expect(headerHtml).toContain('Kaelen');
    expect(headerHtml).toContain('Laia');
    expect(headerHtml).toContain('Mig-elf (Alt elf)');
    expect(headerHtml).toContain('Guerrer (Campió) 3 · Mag (Escola d’Evocació) 2');
    expect(headerHtml).toContain('31 / 42');
    expect(headerHtml).toContain(`${record.computed.combat.armorClass.value}`);
    expect(headerHtml).toContain(`+${record.computed.combat.initiative}`);
    expect(headerHtml).toContain('9 m');
    expect(headerHtml).toContain(`+${record.computed.proficiencyBonus}`);
    expect(headerHtml).not.toContain('Dau virtual actiu');

    const tabsHtml = renderToStaticMarkup(
      React.createElement(CharacterTabNav, {
        activeTab: 'combat',
        onSelectTab: () => undefined,
      })
    );
    for (const label of [
      'Característiques i combat',
      'Màgia i habilitats',
      'Equipament i inventari',
      'Història i diari',
      'Progressió i evolució',
    ]) {
      expect(tabsHtml).toContain(label);
    }

    const combatHtml = renderToStaticMarkup(
      React.createElement(CombatStatsTab, {
        character: record,
        draft,
        access,
        onUpdateDraft: () => undefined,
      })
    );

    // 6 característiques i 6 salvacions
    for (const abShort of ['FOR', 'DES', 'CON', 'INT', 'SAV', 'CAR']) {
      expect(combatHtml).toContain(abShort);
    }
    // Totes les 18 habilitats oficials, incloent-hi les no competents
    for (const skill of DND5E_SKILLS) {
      expect(combatHtml).toContain(skill.labelCa);
    }
    // Daus de cop antics sense assignació: no inventa distribució
    expect(combatHtml).toContain('Assignació per mida desconeguda en fitxa antiga');
    expect(combatHtml).toContain('gastats desconeguts');
    // Atacs equipats i manuals calculats
    expect(combatHtml).toContain('Espasa llarga');
    expect(combatHtml).toContain('Marca arcana del GM');
    expect(combatHtml).toContain('+9');

    const storyPlaceholderHtml = renderToStaticMarkup(
      React.createElement(TabPlaceholder, { tabId: 'story' })
    );
    expect(storyPlaceholderHtml).toContain('Increment 3C.3');
  });

  it('valida permisos reals en BD: GM edita tot, jugador edita només la seva fitxa i no veu notes del GM', async () => {
    const { db, close } = await createTestDb();
    try {
      const admin = await bootstrapAdmin(db);
      const gm = await createInvitedGm(db, admin.ctx, 'gm.3c1@rol.test', 'GM 3C1');
      const camp = await createCampaign(db, gm.ctx, { name: 'Taula 3C1', systemId: 'dnd5e-2014' });

      const inv1 = await createPlayerInvitation(db, gm.ctx, camp.id);
      const reg1 = await acceptPlayerInvitation(db, inv1.rawToken, {
        mode: 'register',
        email: 'p1.3c1@rol.test',
        displayName: 'Jugador 1',
        password: 'PlayerPassword123!',
      });
      const p1Ctx = await resolveSession(db, reg1.rawToken);

      const inv2 = await createPlayerInvitation(db, gm.ctx, camp.id);
      const reg2 = await acceptPlayerInvitation(db, inv2.rawToken, {
        mode: 'register',
        email: 'p2.3c1@rol.test',
        displayName: 'Jugador 2',
        password: 'PlayerPassword123!',
      });
      const p2Ctx = await resolveSession(db, reg2.rawToken);

      const char1 = await createCharacterBase(db, p1Ctx, camp.id, {
        name: 'Aelar',
        sheetData: {
          raceAndClass: { classes: [{ classId: 'fighter', level: 5 }] },
          abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
        },
      });
      const char2 = await createCharacterBase(db, p2Ctx, camp.id, {
        name: 'Bram',
      });

      await updateCharacterBase(db, gm.ctx, camp.id, char1.id, {
        gmNotes: 'Secret exclusiu del Director de Joc',
      });

      // Jugador 1 carrega la fitxa compartida del Jugador 2: lectura autoritzada però canEdit false
      const p1ReadsP2 = await getCampaignCharacter(db, p1Ctx, camp.id, char2.id);
      expect(p1ReadsP2.canEdit).toBe(false);
      expect(p1ReadsP2.editableFields).toEqual([]);
      expect('gmNotes' in p1ReadsP2).toBe(false);

      // Jugador 1 no pot modificar la fitxa aliena
      await expect(
        updateCharacterBase(db, p1Ctx, camp.id, char2.id, {
          sheetPatch: { hitPoints: { current: 1 } },
        })
      ).rejects.toMatchObject({ status: 403, code: 'CHARACTER_EDIT_FORBIDDEN' });

      // Jugador 1 carrega la seva fitxa: mai rep gmNotes ni fieldPermissions del GM
      const loadedRaw = await getCampaignCharacter(db, p1Ctx, camp.id, char1.id);
      expect('gmNotes' in loadedRaw).toBe(false);
      expect('fieldPermissions' in loadedRaw).toBe(false);

      const loadedRecord: CharacterSheetRecord = {
        ...loadedRaw,
        sheetData: loadedRaw.sheetData as CharacterSheetRecord['sheetData'],
        createdAt: loadedRaw.createdAt.toISOString(),
        updatedAt: loadedRaw.updatedAt.toISOString(),
      };
      const access = buildSheetAccessContext(loadedRecord, false);
      const draft = createDraftFromCharacter(loadedRecord);
      draft.abilities.str = 18;
      draft.savingThrows.rollModes.str = 'advantage';
      draft.skills.rollModes.athletics = 'advantage';
      draft.hitPoints.deathSaves = { successes: 2, failures: 1 };

      const built = buildCharacterSheetPatch(loadedRecord, draft, access);
      const updated = await updateCharacterBase(
        db,
        p1Ctx,
        camp.id,
        char1.id,
        built.payload as Parameters<typeof updateCharacterBase>[4]
      );
      expect(updated.computed.abilities.str.modifier).toBe(4);
      expect(updated.computed.savingThrows.find((s) => s.ability === 'str')?.rollMode).toBe(
        'advantage'
      );
      expect(updated.computed.skills.find((s) => s.id === 'athletics')?.rollMode).toBe('advantage');

      // Camps protegits continuen bloquejats al servidor
      await expect(
        updateCharacterBase(db, p1Ctx, camp.id, char1.id, {
          sheetPatch: { armorClass: { override: 25 } },
        })
      ).rejects.toMatchObject({ status: 403, code: 'OFFICIAL_CALCULATION_PROTECTED' });

      // El GM pot editar qualsevol fitxa i notes privades
      const gmEdited = await updateCharacterBase(db, gm.ctx, camp.id, char1.id, {
        sheetPatch: { armorClass: { override: 19 } },
      });
      expect(gmEdited.computed.combat.armorClass.value).toBe(19);
      expect(gmEdited.gmNotes).toBe('Secret exclusiu del Director de Joc');
    } finally {
      await close();
    }
  });
});
