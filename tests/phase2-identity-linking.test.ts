import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '@/db';
import { campaignMembers, characters, users } from '@/db/schema';
import { resolveSession } from '@/server/auth/session';
import { loginWithPassword } from '@/server/services/auth-service';
import {
  createCampaign,
  listCampaignsForActor,
  updateCampaignCharacterRules,
} from '@/server/services/campaign-service';
import { createCharacterBase, listCampaignCharacters } from '@/server/services/character-service';
import {
  linkGuestToExistingAccount,
  linkGuestToNewAccount,
} from '@/server/services/identity-linking-service';
import {
  acceptPlayerInvitation,
  createMemberRecoveryLink,
  createPlayerInvitation,
  revokeCampaignMember,
} from '@/server/services/player-invitation-service';
import { bootstrapAdmin, createInvitedGm } from './helpers';

describe('Fase 2: Vinculació d’identitat de convidats a comptes registrats', () => {
  it('permet a un convidat crear un compte nou conservant el seu membre i personatges sense duplicats', async () => {
    const { db, close } = await createTestDb();
    try {
      const admin = await bootstrapAdmin(db);
      const gm = await createInvitedGm(db, admin.ctx, 'gm.link1@rol.test', 'GM Link 1');
      const camp = await createCampaign(db, gm.ctx, {
        name: 'Expedició Subterrània',
        systemId: 'dnd5e-2014',
      });

      const inv = await createPlayerInvitation(db, gm.ctx, camp.id);
      const guestJoin = await acceptPlayerInvitation(db, inv.rawToken, {
        mode: 'guest',
        displayName: 'Pim Convidat',
      });
      const guestCtx = await resolveSession(db, guestJoin.rawToken);

      // El convidat crea un personatge i rep un enllaç de recuperació pendent
      const pimChar = await createCharacterBase(db, guestCtx, camp.id, { name: 'Pim Bramble' });
      const recovery = await createMemberRecoveryLink(db, gm.ctx, camp.id, guestJoin.memberId);

      // Un actor no convidat o no autenticat no pot cridar la vinculació
      await expect(
        linkGuestToNewAccount(db, null, {
          email: 'anon@rol.test',
          password: 'Password123!',
        })
      ).rejects.toMatchObject({ status: 401 });
      await expect(
        linkGuestToNewAccount(db, gm.ctx, {
          email: 'gm.try@rol.test',
          password: 'Password123!',
        })
      ).rejects.toMatchObject({ status: 403, code: 'GUEST_SESSION_REQUIRED' });

      // Vinculació a un compte nou
      const linked = await linkGuestToNewAccount(db, guestCtx, {
        email: 'pim@rol.test',
        displayName: 'Pim Registrat',
        password: 'PlayerPassword123!',
      });

      expect(linked.user.role).toBe('player');
      expect(linked.memberId).toBe(guestJoin.memberId);
      expect(linked.merged).toBe(false);

      // L'antiga sessió de convidat i l'enllaç de recuperació pendent queden revocats
      expect(await resolveSession(db, guestJoin.rawToken)).toBeNull();
      await expect(
        acceptPlayerInvitation(db, recovery.rawToken, { mode: 'recover' })
      ).rejects.toMatchObject({ status: 410 });

      // La nova sessió de compte funciona i conserva el mateix personatge sense duplicar membres
      const regCtx = await resolveSession(db, linked.rawToken);
      expect(regCtx?.kind).toBe('user');

      const membersInCamp = await db
        .select()
        .from(campaignMembers)
        .where(eq(campaignMembers.campaignId, camp.id));
      expect(membersInCamp).toHaveLength(1);
      expect(membersInCamp[0].memberType).toBe('registered');
      expect(membersInCamp[0].userId).toBe(linked.user.id);

      const chars = await listCampaignCharacters(db, regCtx, camp.id);
      expect(chars.map((c) => c.id)).toEqual([pimChar.id]);
      expect(chars[0].isMine).toBe(true);
    } finally {
      await close();
    }
  });

  it('permet vincular un convidat a un compte existent amb verificació de contrasenya i fusió segura sense duplicar', async () => {
    const { db, close } = await createTestDb();
    try {
      const admin = await bootstrapAdmin(db);
      const gm = await createInvitedGm(db, admin.ctx, 'gm.link2@rol.test', 'GM Link 2');

      const camp1 = await createCampaign(db, gm.ctx, { name: 'Campanya Un', systemId: 'dnd5e-2014' });
      const camp2 = await createCampaign(db, gm.ctx, { name: 'Campanya Dos', systemId: 'dnd5e-2014' });

      // Laia ja té un compte registrat a Campanya Un
      const invLaiaC1 = await createPlayerInvitation(db, gm.ctx, camp1.id);
      await acceptPlayerInvitation(db, invLaiaC1.rawToken, {
        mode: 'register',
        email: 'laia@rol.test',
        displayName: 'Laia',
        password: 'LaiaPassword123!',
      });

      // Laia havia entrat com a convidada a Campanya Dos i ja hi havia creat un personatge
      const invGuestC2 = await createPlayerInvitation(db, gm.ctx, camp2.id);
      const guestC2 = await acceptPlayerInvitation(db, invGuestC2.rawToken, {
        mode: 'guest',
        displayName: 'Laia Taula 2',
      });
      const guestC2Ctx = await resolveSession(db, guestC2.rawToken);
      const charC2 = await createCharacterBase(db, guestC2Ctx, camp2.id, { name: 'Lyra C2' });

      // Contrasenya incorrecta o compte d'admin queden rebutjats
      await expect(
        linkGuestToExistingAccount(db, guestC2Ctx, {
          email: 'laia@rol.test',
          password: 'ContrasenyaErrònia!',
        })
      ).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });

      await expect(
        linkGuestToExistingAccount(db, guestC2Ctx, {
          email: 'admin@rol.test',
          password: 'AdminPassword123!',
        })
      ).rejects.toMatchObject({ status: 403, code: 'ADMIN_CANNOT_BE_PLAYER' });

      // Vincula el convidat de Campanya Dos al seu compte existent
      const linkedC2 = await linkGuestToExistingAccount(db, guestC2Ctx, {
        email: 'laia@rol.test',
        password: 'LaiaPassword123!',
      });
      expect(linkedC2.merged).toBe(false);
      expect(await resolveSession(db, guestC2.rawToken)).toBeNull();

      const laiaCtx = await resolveSession(db, linkedC2.rawToken);
      const laiaCampaigns = await listCampaignsForActor(db, laiaCtx);
      expect(laiaCampaigns.map((c) => c.id).sort()).toEqual([camp1.id, camp2.id].sort());

      const charsInC2 = await listCampaignCharacters(db, laiaCtx, camp2.id);
      expect(charsInC2.map((c) => c.id)).toEqual([charC2.id]);
      expect(charsInC2[0].isMine).toBe(true);

      // Ara provem el cas de fusió dins la MATEIXA campanya:
      // Laia té un altre convidat temporal a Campanya Un i el fusiona al seu compte sense duplicar membres ni personatges
      const invDupGuest = await createPlayerInvitation(db, gm.ctx, camp1.id);
      const dupGuest = await acceptPlayerInvitation(db, invDupGuest.rawToken, {
        mode: 'guest',
        displayName: 'Laia Mòbil',
      });
      const dupGuestCtx = await resolveSession(db, dupGuest.rawToken);
      const charFromGuest = await createCharacterBase(db, dupGuestCtx, camp1.id, {
        name: 'Personatge Mòbil',
      });

      // Comprovem que no es pot saltar el límit de personatges mitjançant fusió
      const laiaLogin = await loginWithPassword(db, {
        email: 'laia@rol.test',
        password: 'LaiaPassword123!',
      });
      const laiaLoginCtx = await resolveSession(db, laiaLogin.rawToken);
      await createCharacterBase(db, laiaLoginCtx, camp1.id, { name: 'Personatge Principal' });

      await updateCampaignCharacterRules(db, gm.ctx, camp1.id, {
        maxCharactersPerPlayer: 1,
      });
      await expect(
        linkGuestToExistingAccount(db, dupGuestCtx, {
          email: 'laia@rol.test',
          password: 'LaiaPassword123!',
        })
      ).rejects.toMatchObject({ status: 409, code: 'CHARACTER_LIMIT_EXCEEDED_ON_MERGE' });

      // Ampliem límit a 2 i fusionem
      await updateCampaignCharacterRules(db, gm.ctx, camp1.id, {
        maxCharactersPerPlayer: 2,
      });
      const mergedResult = await linkGuestToExistingAccount(db, dupGuestCtx, {
        email: 'laia@rol.test',
        password: 'LaiaPassword123!',
      });
      expect(mergedResult.merged).toBe(true);

      // Només hi ha un únic membre per a Laia a Campanya Un i conserva els 2 personatges
      const [laiaUser] = await db.select().from(users).where(eq(users.email, 'laia@rol.test'));
      const c1Members = await db
        .select()
        .from(campaignMembers)
        .where(eq(campaignMembers.campaignId, camp1.id));
      expect(c1Members.filter((m) => m.userId === laiaUser.id)).toHaveLength(1);
      expect(c1Members).toHaveLength(1);

      const mergedCtx = await resolveSession(db, mergedResult.rawToken);
      const c1Chars = await listCampaignCharacters(db, mergedCtx, camp1.id);
      expect(c1Chars.map((c) => c.id)).toContain(charFromGuest.id);
      expect(c1Chars).toHaveLength(2);
      expect(c1Chars.every((c) => c.isMine)).toBe(true);

      // Si una identitat va ser revocada en una campanya, un convidat nou no es pot fusionar per saltar-se la revocació
      await revokeCampaignMember(db, gm.ctx, camp1.id, mergedResult.memberId);
      const invSneaky = await createPlayerInvitation(db, gm.ctx, camp1.id);
      const sneakyGuest = await acceptPlayerInvitation(db, invSneaky.rawToken, {
        mode: 'guest',
        displayName: 'Reentrada',
      });
      const sneakyCtx = await resolveSession(db, sneakyGuest.rawToken);
      await expect(
        linkGuestToExistingAccount(db, sneakyCtx, {
          email: 'laia@rol.test',
          password: 'LaiaPassword123!',
        })
      ).rejects.toMatchObject({ status: 403, code: 'MEMBER_REVOKED_IN_CAMPAIGN' });

      // També comprovem que un usuari que és GM de camp1 no s'hi pot vincular com a jugador convidat
      const gmChars = await db
        .select({ id: characters.id })
        .from(characters)
        .where(eq(characters.campaignId, camp1.id));
      expect(gmChars).toHaveLength(2);
    } finally {
      await close();
    }
  });
});
