import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createTestDb } from '@/db';
import {
  DEFAULT_PLAYER_EDITABLE_FIELDS,
  GM_GRANTABLE_PLAYER_FIELDS,
  buildLevelUpPatch,
  createEmptyDnd5e2014Sheet,
  evaluateLevelUpEligibility,
  normalizeDnd5e2014Sheet,
  previewLevelUp,
  validateMulticlassPrerequisites,
} from '@/domain/systems/dnd5e-2014';
import { resolveSession } from '@/server/auth/session';
import { createCampaign, getCampaignDetail } from '@/server/services/campaign-service';
import {
  createCharacterBase,
  deleteCampaignCharacter,
  getCampaignCharacter,
  updateCharacterBase,
} from '@/server/services/character-service';
import {
  acceptPlayerInvitation,
  createPlayerInvitation,
} from '@/server/services/player-invitation-service';
import { CharacterTabNav } from '@/components/characters/CharacterTabNav';
import { ProgressionAndEvolutionTab } from '@/components/characters/progression/ProgressionAndEvolutionTab';
import { ProgressionSummaryCard } from '@/components/characters/progression/ProgressionSummaryCard';
import { LevelUpModal } from '@/components/characters/progression/LevelUpModal';
import { StoryAndJournalTab } from '@/components/characters/story/StoryAndJournalTab';
import { buildCharacterSheetPatch, createDraftFromCharacter } from '@/components/characters/sheet-patch';
import { buildSheetAccessContext } from '@/components/characters/sheet-permissions';
import type { CharacterSheetRecord } from '@/components/characters/types';
import { bootstrapAdmin, createInvitedGm } from './helpers';

describe('Fase 3 (Increment 3C.3): Història, diari, progressió i evolució del personatge', () => {
  it('valida requisits oficials de multiclasse, calcula vista prèvia de pujada de nivell i genera patches parcials nets', () => {
    // 1. Requisits oficials PHB p. 163
    const illegalRogue = validateMulticlassPrerequisites(
      [
        { classId: 'wizard', level: 2 },
        { classId: 'rogue', level: 1 },
      ],
      { str: 8, dex: 12, con: 14, int: 16, wis: 10, cha: 10 }
    );
    expect(illegalRogue.eligible).toBe(false);
    expect(illegalRogue.unmetRequirements[0]).toContain('Murri');

    const legalFighterAnyOf = validateMulticlassPrerequisites(
      [
        { classId: 'cleric', level: 2 },
        { classId: 'fighter', level: 1 },
      ],
      { str: 10, dex: 14, con: 14, int: 10, wis: 16, cha: 10 } // DES 14 compleix STR 13 o DEX 13
    );
    expect(legalFighterAnyOf.eligible).toBe(true);

    // 2. Pujada de nivell Guerrer 3 -> 4 (Nan dels turons +1 PV/nivell, CON 14 (+2), d10 mitjà 6 -> +9 PV, ASI +2 FOR)
    const fighterSheet = createEmptyDnd5e2014Sheet('Dain');
    fighterSheet.raceAndClass = {
      race: 'Nan',
      subrace: 'Nan dels turons',
      classes: [{ classId: 'fighter', subclassId: 'battle-master', level: 3 }],
    };
    fighterSheet.abilities = { str: 16, dex: 12, con: 14, int: 10, wis: 12, cha: 8 };
    fighterSheet.hitPoints.max = 31;
    fighterSheet.hitPoints.current = 31;
    fighterSheet.progression.experiencePoints = 2700;

    const p4 = previewLevelUp(fighterSheet, { mode: 'existing', classId: 'fighter' });
    expect(p4.canLevelUp).toBe(true);
    expect(p4.nextTotalLevel).toBe(4);
    expect(p4.hp.hillDwarfBonus).toBe(1);
    expect(p4.hp.averageGain).toBe(9);
    expect(p4.asiUnlock.unlocksNow).toBe(true);

    const lvl4Patch = buildLevelUpPatch(fighterSheet, {
      selection: { mode: 'existing', classId: 'fighter' },
      hpMode: 'average',
      asiChoice: 'asi_plus2',
      asiAbility1: 'str',
      notes: 'Campanya de la Costa de les Espases',
      isGm: false,
    });
    expect(lvl4Patch.errors).toEqual([]);
    expect(lvl4Patch.patch.abilities).toEqual({ str: 18 });
    expect(lvl4Patch.patch.hitPoints).toEqual({ max: 40, current: 40 });
    expect(lvl4Patch.patch.progression?.totalLevel).toBe(4);
    expect(lvl4Patch.patch.progression?.abilityScoreImprovements?.[0].notes).toContain('+2 FOR');
    expect(lvl4Patch.patch.inventory).toBeUndefined();
    expect(lvl4Patch.patch.background).toBeUndefined();

    // 3. Rebuig si un jugador intenta superar 20 amb ASI o superar nivell 20 oficial
    const cappedSheet = createEmptyDnd5e2014Sheet('Cap');
    cappedSheet.raceAndClass.classes = [{ classId: 'fighter', level: 20 }];
    expect(previewLevelUp(cappedSheet, { mode: 'existing', classId: 'fighter' }).canLevelUp).toBe(
      false
    );

    // 4. Clergue 4 -> 5: augment de competència (+2 -> +3) i espais de 3r cercle
    const clericSheet = createEmptyDnd5e2014Sheet('Sera');
    clericSheet.raceAndClass.classes = [{ classId: 'cleric', subclassId: 'life-domain', level: 4 }];
    clericSheet.abilities = { str: 12, dex: 10, con: 14, int: 10, wis: 18, cha: 12 };
    clericSheet.progression.experiencePoints = 6500;
    const p5 = previewLevelUp(clericSheet, { mode: 'existing', classId: 'cleric' });
    expect(p5.proficiencyBonusBefore).toBe(2);
    expect(p5.proficiencyBonusAfter).toBe(3);
    expect(p5.proficiencyBonusIncreased).toBe(true);
    expect(p5.spellcastingDelta.gainedSlots.some((s) => s.level === 3 && s.after === 2)).toBe(true);
    expect(p5.spellcastingDelta.preparedLimitDelta).toBe(1);
  });

  it('persisteix història compartida, diari amb categories/ordre/eliminació, progressió protegida i integració multiclasse en BD', async () => {
    const { db, close } = await createTestDb();
    try {
      const admin = await bootstrapAdmin(db);
      const gm = await createInvitedGm(db, admin.ctx, 'gm.3c3@rol.test', 'GM 3C3');
      const camp = await createCampaign(db, gm.ctx, {
        name: 'Cròniques de 3C.3',
        systemId: 'dnd5e-2014',
      });

      const inv = await createPlayerInvitation(db, gm.ctx, camp.id, { label: 'Laia' });
      const reg = await acceptPlayerInvitation(db, inv.rawToken, {
        mode: 'register',
        email: 'laia.3c3@rol.test',
        displayName: 'Laia',
        password: 'PlayerPassword123!',
      });
      const playerCtx = await resolveSession(db, reg.rawToken);

      const created = await createCharacterBase(db, gm.ctx, camp.id, {
        name: 'Lyra Ventclar',
        memberId: reg.memberId,
        gmNotes: 'Secret del GM invisible al jugador',
        sheetData: {
          generalInfo: { alignment: 'Neutral Bo', appearanceNotes: 'Cabells platejats' },
          raceAndClass: {
            race: 'Elf',
            subrace: 'Alt elf',
            classes: [{ classId: 'wizard', subclassId: 'evocation', level: 2 }],
          },
          abilities: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 },
          hitPoints: { max: 14, current: 14 },
          inventory: [
            { id: 'inv-orb', name: 'Orbe arcà', category: 'gear', quantity: 1 },
          ],
          currency: { gp: 45 },
          background: {
            backgroundName: 'Erudit / Savi',
            backstory: 'Aprenent a Candlekeep.',
          },
        },
      });

      // A. Jugador NO pot modificar PE ni classes ni nivell per defecte
      await expect(
        updateCharacterBase(db, playerCtx, camp.id, created.id, {
          sheetPatch: { progression: { experiencePoints: 5000 } },
        })
      ).rejects.toMatchObject({ status: 403, code: 'FIELD_EDIT_NOT_AUTHORIZED' });

      await expect(
        updateCharacterBase(db, playerCtx, camp.id, created.id, {
          sheetPatch: { raceAndClass: { classes: [{ classId: 'wizard', level: 3 }] } },
        })
      ).rejects.toMatchObject({ status: 403, code: 'FIELD_EDIT_NOT_AUTHORIZED' });

      await expect(
        updateCharacterBase(db, playerCtx, camp.id, created.id, {
          sheetPatch: { spellSlotOverrides: { '1': 9 } },
        })
      ).rejects.toMatchObject({ status: 403, code: 'OFFICIAL_CALCULATION_PROTECTED' });

      // B. Història + Diari (creació, edició amb updatedAt, categoria opcional i eliminació) sense alterar inventari ni mecàniques
      const storyLoaded = await getCampaignCharacter(db, playerCtx, camp.id, created.id);
      const storyRecord = {
        ...storyLoaded,
        createdAt: storyLoaded.createdAt.toISOString(),
        updatedAt: storyLoaded.updatedAt.toISOString(),
      } as unknown as CharacterSheetRecord;
      const storyDraft = createDraftFromCharacter(storyRecord);
      const storyAccess = buildSheetAccessContext(storyRecord, false);

      storyDraft.background.personalityTraits = 'Curiosa i metòdica.';
      storyDraft.background.ideals = 'El coneixement compartit il·lumina el camí.';
      storyDraft.background.bonds = 'El meu mestre desaparegut a Cormyr.';
      storyDraft.background.flaws = 'No resistesc un llibre xifrat.';
      storyDraft.background.backstory = 'Aprenent a Candlekeep fins a l’incendi de la biblioteca.';
      storyDraft.background.additionalNotes = 'Objectiu: recuperar el còdex robat.';
      storyDraft.generalInfo.faith = 'Oghma';
      storyDraft.generalInfo.age = '112 anys';
      storyDraft.background.sessionNotes = [
        {
          id: 'j-1',
          date: '2026-11-20',
          updatedAt: '2026-11-20T20:00:00.000Z',
          category: 'location',
          title: 'Arribada a Phandalin',
          content: 'Vam trobar pistes a l’hostal.',
        },
        {
          id: 'j-2',
          date: '2026-11-25',
          updatedAt: '2026-11-25T21:00:00.000Z',
          category: null, // sense categoria obligatòria
          title: 'Acord nocturn',
          content: 'Sildar ens va lliurar el mapa.',
        },
      ];

      const storyPatchBuilt = buildCharacterSheetPatch(storyRecord, storyDraft, storyAccess);
      expect(storyPatchBuilt.hasChanges).toBe(true);
      expect((storyPatchBuilt.payload.sheetPatch as Record<string, unknown>).inventory).toBeUndefined();

      const afterStory = await updateCharacterBase(
        db,
        playerCtx,
        camp.id,
        created.id,
        storyPatchBuilt.payload
      );
      expect((afterStory.sheetData.background as { sessionNotes: unknown[] }).sessionNotes).toHaveLength(2);
      expect((afterStory.sheetData.inventory as unknown[])).toHaveLength(1);
      expect((afterStory.sheetData.currency as { gp: number }).gp).toBe(45);

      // Edició i eliminació d'entrada de diari
      const afterStoryRec = {
        ...afterStory,
        createdAt: afterStory.createdAt.toISOString(),
        updatedAt: afterStory.updatedAt.toISOString(),
      } as unknown as CharacterSheetRecord;
      const journalDraft2 = createDraftFromCharacter(afterStoryRec);
      journalDraft2.background.sessionNotes = journalDraft2.background.sessionNotes
        .filter((n) => n.id !== 'j-1')
        .map((n) =>
          n.id === 'j-2'
            ? { ...n, category: 'quest', content: 'Mapa verificat amb Sildar.', updatedAt: '2026-11-25T22:00:00.000Z' }
            : n
        );
      const jPatch2 = buildCharacterSheetPatch(afterStoryRec, journalDraft2, storyAccess);
      const afterJournalDelete = await updateCharacterBase(
        db,
        playerCtx,
        camp.id,
        created.id,
        jPatch2.payload
      );
      const savedNotes = (
        afterJournalDelete.sheetData.background as { sessionNotes: Array<{ id: string; category: string | null }> }
      ).sessionNotes;
      expect(savedNotes).toHaveLength(1);
      expect(savedNotes[0]).toMatchObject({ id: 'j-2', category: 'quest' });

      // C. Permisos: GM oculta diari (`gmOnlyFields: ['background.sessionNotes']`) i atorga XP + puja de nivell Wizard 2 -> 3
      await updateCharacterBase(db, gm.ctx, camp.id, created.id, {
        fieldPermissions: {
          playerEditableFields: [...DEFAULT_PLAYER_EDITABLE_FIELDS].filter(
            (p) => p !== 'background.sessionNotes'
          ),
          gmOnlyFields: ['background.sessionNotes'],
        },
        sheetPatch: {
          progression: { experiencePoints: 900 },
        },
      });

      const hiddenView = await getCampaignCharacter(db, playerCtx, camp.id, created.id);
      expect('gmNotes' in hiddenView).toBe(false);
      expect((hiddenView.sheetData.background as Record<string, unknown>).sessionNotes).toBeUndefined();

      await expect(
        updateCharacterBase(db, playerCtx, camp.id, created.id, {
          sheetPatch: { background: { sessionNotes: [] } },
        })
      ).rejects.toMatchObject({ status: 403, code: 'FIELD_EDIT_NOT_AUTHORIZED' });

      // GM aplica pujada de nivell Wizard 2 -> 3 + 1 nou conjur de 2n cercle
      const gmView = await getCampaignCharacter(db, gm.ctx, camp.id, created.id);
      const { normalizeDnd5e2014Sheet } = await import('@/domain/systems/dnd5e-2014');
      const normGm = normalizeDnd5e2014Sheet(gmView.sheetData, gmView.name);
      const gmLvl3 = buildLevelUpPatch(normGm, {
        selection: { mode: 'existing', classId: 'wizard' },
        hpMode: 'average',
        newSpells: [
          {
            id: 'sp-misty',
            level: 2,
            name: 'Pas boirós',
            castingTime: '1 acció addicional',
            range: 'Personal',
            components: 'V',
            duration: 'Instantània',
            school: 'Conjuració',
            sourceType: 'class',
            sourceClassId: 'wizard',
            alwaysPrepared: false,
            prepared: true,
            inSpellbook: true,
            ritual: false,
            concentration: false,
            notes: '',
          },
        ],
        notes: 'Accés a conjurs de 2n cercle',
        isGm: true,
      });
      const afterLvl3 = await updateCharacterBase(db, gm.ctx, camp.id, created.id, {
        sheetPatch: gmLvl3.patch,
      });
      expect(afterLvl3.computed.totalLevel).toBe(3);
      expect(afterLvl3.computed.spellcasting?.slots.find((s) => s.level === 2)?.total).toBe(2);
      expect(afterLvl3.computed.spellcasting?.totalSpellbookCount).toBe(1);
      // Inventari i diari conservats intactes!
      expect((afterLvl3.sheetData.inventory as unknown[])).toHaveLength(1);
      expect((afterLvl3.sheetData.background as { sessionNotes: unknown[] }).sessionNotes).toHaveLength(1);

      // D. GM autoritza `raceAndClass.classes` + `progression.totalLevel` al jugador i concedeix 2700 PE (llindar nivell 4):
      // El servidor encara bloqueja multiclasse il·legal (Bàrbar FOR 13 quan té FOR 8!)
      await updateCharacterBase(db, gm.ctx, camp.id, created.id, {
        fieldPermissions: {
          playerEditableFields: [...GM_GRANTABLE_PLAYER_FIELDS],
        },
        sheetPatch: {
          progression: { experiencePoints: 2700 },
        },
      });

      await expect(
        updateCharacterBase(db, playerCtx, camp.id, created.id, {
          sheetPatch: {
            raceAndClass: {
              classes: [
                { classId: 'wizard', subclassId: 'evocation', level: 3 },
                { classId: 'barbarian', level: 1 },
              ],
            },
          },
        })
      ).rejects.toMatchObject({ status: 400, code: 'MULTICLASS_PREREQUISITES_NOT_MET' });

      // Límits oficials: nivell total > 20 bloquejat per Zod
      await expect(
        updateCharacterBase(db, playerCtx, camp.id, created.id, {
          sheetPatch: {
            raceAndClass: {
              classes: [
                { classId: 'wizard', subclassId: 'evocation', level: 12 },
                { classId: 'fighter', level: 9 },
              ],
            },
          },
        })
      ).rejects.toMatchObject({ status: 400, code: 'INVALID_CHARACTER_SHEET' });

      // Multiclasse legal (DES 14 >= 13 per Guerrer): actualitza capçalera, recursos i daus de cop
      const afterMulticlass = await updateCharacterBase(db, playerCtx, camp.id, created.id, {
        sheetPatch: {
          raceAndClass: {
            classes: [
              { classId: 'wizard', subclassId: 'evocation', level: 3 },
              { classId: 'fighter', level: 1 },
            ],
          },
          progression: {
            totalLevel: 4,
            levelHistory: [
              ...(afterLvl3.sheetData.progression as { levelHistory: Array<Record<string, unknown>> })
                .levelHistory,
              { id: 'lh-mc', level: 4, classId: 'fighter', hpGain: 8, notes: 'Multiclasse a Guerrer' },
            ] as never,
          },
        },
      });
      expect(afterMulticlass.computed.totalLevel).toBe(4);
      expect(afterMulticlass.computed.combat.hitDiceDisplay).toBe('3d6 + 1d10');
      expect(
        afterMulticlass.computed.resources.some((r) => r.name.includes('Segon alè'))
      ).toBe(true);

      // E. Renderització SSR de les 5 pestanyes i modals
      const noop = () => undefined;
      const gmLoadedFinal = await getCampaignCharacter(db, gm.ctx, camp.id, created.id);
      const finalRec = {
        ...gmLoadedFinal,
        createdAt: gmLoadedFinal.createdAt.toISOString(),
        updatedAt: gmLoadedFinal.updatedAt.toISOString(),
      } as unknown as CharacterSheetRecord;
      const finalDraft = createDraftFromCharacter(finalRec);
      const gmAccess = buildSheetAccessContext(finalRec, true);
      const playerReadOnlyAccess = buildSheetAccessContext(
        {
          ...finalRec,
          editableFields: [...DEFAULT_PLAYER_EDITABLE_FIELDS],
        },
        false
      );

      const navHtml = renderToStaticMarkup(
        React.createElement(CharacterTabNav, { activeTab: 'story', onSelectTab: noop })
      );
      expect(navHtml).toContain('Història i diari');
      expect(navHtml).toContain('Progressió i evolució');
      expect(navHtml).not.toContain('3C.3');

      const storyHtml = renderToStaticMarkup(
        React.createElement(StoryAndJournalTab, {
          character: finalRec,
          draft: finalDraft,
          access: gmAccess,
          onUpdateDraft: noop,
        })
      );
      expect(storyHtml).toContain('Candlekeep');
      expect(storyHtml).toContain('Acord nocturn');

      const progPlayerHtml = renderToStaticMarkup(
        React.createElement(ProgressionAndEvolutionTab, {
          campaignId: camp.id,
          character: finalRec,
          draft: finalDraft,
          access: playerReadOnlyAccess,
          hasUnsavedChanges: false,
          onUpdateDraft: noop,
          onLevelUpApplied: noop,
        })
      );
      expect(progPlayerHtml).toContain('controlats pel Director de Joc');
      expect(progPlayerHtml).not.toContain('Pujar de nivell (+1)');
      expect(progPlayerHtml).toContain('Multiclasse oficial vàlida');

      const modalHtml = renderToStaticMarkup(
        React.createElement(LevelUpModal, {
          open: true,
          onClose: noop,
          campaignId: camp.id,
          character: finalRec,
          access: gmAccess,
          onApplied: noop,
        })
      );
      expect(modalHtml).toContain('Pujar de nivell');
      expect(modalHtml).toContain('Punts de cop addicionals');

      // F. Regressió: eliminació amb doble confirmació continua funcionant
      const detail = await getCampaignDetail(db, gm.ctx, camp.id);
      expect(detail.stats.characterCount).toBe(1);
      await deleteCampaignCharacter(db, gm.ctx, camp.id, created.id, 'Lyra Ventclar');
      const detailAfter = await getCampaignDetail(db, gm.ctx, camp.id);
      expect(detailAfter.stats.characterCount).toBe(0);
    } finally {
      await close();
    }
  });

  it('controla estrictament totes les pujades de nivell segons PE acumulats, evita salts, estats obsolets i concurrència', async () => {
    const { db, close } = await createTestDb();
    try {
      const admin = await bootstrapAdmin(db);
      const gm = await createInvitedGm(db, admin.ctx, 'gm.lvlfix@rol.test', 'GM LevelFix');
      const camp = await createCampaign(db, gm.ctx, {
        name: 'Campanya Control Nivells',
        systemId: 'dnd5e-2014',
      });

      const hero = await createCharacterBase(db, gm.ctx, camp.id, {
        name: 'Alden',
        sheetData: {
          raceAndClass: { race: 'Humà', classes: [{ classId: 'fighter', level: 1 }] },
          abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 12, cha: 10 },
          hitPoints: { max: 12, current: 12 },
          progression: { experiencePoints: 299 },
        },
      });

      const norm1 = normalizeDnd5e2014Sheet(hero.sheetData, hero.name);

      // 1. Nivell 1 amb 299 PE: domini i servidor rebutgen la pujada i la UI desactiva el botó
      expect(evaluateLevelUpEligibility(norm1)).toMatchObject({
        allowed: false,
        code: 'INSUFFICIENT_XP_FOR_LEVEL_UP',
        xpMissing: 1,
      });
      const preview299 = previewLevelUp(norm1, { mode: 'existing', classId: 'fighter' });
      expect(preview299.canLevelUp).toBe(false);
      expect(buildLevelUpPatch(norm1, { selection: { mode: 'existing', classId: 'fighter' }, hpMode: 'average', isGm: true }).errors.length).toBeGreaterThan(0);

      // UI SSR desactivada amb 299 PE
      const rec299 = {
        ...hero,
        createdAt: hero.createdAt.toISOString(),
        updatedAt: hero.updatedAt.toISOString(),
      } as unknown as CharacterSheetRecord;
      const gmAccess = buildSheetAccessContext(rec299, true);
      const summary299Html = renderToStaticMarkup(
        React.createElement(ProgressionSummaryCard, {
          character: rec299,
          draft: createDraftFromCharacter(rec299),
          access: gmAccess,
          hasUnsavedChanges: false,
          onUpdateDraft: () => undefined,
          onOpenLevelUp: () => undefined,
        })
      );
      expect(summary299Html).toContain('disabled=""');
      expect(summary299Html).toContain('Calen 300 PE acumulats');

      const modal299Html = renderToStaticMarkup(
        React.createElement(LevelUpModal, {
          open: true,
          onClose: () => undefined,
          campaignId: camp.id,
          character: rec299,
          access: gmAccess,
          onApplied: () => undefined,
        })
      );
      expect(modal299Html).toContain('299 / 300 PE');
      expect(modal299Html).toContain('disabled=""');

      await expect(
        updateCharacterBase(db, gm.ctx, camp.id, hero.id, {
          sheetPatch: {
            raceAndClass: { classes: [{ classId: 'fighter', level: 2 }] },
            progression: { totalLevel: 2 },
          },
          expectedCurrentLevel: 1,
        })
      ).rejects.toMatchObject({ status: 400, code: 'INSUFFICIENT_XP_FOR_LEVEL_UP' });

      // 2. Nivell 1 amb 300 PE: permet pujar a nivell 2 i NO consumeix PE
      await updateCharacterBase(db, gm.ctx, camp.id, hero.id, {
        sheetPatch: { progression: { experiencePoints: 300 } },
      });
      const at300 = await getCampaignCharacter(db, gm.ctx, camp.id, hero.id);
      const rec300 = {
        ...at300,
        createdAt: at300.createdAt.toISOString(),
        updatedAt: at300.updatedAt.toISOString(),
      } as unknown as CharacterSheetRecord;
      const summary300Html = renderToStaticMarkup(
        React.createElement(ProgressionSummaryCard, {
          character: rec300,
          draft: createDraftFromCharacter(rec300),
          access: gmAccess,
          hasUnsavedChanges: false,
          onUpdateDraft: () => undefined,
          onOpenLevelUp: () => undefined,
        })
      );
      expect(summary300Html).toContain('PE suficients per pujar al nivell 2');

      const normAt300 = normalizeDnd5e2014Sheet(at300.sheetData, at300.name);
      const patchTo2 = buildLevelUpPatch(normAt300, {
        selection: { mode: 'existing', classId: 'fighter' },
        hpMode: 'average',
        isGm: true,
      });
      expect(patchTo2.errors).toEqual([]);
      const lvl2Char = await updateCharacterBase(db, gm.ctx, camp.id, hero.id, {
        sheetPatch: patchTo2.patch,
        expectedCurrentLevel: 1,
        expectedUpdatedAt: at300.updatedAt.toISOString(),
      });
      expect(lvl2Char.computed.totalLevel).toBe(2);
      expect(lvl2Char.computed.progression.experiencePoints).toBe(300); // PE acumulats preservats

      // 3. Després de pujar a nivell 2 amb 300 PE: segona pujada rebutjada + petició obsoleta rebutjada
      await expect(
        updateCharacterBase(db, gm.ctx, camp.id, hero.id, {
          sheetPatch: patchTo2.patch,
          expectedCurrentLevel: 1,
        })
      ).rejects.toMatchObject({ status: 409, code: 'STALE_LEVEL_UP_STATE' });

      await expect(
        updateCharacterBase(db, gm.ctx, camp.id, hero.id, {
          sheetPatch: {
            raceAndClass: { classes: [{ classId: 'fighter', level: 3 }] },
            progression: { totalLevel: 3 },
          },
          expectedCurrentLevel: 2,
        })
      ).rejects.toMatchObject({ status: 400, code: 'INSUFFICIENT_XP_FOR_LEVEL_UP' });

      // 4. Nivell 2 amb 899 PE: rebutja la pujada a nivell 3
      await updateCharacterBase(db, gm.ctx, camp.id, hero.id, {
        sheetPatch: { progression: { experiencePoints: 899 } },
      });
      await expect(
        updateCharacterBase(db, gm.ctx, camp.id, hero.id, {
          sheetPatch: {
            raceAndClass: { classes: [{ classId: 'fighter', level: 3 }] },
            progression: { totalLevel: 3 },
          },
        })
      ).rejects.toMatchObject({ status: 400, code: 'INSUFFICIENT_XP_FOR_LEVEL_UP' });

      // 5. Nivell 2 amb 900 PE: permet arribar a nivell 3 i conserva 900 PE
      const at899 = await updateCharacterBase(db, gm.ctx, camp.id, hero.id, {
        sheetPatch: { progression: { experiencePoints: 900 } },
      });
      const normAt900 = normalizeDnd5e2014Sheet(at899.sheetData, at899.name);
      const patchTo3 = buildLevelUpPatch(normAt900, {
        selection: { mode: 'existing', classId: 'fighter' },
        hpMode: 'average',
        isGm: true,
      });
      const lvl3Char = await updateCharacterBase(db, gm.ctx, camp.id, hero.id, {
        sheetPatch: patchTo3.patch,
        expectedCurrentLevel: 2,
        expectedUpdatedAt: at899.updatedAt.toISOString(),
      });
      expect(lvl3Char.computed.totalLevel).toBe(3);
      expect(lvl3Char.computed.progression.experiencePoints).toBe(900);

      // 6 & 7 & 8 & 9. Personatge nivell 1 amb 900 PE:
      // - No pot saltar directe de nivell 1 a 3 (`LEVEL_UP_SKIP_FORBIDDEN`)
      // - No pot injectar PE + pujada en la mateixa petició (`LEVEL_UP_XP_MUTATION_FORBIDDEN`)
      // - Dues peticions simultànies només apliquen UNA pujada (nivell 2) i la segona rep `STALE_LEVEL_UP_STATE`
      // - Després pot pujar successivament a nivell 3 (però no a 4 amb 900 PE)
      const multiHero = await createCharacterBase(db, gm.ctx, camp.id, {
        name: 'Seraphina',
        sheetData: {
          raceAndClass: { race: 'Elf', classes: [{ classId: 'cleric', level: 1 }] },
          abilities: { str: 10, dex: 12, con: 14, int: 10, wis: 16, cha: 12 },
          hitPoints: { max: 10, current: 10 },
          progression: { experiencePoints: 900 },
        },
      });

      // Salt 1 -> 3 rebutjat
      await expect(
        updateCharacterBase(db, gm.ctx, camp.id, multiHero.id, {
          sheetPatch: {
            raceAndClass: { classes: [{ classId: 'cleric', level: 3 }] },
            progression: { totalLevel: 3 },
          },
        })
      ).rejects.toMatchObject({ status: 400, code: 'LEVEL_UP_SKIP_FORBIDDEN' });

      // Intent de mutar PE dins la mateixa operació de pujada rebutjat
      await expect(
        updateCharacterBase(db, gm.ctx, camp.id, multiHero.id, {
          sheetPatch: {
            raceAndClass: { classes: [{ classId: 'cleric', level: 2 }] },
            progression: { totalLevel: 2, experiencePoints: 5000 },
          },
        })
      ).rejects.toMatchObject({ status: 400, code: 'LEVEL_UP_XP_MUTATION_FORBIDDEN' });

      // Dues peticions simultànies sobre el mateix estat inicial (nivell 1 -> 2)
      const normMulti1 = normalizeDnd5e2014Sheet(multiHero.sheetData, multiHero.name);
      const concurrentPatch = buildLevelUpPatch(normMulti1, {
        selection: { mode: 'existing', classId: 'cleric' },
        hpMode: 'average',
        isGm: true,
      }).patch;

      const concurrentResults = await Promise.allSettled([
        updateCharacterBase(db, gm.ctx, camp.id, multiHero.id, {
          sheetPatch: concurrentPatch,
          expectedCurrentLevel: 1,
          expectedUpdatedAt: multiHero.updatedAt.toISOString(),
        }),
        updateCharacterBase(db, gm.ctx, camp.id, multiHero.id, {
          sheetPatch: concurrentPatch,
          expectedCurrentLevel: 1,
          expectedUpdatedAt: multiHero.updatedAt.toISOString(),
        }),
      ]);

      const fulfilled = concurrentResults.filter((r) => r.status === 'fulfilled');
      const rejected = concurrentResults.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      if (rejected[0]?.status === 'rejected') {
        expect(rejected[0].reason).toMatchObject({ status: 409, code: 'STALE_LEVEL_UP_STATE' });
      }

      // Segona pujada successiva legítima 2 -> 3 amb els mateixos 900 PE acumulats
      const afterMulti2 = await getCampaignCharacter(db, gm.ctx, camp.id, multiHero.id);
      expect(afterMulti2.computed.totalLevel).toBe(2);
      expect((afterMulti2.sheetData.progression as { levelHistory: unknown[] }).levelHistory).toHaveLength(1);

      const normMulti2 = normalizeDnd5e2014Sheet(afterMulti2.sheetData, afterMulti2.name);
      const patchMulti3 = buildLevelUpPatch(normMulti2, {
        selection: { mode: 'existing', classId: 'cleric' },
        hpMode: 'average',
        isGm: true,
      }).patch;
      const afterMulti3 = await updateCharacterBase(db, gm.ctx, camp.id, multiHero.id, {
        sheetPatch: patchMulti3,
        expectedCurrentLevel: 2,
        expectedUpdatedAt: afterMulti2.updatedAt.toISOString(),
      });
      expect(afterMulti3.computed.totalLevel).toBe(3);
      expect(afterMulti3.computed.progression.experiencePoints).toBe(900);

      // Intentar 3 -> 4 amb 900 PE (calen 2700 PE) falla
      await expect(
        updateCharacterBase(db, gm.ctx, camp.id, multiHero.id, {
          sheetPatch: {
            raceAndClass: { classes: [{ classId: 'cleric', level: 4 }] },
            progression: { totalLevel: 4 },
          },
          expectedCurrentLevel: 3,
        })
      ).rejects.toMatchObject({ status: 400, code: 'INSUFFICIENT_XP_FOR_LEVEL_UP' });

      // 10. Nivell 20 amb 500000 PE no pot superar el límit màxim
      const epicHero = await createCharacterBase(db, gm.ctx, camp.id, {
        name: 'Aurelius',
        sheetData: {
          raceAndClass: { race: 'Humà', classes: [{ classId: 'wizard', level: 20 }] },
          abilities: { str: 8, dex: 14, con: 14, int: 20, wis: 12, cha: 10 },
          progression: { experiencePoints: 500000 },
        },
      });
      expect(
        evaluateLevelUpEligibility(normalizeDnd5e2014Sheet(epicHero.sheetData, epicHero.name))
      ).toMatchObject({
        allowed: false,
        code: 'LEVEL_UP_MAX_LEVEL_REACHED',
      });
    } finally {
      await close();
    }
  });
});
