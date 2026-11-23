import { describe, expect, it } from 'vitest';
import { createTestDb } from '@/db';
import { resolveSession } from '@/server/auth/session';
import { loginWithPassword, logoutSession } from '@/server/services/auth-service';
import {
  createCampaign,
  getCampaignDetail,
  updateCampaignCharacterRules,
} from '@/server/services/campaign-service';
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

describe('Fase 3 (Increment 1): Dau virtual controlat pel GM i persistència universal', () => {
  it('només el GM propietari pot activar o desactivar el dau virtual de la campanya', async () => {
    const { db, close } = await createTestDb();
    try {
      const admin = await bootstrapAdmin(db);
      const gm = await createInvitedGm(db, admin.ctx, 'gm.dice@rol.test', 'GM Daus');
      const otherGm = await createInvitedGm(db, admin.ctx, 'gm.otherdice@rol.test', 'Altre GM');

      const camp = await createCampaign(db, gm.ctx, {
        name: 'Campanya de Daus',
        systemId: 'dnd5e-2014',
      });

      // Per defecte desactivat (daus físics)
      const initial = await getCampaignDetail(db, gm.ctx, camp.id);
      expect(initial.campaign.virtualDiceEnabled).toBe(false);

      // Convida un jugador i un convidat
      const invGuest = await createPlayerInvitation(db, gm.ctx, camp.id);
      const guestJoin = await acceptPlayerInvitation(db, invGuest.rawToken, {
        mode: 'guest',
        displayName: 'Jugador Convidat',
      });
      const guestCtx = await resolveSession(db, guestJoin.rawToken);

      const invReg = await createPlayerInvitation(db, gm.ctx, camp.id);
      const regJoin = await acceptPlayerInvitation(db, invReg.rawToken, {
        mode: 'register',
        email: 'reg.dice@rol.test',
        displayName: 'Jugador Registrat',
        password: 'PlayerPassword123!',
      });
      const regCtx = await resolveSession(db, regJoin.rawToken);

      // Cap jugador, convidat ni altre GM pot modificar virtualDiceEnabled
      await expect(
        updateCampaignCharacterRules(db, guestCtx, camp.id, { virtualDiceEnabled: true })
      ).rejects.toMatchObject({ status: 403 });

      await expect(
        updateCampaignCharacterRules(db, regCtx, camp.id, { virtualDiceEnabled: true })
      ).rejects.toMatchObject({ status: 403 });

      await expect(
        updateCampaignCharacterRules(db, otherGm.ctx, camp.id, { virtualDiceEnabled: true })
      ).rejects.toMatchObject({ status: 403 });

      // El GM propietari activa el dau virtual i tots els membres ho reben des del servidor
      await updateCampaignCharacterRules(db, gm.ctx, camp.id, { virtualDiceEnabled: true });
      const guestDetailEnabled = await getCampaignDetail(db, guestCtx, camp.id);
      expect(guestDetailEnabled.campaign.virtualDiceEnabled).toBe(true);

      // El GM pot tornar a desactivar-lo en qualsevol moment
      await updateCampaignCharacterRules(db, gm.ctx, camp.id, { virtualDiceEnabled: false });
      const regDetailDisabled = await getCampaignDetail(db, regCtx, camp.id);
      expect(regDetailDisabled.campaign.virtualDiceEnabled).toBe(false);
    } finally {
      await close();
    }
  });

  it('persisteix personatges de classes diferents sense dades de Pim després de tancar i reobrir sessió', async () => {
    const { db, close } = await createTestDb();
    try {
      const admin = await bootstrapAdmin(db);
      const gm = await createInvitedGm(db, admin.ctx, 'gm.persist@rol.test', 'GM Persistència');
      const camp = await createCampaign(db, gm.ctx, {
        name: 'Campanya Universal',
        systemId: 'dnd5e-2014',
      });

      const inv = await createPlayerInvitation(db, gm.ctx, camp.id);
      const reg = await acceptPlayerInvitation(db, inv.rawToken, {
        mode: 'register',
        email: 'jugador.classes@rol.test',
        displayName: 'Marc',
        password: 'PlayerPassword123!',
      });
      const playerCtx1 = await resolveSession(db, reg.rawToken);

      const barb = await createCharacterBase(db, playerCtx1, camp.id, { name: 'Thokk' });
      expect(barb.schemaVersion).toBe(2);
      expect(JSON.stringify(barb.sheetData)).not.toContain('Pim');

      await updateCharacterBase(db, playerCtx1, camp.id, barb.id, {
        sheetFields: {
          'background.backstory': 'Guerrer de les muntanyes del nord.',
        },
      });

      // Tanca sessió i torna a iniciar sessió
      await logoutSession(db, playerCtx1);
      expect(await resolveSession(db, reg.rawToken)).toBeNull();

      const relogin = await loginWithPassword(db, {
        email: 'jugador.classes@rol.test',
        password: 'PlayerPassword123!',
      });
      const playerCtx2 = await resolveSession(db, relogin.rawToken);

      const reloaded = await getCampaignCharacter(db, playerCtx2, camp.id, barb.id);
      expect(reloaded.name).toBe('Thokk');
      expect((reloaded.sheetData.background as Record<string, unknown>).backstory).toBe(
        'Guerrer de les muntanyes del nord.'
      );
    } finally {
      await close();
    }
  });
});
