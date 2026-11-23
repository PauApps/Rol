import { describe, expect, it } from 'vitest';
import { createTestDb } from '@/db';
import { resolveSession } from '@/server/auth/session';
import {
  createCampaign,
  getCampaignDetail,
  listCampaignsForActor,
  purgeCampaign,
  restoreCampaign,
  trashCampaign,
  updateCampaign,
} from '@/server/services/campaign-service';
import { createCharacterBase, listCampaignCharacters } from '@/server/services/character-service';
import {
  acceptPlayerInvitation,
  createPlayerInvitation,
} from '@/server/services/player-invitation-service';
import { bootstrapAdmin, createInvitedGm } from './helpers';

describe('Campanyes, estats, paperera de 30 dies i aïllament estricte', () => {
  it('permet crear campanyes, canviar estats, enviar a paperera 30 dies, recuperar i purgar amb confirmació', async () => {
    const { db, close } = await createTestDb();
    try {
      const admin = await bootstrapAdmin(db);
      const gm = await createInvitedGm(db, admin.ctx, 'gm.camp@rol.test', 'GM Campanyes');

      const camp = await createCampaign(db, gm.ctx, {
        name: 'Ombra sobre Waterdeep',
        systemId: 'dnd5e-2014',
      });
      expect(camp.status).toBe('active');

      // Estats activa -> pausada -> finalitzada
      const paused = await updateCampaign(db, gm.ctx, camp.id, {
        status: 'paused',
        description: 'Pausa d’estiu',
      });
      expect(paused.status).toBe('paused');

      const finished = await updateCampaign(db, gm.ctx, camp.id, { status: 'finished' });
      expect(finished.status).toBe('finished');

      // Les campanyes finalitzades continuen accessibles
      const detail = await getCampaignDetail(db, gm.ctx, camp.id);
      expect(detail.campaign.status).toBe('finished');

      // No es pot eliminar definitivament sense passar per la paperera
      await expect(
        purgeCampaign(db, gm.ctx, camp.id, 'Ombra sobre Waterdeep')
      ).rejects.toMatchObject({ status: 400, code: 'TRASH_FIRST_REQUIRED' });

      // Paperera reversible de 30 dies
      const trashed = await trashCampaign(db, gm.ctx, camp.id);
      expect(trashed.deletedAt).not.toBeNull();
      expect(trashed.purgeEligibleAt).not.toBeNull();

      const activeList = await listCampaignsForActor(db, gm.ctx, { includeTrash: false });
      const trashList = await listCampaignsForActor(db, gm.ctx, { includeTrash: true });
      expect(activeList).toHaveLength(0);
      expect(trashList).toHaveLength(1);

      // Recuperació dins del termini
      const restored = await restoreCampaign(db, gm.ctx, camp.id);
      expect(restored.deletedAt).toBeNull();
      expect(await listCampaignsForActor(db, gm.ctx)).toHaveLength(1);

      // Tornem a la paperera i provem eliminació definitiva amb confirmació explícita
      await trashCampaign(db, gm.ctx, camp.id);
      await expect(
        purgeCampaign(db, gm.ctx, camp.id, 'Nom Incorrecte')
      ).rejects.toMatchObject({ status: 400, code: 'CONFIRM_NAME_MISMATCH' });

      await purgeCampaign(db, gm.ctx, camp.id, 'Ombra sobre Waterdeep');
      expect(await listCampaignsForActor(db, gm.ctx, { includeTrash: true })).toHaveLength(0);
    } finally {
      await close();
    }
  });

  it('aïlla completament les campanyes entre GMs i entre jugadors/convidats', async () => {
    const { db, close } = await createTestDb();
    try {
      const admin = await bootstrapAdmin(db);
      const gmA = await createInvitedGm(db, admin.ctx, 'gma@rol.test', 'GM A');
      const gmB = await createInvitedGm(db, admin.ctx, 'gmb@rol.test', 'GM B');

      const campA = await createCampaign(db, gmA.ctx, {
        name: 'Campanya Secret A',
        systemId: 'dnd5e-2014',
      });
      const campB = await createCampaign(db, gmB.ctx, {
        name: 'Campanya Secret B',
        systemId: 'dnd5e-2014',
      });

      // GM B no veu la campanya de GM A ni hi pot accedir ni modificar-la ni convidar-hi jugadors
      const listB = await listCampaignsForActor(db, gmB.ctx);
      expect(listB.map((c) => c.id)).toEqual([campB.id]);

      await expect(getCampaignDetail(db, gmB.ctx, campA.id)).rejects.toMatchObject({
        status: 403,
      });
      await expect(
        updateCampaign(db, gmB.ctx, campA.id, { name: 'Segrestada' })
      ).rejects.toMatchObject({ status: 403 });
      await expect(trashCampaign(db, gmB.ctx, campA.id)).rejects.toMatchObject({ status: 403 });
      await expect(createPlayerInvitation(db, gmB.ctx, campA.id)).rejects.toMatchObject({
        status: 403,
      });
      await expect(listCampaignCharacters(db, gmB.ctx, campA.id)).rejects.toMatchObject({
        status: 403,
      });

      // Convidat de la campanya A no pot consultar la campanya B canviant l'ID
      const inviteA = await createPlayerInvitation(db, gmA.ctx, campA.id, { label: 'Pim' });
      const guestA = await acceptPlayerInvitation(db, inviteA.rawToken, {
        mode: 'guest',
        displayName: 'Pim Bramble',
      });
      const guestACtx = await resolveSession(db, guestA.rawToken);
      expect(guestACtx).not.toBeNull();

      // Accés permès a A, prohibit a B
      const detailAForGuest = await getCampaignDetail(db, guestACtx, campA.id);
      expect(detailAForGuest.campaign.id).toBe(campA.id);

      await expect(getCampaignDetail(db, guestACtx, campB.id)).rejects.toMatchObject({
        status: 403,
        code: 'CROSS_CAMPAIGN_FORBIDDEN',
      });
      await expect(listCampaignCharacters(db, guestACtx, campB.id)).rejects.toMatchObject({
        status: 403,
      });
      await expect(
        createCharacterBase(db, guestACtx, campB.id, { name: 'Intrus' })
      ).rejects.toMatchObject({ status: 403 });

      // Jugador registrat de la campanya A tampoc pot veure ni tocar la campanya B
      const inviteA2 = await createPlayerInvitation(db, gmA.ctx, campA.id);
      const regA = await acceptPlayerInvitation(db, inviteA2.rawToken, {
        mode: 'register',
        email: 'jugador.a@rol.test',
        displayName: 'Jugador A',
        password: 'PlayerPassword123!',
      });
      const regACtx = await resolveSession(db, regA.rawToken);
      expect((await listCampaignsForActor(db, regACtx)).map((c) => c.id)).toEqual([campA.id]);

      await expect(getCampaignDetail(db, regACtx, campB.id)).rejects.toMatchObject({
        status: 403,
      });
    } finally {
      await close();
    }
  });
});
