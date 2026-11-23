import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '@/db';
import { playerInvitations, users } from '@/db/schema';
import { resolveSession } from '@/server/auth/session';
import {
  createCampaign,
  getCampaignDetail,
  listCampaignsForActor,
  updateCampaign,
} from '@/server/services/campaign-service';
import { createCharacterBase, listCampaignCharacters } from '@/server/services/character-service';
import {
  acceptPlayerInvitation,
  createMemberRecoveryLink,
  createPlayerInvitation,
  inspectPlayerInvitation,
  revokeCampaignMember,
  revokePlayerInvitation,
} from '@/server/services/player-invitation-service';
import { bootstrapAdmin, createInvitedGm } from './helpers';

describe('Invitacions de jugadors, convidats, recuperació segura i protecció de dades privades', () => {
  it('gestiona invitacions vàlides sense caducitat automàtica, revocació i accés multi-campanya amb compte', async () => {
    const { db, close } = await createTestDb();
    try {
      const admin = await bootstrapAdmin(db);
      const gm = await createInvitedGm(db, admin.ctx, 'gm.inv@rol.test', 'GM Invitacions');
      const camp1 = await createCampaign(db, gm.ctx, {
        name: 'Campanya 1',
        systemId: 'dnd5e-2014',
      });
      const camp2 = await createCampaign(db, gm.ctx, {
        name: 'Campanya 2',
        systemId: 'dnd5e-2014',
      });

      // Invitació sense caducitat automàtica (simulem antiguitat de 120 dies a BD)
      const oldInvite = await createPlayerInvitation(db, gm.ctx, camp1.id, { label: 'Antiga' });
      await db
        .update(playerInvitations)
        .set({ createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000) })
        .where(eq(playerInvitations.id, oldInvite.invitation.id));

      const previewOld = await inspectPlayerInvitation(db, oldInvite.rawToken);
      expect(previewOld.campaignId).toBe(camp1.id);

      // Token mai guardat en clar a BD
      const [dbInv] = await db
        .select()
        .from(playerInvitations)
        .where(eq(playerInvitations.id, oldInvite.invitation.id));
      expect(dbInv.tokenHash).not.toBe(oldInvite.rawToken);

      // Acceptació creant compte registrat (sempre amb rol 'player')
      const joined1 = await acceptPlayerInvitation(db, oldInvite.rawToken, {
        mode: 'register',
        email: 'laia@rol.test',
        displayName: 'Laia',
        password: 'PlayerPassword123!',
      });
      const [laiaRow] = await db.select().from(users).where(eq(users.email, 'laia@rol.test'));
      expect(laiaRow.role).toBe('player');

      // No es pot reutilitzar la mateixa invitació
      await expect(
        acceptPlayerInvitation(db, oldInvite.rawToken, {
          mode: 'guest',
          displayName: 'Reutilitzat',
        })
      ).rejects.toMatchObject({ status: 410, code: 'INVITATION_USED' });

      // El mateix compte registrat s'uneix a una segona campanya
      const invite2 = await createPlayerInvitation(db, gm.ctx, camp2.id, { label: 'Laia C2' });
      await acceptPlayerInvitation(db, invite2.rawToken, {
        mode: 'login',
        email: 'laia@rol.test',
        password: 'PlayerPassword123!',
      });

      const laiaCtx = await resolveSession(db, joined1.rawToken);
      const laiaCampaigns = await listCampaignsForActor(db, laiaCtx);
      expect(laiaCampaigns.map((c) => c.id).sort()).toEqual([camp1.id, camp2.id].sort());

      // Invitació revocada no funciona
      const revokedInvite = await createPlayerInvitation(db, gm.ctx, camp1.id);
      await revokePlayerInvitation(db, gm.ctx, camp1.id, revokedInvite.invitation.id);

      await expect(inspectPlayerInvitation(db, revokedInvite.rawToken)).rejects.toMatchObject({
        status: 410,
        code: 'INVITATION_REVOKED',
      });
      await expect(
        acceptPlayerInvitation(db, revokedInvite.rawToken, {
          mode: 'guest',
          displayName: 'Tard',
        })
      ).rejects.toMatchObject({ status: 410 });
    } finally {
      await close();
    }
  });

  it('permet recuperar l’accés d’un convidat existent sense suplantar altres jugadors i protegeix dades privades', async () => {
    const { db, close } = await createTestDb();
    try {
      const admin = await bootstrapAdmin(db);
      const gm = await createInvitedGm(db, admin.ctx, 'gm.perm@rol.test', 'GM Permisos');
      const camp = await createCampaign(db, gm.ctx, {
        name: 'Expedició al Nord',
        systemId: 'dnd5e-2014',
      });

      // Entren dos convidats: Pim i Elara
      const invPim = await createPlayerInvitation(db, gm.ctx, camp.id, { label: 'Pim' });
      const pimJoin = await acceptPlayerInvitation(db, invPim.rawToken, {
        mode: 'guest',
        displayName: 'Pim Bramble',
      });
      const pimCtx1 = await resolveSession(db, pimJoin.rawToken);

      const invElara = await createPlayerInvitation(db, gm.ctx, camp.id, { label: 'Elara' });
      const elaraJoin = await acceptPlayerInvitation(db, invElara.rawToken, {
        mode: 'guest',
        displayName: 'Elara',
      });
      const elaraCtx = await resolveSession(db, elaraJoin.rawToken);

      // Creem un personatge per a cadascun
      const pimChar = await createCharacterBase(db, pimCtx1, camp.id, { name: 'Pim Bramble' });
      const elaraChar = await createCharacterBase(db, elaraCtx, camp.id, { name: 'Elara Lluna' });

      // Elara no pot crear un personatge assignat a Pim
      await expect(
        createCharacterBase(db, elaraCtx, camp.id, {
          name: 'Fals Pim',
          memberId: pimJoin.memberId,
        })
      ).rejects.toMatchObject({ status: 403, code: 'CHARACTER_OWNER_FORBIDDEN' });

      // Cada jugador només veu els seus personatges; el GM els veu tots
      const pimChars = await listCampaignCharacters(db, pimCtx1, camp.id);
      const elaraChars = await listCampaignCharacters(db, elaraCtx, camp.id);
      const gmChars = await listCampaignCharacters(db, gm.ctx, camp.id);
      expect(pimChars.map((c) => c.id)).toEqual([pimChar.id]);
      expect(elaraChars.map((c) => c.id)).toEqual([elaraChar.id]);
      expect(gmChars.map((c) => c.id).sort()).toEqual([pimChar.id, elaraChar.id].sort());

      // Dades privades al detall de campanya: el jugador no rep llistes d'invitacions ni membres d'altres jugadors
      const detailForPim = await getCampaignDetail(db, pimCtx1, camp.id);
      expect(detailForPim.canManage).toBe(false);
      expect('invitations' in detailForPim).toBe(false);
      expect('members' in detailForPim).toBe(false);

      // Permisos de jugador vs GM: el jugador no pot modificar la campanya ni generar invitacions
      await expect(
        updateCampaign(db, pimCtx1, camp.id, { status: 'paused' })
      ).rejects.toMatchObject({ status: 403 });
      await expect(createPlayerInvitation(db, pimCtx1, camp.id)).rejects.toMatchObject({
        status: 403,
      });
      await expect(
        createMemberRecoveryLink(db, pimCtx1, camp.id, elaraJoin.memberId)
      ).rejects.toMatchObject({ status: 403 });

      // El GM genera un enllaç de recuperació específic per a Pim
      const oldRecovery = await createMemberRecoveryLink(db, gm.ctx, camp.id, pimJoin.memberId);
      const newRecovery = await createMemberRecoveryLink(db, gm.ctx, camp.id, pimJoin.memberId);

      // L'enllaç de recuperació previ queda revocat automàticament en generar-ne un de nou
      await expect(
        acceptPlayerInvitation(db, oldRecovery.rawToken, { mode: 'recover' })
      ).rejects.toMatchObject({ status: 410, code: 'INVITATION_REVOKED' });

      // L'enllaç de recuperació NO es pot utilitzar per entrar com a convidat nou (evita crear identitat alternativa/suplantar)
      await expect(
        acceptPlayerInvitation(db, newRecovery.rawToken, {
          mode: 'guest',
          displayName: 'Elara',
        })
      ).rejects.toMatchObject({ status: 400, code: 'RECOVERY_MODE_REQUIRED' });

      // Recuperació correcta: restaura exactament Pim i invalida la sessió perduda prèvia
      const recovered = await acceptPlayerInvitation(db, newRecovery.rawToken, { mode: 'recover' });
      expect(recovered.memberId).toBe(pimJoin.memberId);
      expect(await resolveSession(db, pimJoin.rawToken)).toBeNull();

      const pimCtx2 = await resolveSession(db, recovered.rawToken);
      expect(pimCtx2?.kind).toBe('guest');
      if (pimCtx2?.kind === 'guest') {
        expect(pimCtx2.member.id).toBe(pimJoin.memberId);
      }

      // Revocar un jugador li talla l'accés immediatament
      await revokeCampaignMember(db, gm.ctx, camp.id, pimJoin.memberId);
      expect(await resolveSession(db, recovered.rawToken)).toBeNull();
    } finally {
      await close();
    }
  });
});
