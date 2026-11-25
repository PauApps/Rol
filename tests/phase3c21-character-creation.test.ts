import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createTestDb } from '@/db';
import { DEFAULT_CAMPAIGN_CREATION_CONFIG, type CampaignCreationConfig } from '@/domain/campaigns/creation-config';
import {
  DND5E_CLASSES,
  calculatePointBuyCost,
  calculateStartingHitPoints,
  getClassCreationRule,
  getRaceEntry,
  getSubraceEntry,
  roll4d6DropLowestSet,
  validateAbilityScoresAgainstMethod,
} from '@/domain/systems/dnd5e-2014';
import { resolveSession } from '@/server/auth/session';
import {
  createCampaign,
  updateCampaignCharacterRules,
} from '@/server/services/campaign-service';
import {
  createCharacterBase,
  getCampaignCharacter,
  listCampaignCharacters,
  updateCharacterBase,
} from '@/server/services/character-service';
import {
  acceptPlayerInvitation,
  createPlayerInvitation,
} from '@/server/services/player-invitation-service';
import { CharacterIdentityConfigModal } from '@/components/characters/CharacterIdentityConfigModal';
import { InventoryTab } from '@/components/characters/inventory/InventoryTab';
import { MagicAndAbilitiesTab } from '@/components/characters/magic/MagicAndAbilitiesTab';
import { StepAbilities } from '@/components/characters/creation/StepAbilities';
import { StepBackgroundProficiencies } from '@/components/characters/creation/StepBackgroundProficiencies';
import { StepClassFeatures } from '@/components/characters/creation/StepClassFeatures';
import { StepEquipment } from '@/components/characters/creation/StepEquipment';
import { StepIdentity } from '@/components/characters/creation/StepIdentity';
import { StepReview } from '@/components/characters/creation/StepReview';
import {
  buildDefaultEquipmentSelections,
  buildSheetPatchFromWizard,
  buildStarterInventoryList,
  createInitialWizardState,
  validateWizardStep,
} from '@/components/characters/creation/wizard-state';
import { createDraftFromCharacter } from '@/components/characters/sheet-patch';
import { buildSheetAccessContext } from '@/components/characters/sheet-permissions';
import type { CharacterSheetRecord } from '@/components/characters/types';
import { bootstrapAdmin, createInvitedGm } from './helpers';

describe('Fase 3 (Increment 3C.2.1): Creació guiada i configuració editable de personatges', () => {
  it('valida els mètodes de generació d’atributs, bonificacions racials, compra de punts i tirada 4d6', () => {
    const halfElf = getRaceEntry('Mig-elf');
    const woodElf = getRaceEntry('Elf');
    const woodSub = getSubraceEntry(woodElf, 'wood-elf');
    const hillDwarf = getRaceEntry('Nan');
    const hillSub = getSubraceEntry(hillDwarf, 'hill-dwarf');

    expect(halfElf?.id).toBe('half-elf');
    expect(woodSub?.speedWalkOverride).toBe(10);
    expect(calculateStartingHitPoints('fighter', 3, 14, hillSub?.id)).toBe(
      10 + 2 + (6 + 2) * 2 + 3
    );

    // Array estàndard + Elf del Bosc (+2 DEX, +1 WIS): [15,14,13,12,10,8] -> DES 17, SAV 15
    expect(
      validateAbilityScoresAgainstMethod(
        { str: 12, dex: 17, con: 13, int: 10, wis: 15, cha: 8 },
        'standard_array',
        woodElf,
        woodSub
      ).valid
    ).toBe(true);

    // Array invàlid (18 no pot sortir d'array estàndard +2 a nivell 1)
    expect(
      validateAbilityScoresAgainstMethod(
        { str: 18, dex: 17, con: 13, int: 10, wis: 15, cha: 8 },
        'standard_array',
        woodElf,
        woodSub
      ).valid
    ).toBe(false);

    // Compra de punts (27 punts): 15,15,15,8,8,8 = 9+9+9 = 27
    expect(
      calculatePointBuyCost({ str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 })
    ).toMatchObject({ valid: true, totalCost: 27 });
    // Mig-elf (+2 CAR, +1 FOR, +1 CON) amb base [15,8,15,8,8,15] -> 16,8,16,8,8,17
    expect(
      validateAbilityScoresAgainstMethod(
        { str: 16, dex: 8, con: 16, int: 8, wis: 8, cha: 17 },
        'point_buy',
        halfElf,
        undefined
      ).valid
    ).toBe(true);
    // Superar 27 punts falla
    expect(
      validateAbilityScoresAgainstMethod(
        { str: 16, dex: 15, con: 16, int: 14, wis: 10, cha: 17 },
        'point_buy',
        halfElf,
        undefined
      ).valid
    ).toBe(false);

    // Tirada 4d6 descartant el menor
    const rolled = roll4d6DropLowestSet(() => 0.5); // tots 4 -> 12
    expect(rolled).toHaveLength(6);
    expect(rolled.every((r) => r.total === 12)).toBe(true);
  });

  it('crea correctament un personatge vàlid de cadascuna de les 12 classes oficials amb càlculs derivats i equipament', async () => {
    const { db, close } = await createTestDb();
    try {
      const admin = await bootstrapAdmin(db);
      const gm = await createInvitedGm(db, admin.ctx, 'gm.all12@rol.test', 'GM 12 Classes');
      const camp = await createCampaign(db, gm.ctx, {
        name: 'Totes les Classes',
        systemId: 'dnd5e-2014',
      });

      const inv = await createPlayerInvitation(db, gm.ctx, camp.id);
      const reg = await acceptPlayerInvitation(db, inv.rawToken, {
        mode: 'register',
        email: 'hero12@rol.test',
        displayName: 'Creador Universal',
        password: 'PlayerPassword123!',
      });
      const playerCtx = await resolveSession(db, reg.rawToken);

      const config: CampaignCreationConfig = {
        ...DEFAULT_CAMPAIGN_CREATION_CONFIG,
        freedomMode: 'guided',
        startingLevel: 1,
        abilityScoreMethod: 'standard_array',
      };

      for (const clsMeta of DND5E_CLASSES) {
        const rule = getClassCreationRule(clsMeta.id)!;
        const eqSel = buildDefaultEquipmentSelections(clsMeta.id);
        const state = createInitialWizardState(config);
        state.name = `Heroi ${clsMeta.labelCa}`;
        state.classId = clsMeta.id;
        state.backgroundId = 'acolyte'; // insight, religion
        state.classSkills = rule.eligibleSkills
          .filter((sk) => sk !== 'insight' && sk !== 'religion')
          .slice(0, rule.skillChoiceCount);
        state.equipmentSelections = eqSel;
        state.starterInventory = buildStarterInventoryList({
          classId: clsMeta.id,
          classMode: 'official',
          equipmentSelections: eqSel,
          backgroundId: 'acolyte',
          backgroundMode: 'catalog',
        });

        const step1Check = validateWizardStep(1, state, config, false);
        const step2Check = validateWizardStep(2, state, config, false);
        const step3Check = validateWizardStep(3, state, config, false);
        expect(step1Check.errors).toEqual([]);
        expect(step2Check.errors).toEqual([]);
        expect(step3Check.errors).toEqual([]);

        const payload = buildSheetPatchFromWizard(state, config, false);
        const created = await createCharacterBase(db, playerCtx, camp.id, {
          name: payload.name,
          sheetData: payload.sheetData,
        });

        expect(created.computed.totalLevel).toBe(1);
        expect(created.computed.proficiencyBonus).toBe(2);
        expect(created.computed.combat.armorClass.value).toBeGreaterThanOrEqual(10);
        expect(created.computed.combat.attacks.length).toBeGreaterThanOrEqual(1);
        expect((created.sheetData.hitPoints as { max: number | null }).max).toBeGreaterThan(0);
      }

      const listed = await listCampaignCharacters(db, playerCtx, camp.id);
      expect(listed).toHaveLength(12);
    } finally {
      await close();
    }
  });

  it('aplica seguretat estricte al servidor, persisteix en BD, actualitza la fitxa editable i renderitza els 6 passos', async () => {
    const { db, close } = await createTestDb();
    try {
      const admin = await bootstrapAdmin(db);
      const gm = await createInvitedGm(db, admin.ctx, 'gm.3c21@rol.test', 'GM 3C21');
      const camp = await createCampaign(db, gm.ctx, {
        name: 'Campanya Estricta 3C21',
        systemId: 'dnd5e-2014',
      });
      const otherCamp = await createCampaign(db, gm.ctx, {
        name: 'Altra Campanya',
        systemId: 'dnd5e-2014',
      });

      const strictConfig: CampaignCreationConfig = {
        freedomMode: 'strict',
        startingLevel: 2,
        allowedRaces: ['Elf', 'Nan'],
        allowedClasses: ['Clergue', 'Guerrer'],
        allowedBackgrounds: ['Acòlit', 'Soldat'],
        abilityScoreMethod: 'point_buy',
        requiredFields: ['name', 'race', 'class', 'background', 'alignment'],
        restrictions: 'Campanya oficial PHB 2014.',
      };
      await updateCampaignCharacterRules(db, gm.ctx, camp.id, {
        creationConfig: strictConfig,
        maxCharactersPerPlayer: 1,
      });

      const inv = await createPlayerInvitation(db, gm.ctx, camp.id);
      const reg = await acceptPlayerInvitation(db, inv.rawToken, {
        mode: 'register',
        email: 'player.3c21@rol.test',
        displayName: 'Laia',
        password: 'PlayerPassword123!',
      });
      const playerCtx = await resolveSession(db, reg.rawToken);

      // 1. Un usuari sense permís a una altra campanya no hi pot crear personatges
      await expect(
        createCharacterBase(db, playerCtx, otherCamp.id, { name: 'Intrus' })
      ).rejects.toMatchObject({ status: 403, code: 'CAMPAIGN_FORBIDDEN' });

      // 2. No pot superar el límit de creació amb point_buy manipulat ni camps protegits
      await expect(
        createCharacterBase(db, playerCtx, camp.id, {
          name: 'Trampós PointBuy',
          sheetData: {
            generalInfo: { alignment: 'Legal Bo' },
            raceAndClass: { race: 'Elf', subrace: 'Alt elf', classes: [{ classId: 'cleric', level: 2 }] },
            abilities: { str: 18, dex: 18, con: 18, int: 18, wis: 18, cha: 18 },
            background: { backgroundName: 'Acòlit' },
          },
        })
      ).rejects.toMatchObject({ status: 400, code: 'CREATION_RESTRICTION_VIOLATION' });

      await expect(
        createCharacterBase(db, playerCtx, camp.id, {
          name: 'Trampós Override',
          sheetData: {
            armorClass: { override: 25 },
          },
        })
      ).rejects.toMatchObject({ status: 403, code: 'OFFICIAL_CALCULATION_PROTECTED' });

      // 3. Creació vàlida completa amb l'assistent (Clergue nivell 2, point_buy, Elf del bosc)
      const state = createInitialWizardState(strictConfig);
      state.name = 'Elowen';
      state.raceId = 'elf';
      state.subraceId = 'wood-elf'; // +2 DEX, +1 WIS, vel 10
      state.classId = 'cleric';
      state.subclassId = 'life-domain';
      state.level = 2;
      state.alignment = 'Neutral Bo';
      state.backgroundId = 'acolyte';
      // Point buy: 10(2) + 12(4) + 14(7) + 10(2) + 15(9) + 11(3) = 27
      state.baseAbilities = { str: 10, dex: 12, con: 14, int: 10, wis: 15, cha: 11 };
      state.classSkills = ['medicine', 'persuasion'];
      state.extraLanguages = ['Celestial', 'Silvà'];
      state.initialSpells = [
        {
          id: 'sp-cure',
          level: 1,
          name: 'Curar ferides',
          castingTime: '1 acció',
          range: 'Toc',
          components: 'V, S',
          duration: 'Instantània',
          school: 'Evocació',
          sourceType: 'class',
          sourceClassId: 'cleric',
          alwaysPrepared: false,
          prepared: true,
          inSpellbook: false,
          ritual: false,
          concentration: false,
          notes: '',
        },
      ];

      // Comprovem que tots 6 passos SSR renderitzen sense error
      const noop = () => undefined;
      expect(
        renderToStaticMarkup(
          React.createElement(StepIdentity, {
            state,
            config: strictConfig,
            isGm: false,
            members: [],
            onChange: noop,
          })
        )
      ).toContain('Elowen');
      expect(
        renderToStaticMarkup(
          React.createElement(StepAbilities, {
            state,
            config: strictConfig,
            isGm: false,
            onChange: noop,
          })
        )
      ).toContain('27 / 27');
      expect(
        renderToStaticMarkup(
          React.createElement(StepBackgroundProficiencies, {
            state,
            config: strictConfig,
            isGm: false,
            onChange: noop,
          })
        )
      ).toContain('Acòlit');
      expect(
        renderToStaticMarkup(
          React.createElement(StepClassFeatures, {
            state,
            config: strictConfig,
            isGm: false,
            onChange: noop,
          })
        )
      ).toContain('Canalitzar divinitat');
      expect(
        renderToStaticMarkup(
          React.createElement(StepEquipment, {
            state,
            config: strictConfig,
            isGm: false,
            onChange: noop,
          })
        )
      ).toContain('Cota d’escates');
      expect(
        renderToStaticMarkup(
          React.createElement(StepReview, {
            state,
            config: strictConfig,
            isGm: false,
            onJumpToStep: noop,
          })
        )
      ).toContain('Totes les comprovacions bàsiques de creació són correctes');

      const wizardPayload = buildSheetPatchFromWizard(state, strictConfig, false);
      const created = await createCharacterBase(db, playerCtx, camp.id, {
        name: wizardPayload.name,
        sheetData: wizardPayload.sheetData,
      });

      // El jugador no pot crear un segon personatge (límit maxCharactersPerPlayer = 1)
      await expect(
        createCharacterBase(db, playerCtx, camp.id, {
          name: 'Segon Personatge',
          sheetData: {
            ...wizardPayload.sheetData,
            generalInfo: {
              ...(wizardPayload.sheetData.generalInfo as Record<string, unknown>),
              name: 'Segon Personatge',
            },
          },
        })
      ).rejects.toMatchObject({ status: 403, code: 'CHARACTER_LIMIT_REACHED' });

      // Notes privades del GM ocultes al jugador
      await updateCharacterBase(db, gm.ctx, camp.id, created.id, {
        gmNotes: 'Missió oculta per Elowen',
      });

      // Càrrega a la fitxa universal + coherència entre pestanyes
      const loaded = await getCampaignCharacter(db, playerCtx, camp.id, created.id);
      expect('gmNotes' in loaded).toBe(false);
      expect(loaded.computed.abilities.dex.modifier).toBe(2); // 12 + 2 = 14
      expect(loaded.computed.abilities.wis.modifier).toBe(3); // 15 + 1 = 16
      // Cota d'escates (14 + min(2, DES +2) = 16) + Escut (+2) = 18
      expect(loaded.computed.combat.armorClass.value).toBe(18);
      expect(loaded.computed.combat.attacks.length).toBeGreaterThanOrEqual(1);
      expect(loaded.computed.spellcasting?.saveDc).toBe(13); // 8 + 2 prof + 3 WIS

      const sheetRecord: CharacterSheetRecord = {
        ...loaded,
        sheetData: loaded.sheetData as CharacterSheetRecord['sheetData'],
        createdAt: loaded.createdAt.toISOString(),
        updatedAt: loaded.updatedAt.toISOString(),
      };
      const access = buildSheetAccessContext(sheetRecord, false);
      const draft = createDraftFromCharacter(sheetRecord);

      expect(
        renderToStaticMarkup(
          React.createElement(MagicAndAbilitiesTab, {
            character: sheetRecord,
            draft,
            access,
            onUpdateDraft: noop,
          })
        )
      ).toContain('Curar ferides');
      expect(
        renderToStaticMarkup(
          React.createElement(InventoryTab, {
            character: sheetRecord,
            draft,
            access,
            onUpdateDraft: noop,
          })
        )
      ).toContain('Cota d’escates');
      expect(
        renderToStaticMarkup(
          React.createElement(CharacterIdentityConfigModal, {
            open: true,
            onClose: noop,
            campaignId: camp.id,
            character: sheetRecord,
            access,
            onUpdated: noop,
          })
        )
      ).toContain('Elowen');

      // Edició editable des de la fitxa (PATCH parcial d'identitat + equipament) es conserva després de recarregar
      await updateCharacterBase(db, playerCtx, camp.id, created.id, {
        sheetPatch: {
          generalInfo: { alignment: 'Legal Bo' },
          inventory: (loaded.sheetData as CharacterSheetRecord['sheetData']).inventory.map((i) =>
            i.category === 'shield' ? { ...i, equipped: false } : i
          ),
        },
      });

      const reloaded = await getCampaignCharacter(db, playerCtx, camp.id, created.id);
      expect((reloaded.sheetData.generalInfo as { alignment: string | null }).alignment).toBe('Legal Bo');
      expect(reloaded.computed.combat.armorClass.value).toBe(16); // sense escut
    } finally {
      await close();
    }
  });
});
