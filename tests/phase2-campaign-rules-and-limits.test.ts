import { describe, expect, it } from 'vitest';
import { createTestDb } from '@/db';
import { resolveSession } from '@/server/auth/session';
import {
  createCampaign,
  getCampaignDetail,
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
import { bootstrapAdmin, createInvitedGm } from './helpers';

describe('Fase 2: Configuració de creació de personatges, límits i aïllament', () => {
  it('permet al GM configurar totes les regles de creació després de crear la campanya i les exposa als jugadors', async () => {
    const { db, close } = await createTestDb();
    try {
      const admin = await bootstrapAdmin(db);
      const gm = await createInvitedGm(db, admin.ctx, 'gm.rules@rol.test', 'GM Regles');
      const otherGm = await createInvitedGm(db, admin.ctx, 'gm.other@rol.test', 'GM Altre');

      const camp = await createCampaign(db, gm.ctx, {
        name: 'Regne de Cormyr',
        systemId: 'dnd5e-2014',
      });

      const initialDetail = await getCampaignDetail(db, gm.ctx, camp.id);
      expect(initialDetail.campaign.creationConfig.freedomMode).toBe('free');
      expect(initialDetail.campaign.creationConfig.startingLevel).toBe(1);
      expect(initialDetail.campaign.maxCharactersPerPlayer).toBeNull();

      // Edició completa de les 8 opcions de configuració i límit
      const updated = await updateCampaignCharacterRules(db, gm.ctx, camp.id, {
        maxCharactersPerPlayer: 2,
        creationConfig: {
          freedomMode: 'strict',
          startingLevel: 3,
          allowedRaces: ['Humà', 'Elf', 'Elf', 'Nan'],
          allowedClasses: ['Guerrer', 'Clergue', 'Mag'],
          allowedBackgrounds: ['Soldat', 'Acòlit'],
          abilityScoreMethod: 'point_buy',
          requiredFields: ['race', 'class', 'background', 'backstory'],
          restrictions: 'Només llibres bàsics de D&D 5e 2014.',
        },
      });

      expect(updated.maxCharactersPerPlayer).toBe(2);
      expect(updated.creationConfig).toEqual({
        freedomMode: 'strict',
        startingLevel: 3,
        allowedRaces: ['Humà', 'Elf', 'Nan'],
        allowedClasses: ['Guerrer', 'Clergue', 'Mag'],
        allowedBackgrounds: ['Soldat', 'Acòlit'],
        abilityScoreMethod: 'point_buy',
        requiredFields: ['race', 'class', 'background', 'backstory', 'name'],
        restrictions: 'Només llibres bàsics de D&D 5e 2014.',
      });

      // Un altre GM no pot modificar la configuració
      await expect(
        updateCampaignCharacterRules(db, otherGm.ctx, camp.id, {
          maxCharactersPerPlayer: 1,
        })
      ).rejects.toMatchObject({ status: 403 });

      // Validació de valors incorrectes
      await expect(
        updateCampaignCharacterRules(db, gm.ctx, camp.id, {
          creationConfig: { startingLevel: 25 },
        })
      ).rejects.toMatchObject({ status: 400, code: 'INVALID_CREATION_CONFIG' });

      await expect(
        updateCampaignCharacterRules(db, gm.ctx, camp.id, {
          maxCharactersPerPlayer: 0,
        })
      ).rejects.toMatchObject({ status: 400, code: 'INVALID_CHARACTER_LIMIT' });

      // Un jugador de la campanya consulta les regles i crea un personatge que hereta el nivell inicial
      const invite = await createPlayerInvitation(db, gm.ctx, camp.id);
      const joined = await acceptPlayerInvitation(db, invite.rawToken, {
        mode: 'guest',
        displayName: 'Bram',
      });
      const guestCtx = await resolveSession(db, joined.rawToken);

      await expect(
        updateCampaignCharacterRules(db, guestCtx, camp.id, { maxCharactersPerPlayer: 5 })
      ).rejects.toMatchObject({ status: 403 });

      const playerDetail = await getCampaignDetail(db, guestCtx, camp.id);
      expect(playerDetail.campaign.creationConfig.startingLevel).toBe(3);
      expect(playerDetail.campaign.maxCharactersPerPlayer).toBe(2);

      const createdChar = await createCharacterBase(db, guestCtx, camp.id, { name: 'Sir Bram' });
      expect((createdChar.sheetData.progression as Record<string, unknown>).totalLevel).toBe(3);
    } finally {
      await close();
    }
  });

  it('valida el límit de personatges per jugador al servidor i manté aïllament entre campanyes', async () => {
    const { db, close } = await createTestDb();
    try {
      const admin = await bootstrapAdmin(db);
      const gm = await createInvitedGm(db, admin.ctx, 'gm.limit@rol.test', 'GM Límits');

      const campA = await createCampaign(db, gm.ctx, {
        name: 'Campanya Limitada',
        systemId: 'dnd5e-2014',
      });
      const campB = await createCampaign(db, gm.ctx, {
        name: 'Campanya Altra',
        systemId: 'dnd5e-2014',
      });

      await updateCampaignCharacterRules(db, gm.ctx, campA.id, {
        maxCharactersPerPlayer: 1,
      });

      const invGuest = await createPlayerInvitation(db, gm.ctx, campA.id);
      const guest = await acceptPlayerInvitation(db, invGuest.rawToken, {
        mode: 'guest',
        displayName: 'Convidat Límit',
      });
      const guestCtx = await resolveSession(db, guest.rawToken);

      const invReg = await createPlayerInvitation(db, gm.ctx, campA.id);
      const reg = await acceptPlayerInvitation(db, invReg.rawToken, {
        mode: 'register',
        email: 'reg.limit@rol.test',
        displayName: 'Registrat Límit',
        password: 'PlayerPassword123!',
      });
      const regCtx = await resolveSession(db, reg.rawToken);

      // Tant el convidat com el registrat poden crear 1 personatge
      const g1 = await createCharacterBase(db, guestCtx, campA.id, { name: 'Heroi Convidat 1' });
      await createCharacterBase(db, regCtx, campA.id, { name: 'Heroi Registrat 1' });

      // El segon personatge queda bloquejat al servidor (fins i tot si envia overrideLimit: true)
      await expect(
        createCharacterBase(db, guestCtx, campA.id, {
          name: 'Heroi Convidat 2',
          overrideLimit: true,
        })
      ).rejects.toMatchObject({ status: 403, code: 'CHARACTER_LIMIT_REACHED' });

      await expect(
        createCharacterBase(db, regCtx, campA.id, { name: 'Heroi Registrat 2' })
      ).rejects.toMatchObject({ status: 403, code: 'CHARACTER_LIMIT_REACHED' });

      // El GM tampoc pot assignar-li un segon personatge sense activar excepció explícita
      await expect(
        createCharacterBase(db, gm.ctx, campA.id, {
          name: 'Extra GM sense excepció',
          memberId: guest.memberId,
        })
      ).rejects.toMatchObject({ status: 403, code: 'CHARACTER_LIMIT_REACHED' });

      // Però el GM sí pot crear PNJs sense jugador o usar overrideLimit
      const gmNpc = await createCharacterBase(db, gm.ctx, campA.id, { name: 'PNJ Taverna' });
      expect(gmNpc.memberId).toBeNull();
      const gmOverride = await createCharacterBase(db, gm.ctx, campA.id, {
        name: 'Heroi Excepció',
        memberId: guest.memberId,
        overrideLimit: true,
      });
      expect(gmOverride.memberId).toBe(guest.memberId);

      // Si el GM amplia el límit a 3 o el treu, el jugador pot tornar a crear
      await updateCampaignCharacterRules(db, gm.ctx, campA.id, {
        maxCharactersPerPlayer: null,
      });
      const g3 = await createCharacterBase(db, guestCtx, campA.id, { name: 'Heroi Sense Límit' });
      expect(g3.name).toBe('Heroi Sense Límit');

      // Aïllament entre campanyes sobre consulta/edició de personatges
      const invCampB = await createPlayerInvitation(db, gm.ctx, campB.id);
      const guestB = await acceptPlayerInvitation(db, invCampB.rawToken, {
        mode: 'guest',
        displayName: 'Jugador B',
      });
      const guestBCtx = await resolveSession(db, guestB.rawToken);

      await expect(listCampaignCharacters(db, guestBCtx, campA.id)).rejects.toMatchObject({
        status: 403,
        code: 'CROSS_CAMPAIGN_FORBIDDEN',
      });
      await expect(
        getCampaignCharacter(db, guestBCtx, campA.id, g1.id)
      ).rejects.toMatchObject({ status: 403, code: 'CROSS_CAMPAIGN_FORBIDDEN' });
      await expect(
        updateCharacterBase(db, guestBCtx, campA.id, g1.id, { name: 'Hack' })
      ).rejects.toMatchObject({ status: 403, code: 'CROSS_CAMPAIGN_FORBIDDEN' });
    } finally {
      await close();
    }
  });
});
