import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '@/db';
import { auditLogs, gmInvitations, sessions, users } from '@/db/schema';
import { AppError } from '@/domain/errors';
import { resolveSession } from '@/server/auth/session';
import {
  createGmInvitation,
  listAuditLogs,
  listUsers,
  revokeGmInvitation,
  updateUserStatus,
} from '@/server/services/admin-service';
import {
  inspectGmInvitation,
  loginWithPassword,
  logoutSession,
  registerGmWithInvitation,
} from '@/server/services/auth-service';
import { bootstrapAdmin, createInvitedGm } from './helpers';

describe('Autenticació, administració i registre tancat de GM', () => {
  it('permet al admin convidar un GM, registra el GM una sola vegada i bloqueja registre públic o reús', async () => {
    const { db, close } = await createTestDb();
    try {
      const admin = await bootstrapAdmin(db);

      const { invitation, rawToken } = await createGmInvitation(db, admin.ctx, {
        email: 'master.nou@rol.test',
        note: 'Grup de divendres',
      });

      // El token mai s'emmagatzema en text pla
      const [dbInvite] = await db
        .select()
        .from(gmInvitations)
        .where(eq(gmInvitations.id, invitation.id));
      expect(dbInvite.tokenHash).not.toBe(rawToken);
      expect(dbInvite.tokenHash).toHaveLength(64);

      const preview = await inspectGmInvitation(db, rawToken);
      expect(preview.email).toBe('master.nou@rol.test');

      // Bloqueja el registre si el correu no coincideix amb la invitació
      await expect(
        registerGmWithInvitation(db, {
          rawToken,
          email: 'impostor@rol.test',
          displayName: 'Impostor',
          password: 'Password123!',
        })
      ).rejects.toMatchObject({ status: 403, code: 'INVITATION_EMAIL_MISMATCH' });

      // Bloqueja qualsevol intent de registre sense token vàlid
      await expect(
        registerGmWithInvitation(db, {
          rawToken: 'token-fals-inventat-123456',
          email: 'master.nou@rol.test',
          displayName: 'Master',
          password: 'Password123!',
        })
      ).rejects.toMatchObject({ status: 404 });

      // Registre autoritzat
      const registered = await registerGmWithInvitation(db, {
        rawToken,
        email: 'master.nou@rol.test',
        displayName: 'Master Nou',
        password: 'MasterPassword123!',
      });
      expect(registered.user.role).toBe('gm');

      // La contrasenya mai queda en text pla
      const [dbUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, registered.user.id));
      expect(dbUser.passwordHash).toContain('scrypt$');
      expect(dbUser.passwordHash).not.toContain('MasterPassword123!');

      // No permet reutilitzar la invitació
      await expect(
        registerGmWithInvitation(db, {
          rawToken,
          email: 'master.nou@rol.test',
          displayName: 'Master Repetit',
          password: 'MasterPassword123!',
        })
      ).rejects.toMatchObject({ status: 410, code: 'GM_INVITATION_USED' });
    } finally {
      await close();
    }
  });

  it('bloqueja invitacions de GM revocades i impedeix a un GM convidar altres GM', async () => {
    const { db, close } = await createTestDb();
    try {
      const admin = await bootstrapAdmin(db);
      const gm = await createInvitedGm(db, admin.ctx, 'gm1@rol.test', 'GM 1');

      // Un GM no pot crear invitacions de GM ni veure els comptes de la plataforma
      await expect(
        createGmInvitation(db, gm.ctx, { email: 'altregm@rol.test' })
      ).rejects.toMatchObject({ status: 403, code: 'ADMIN_REQUIRED' });

      await expect(listUsers(db, gm.ctx)).rejects.toMatchObject({ status: 403 });
      await expect(listAuditLogs(db, gm.ctx)).rejects.toMatchObject({ status: 403 });

      // Admin revoca una invitació pendent
      const { invitation, rawToken } = await createGmInvitation(db, admin.ctx, {
        email: 'revocat@rol.test',
      });
      await revokeGmInvitation(db, admin.ctx, invitation.id);

      await expect(inspectGmInvitation(db, rawToken)).rejects.toMatchObject({
        status: 410,
        code: 'GM_INVITATION_REVOKED',
      });
      await expect(
        registerGmWithInvitation(db, {
          rawToken,
          email: 'revocat@rol.test',
          displayName: 'GM Revocat',
          password: 'Password123!',
        })
      ).rejects.toMatchObject({ status: 410 });
    } finally {
      await close();
    }
  });

  it('tanca sessió correctament i invalida immediatament les sessions quan es bloqueja o desactiva un compte', async () => {
    const { db, close } = await createTestDb();
    try {
      const admin = await bootstrapAdmin(db);
      const gm = await createInvitedGm(db, admin.ctx, 'gm.sessio@rol.test', 'GM Sessió');

      // Tancament de sessió revoca el token
      await logoutSession(db, gm.ctx);
      expect(await resolveSession(db, gm.rawToken)).toBeNull();

      // Nou inici de sessió vàlid
      const relogin = await loginWithPassword(db, {
        email: 'gm.sessio@rol.test',
        password: 'GmPassword123!',
      });
      const activeCtx = await resolveSession(db, relogin.rawToken);
      expect(activeCtx?.kind).toBe('user');

      // Els tokens de sessió mai es guarden en text pla
      const dbSessions = await db.select().from(sessions);
      for (const s of dbSessions) {
        expect(s.tokenHash).not.toBe(relogin.rawToken);
        expect(s.tokenHash).toHaveLength(64);
      }

      // Bloqueig per l'administrador invalida immediatament la sessió i impedeix entrar
      await updateUserStatus(db, admin.ctx, gm.user.id, 'blocked');
      expect(await resolveSession(db, relogin.rawToken)).toBeNull();

      await expect(
        loginWithPassword(db, {
          email: 'gm.sessio@rol.test',
          password: 'GmPassword123!',
        })
      ).rejects.toBeInstanceOf(AppError);

      // Desactivar i reactivar
      await updateUserStatus(db, admin.ctx, gm.user.id, 'disabled');
      await expect(
        loginWithPassword(db, {
          email: 'gm.sessio@rol.test',
          password: 'GmPassword123!',
        })
      ).rejects.toMatchObject({ status: 403, code: 'ACCOUNT_DISABLED' });

      await updateUserStatus(db, admin.ctx, gm.user.id, 'active');
      const reactivatedLogin = await loginWithPassword(db, {
        email: 'gm.sessio@rol.test',
        password: 'GmPassword123!',
      });
      expect(await resolveSession(db, reactivatedLogin.rawToken)).not.toBeNull();

      // L'administrador no es pot bloquejar a si mateix
      await expect(
        updateUserStatus(db, admin.ctx, admin.user.id, 'blocked')
      ).rejects.toMatchObject({ status: 400, code: 'SELF_STATUS_FORBIDDEN' });

      // L'auditoria no conté tokens en clar
      const logs = await db.select().from(auditLogs);
      const serialized = JSON.stringify(logs);
      expect(serialized).not.toContain(relogin.rawToken);
      expect(serialized).not.toContain('GmPassword123!');
    } finally {
      await close();
    }
  });
});
