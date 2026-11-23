import { and, desc, eq, isNull } from 'drizzle-orm';
import { auditLogs, gmInvitations, users, type UserStatus } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { badRequest, conflict, notFound } from '@/domain/errors';
import { generateSecureToken, hashToken } from '../auth/crypto';
import { assertAdmin } from '../auth/policies';
import { revokeAllSessionsForUser, type AuthContext } from '../auth/session';
import { recordAuditLog } from './audit-service';
import { normalizeEmail } from './auth-service';

export async function createGmInvitation(
  db: AppDatabase,
  ctx: AuthContext | null,
  input: { email: string; note?: string }
) {
  const adminCtx = assertAdmin(ctx);
  const email = normalizeEmail(input.email);
  const note = (input.note ?? '').trim();

  if (!email || !email.includes('@')) {
    throw badRequest('INVALID_EMAIL', 'Introdueix un correu electrònic vàlid.');
  }

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser) {
    throw conflict('EMAIL_IN_USE', 'Aquest correu ja té un compte registrat a la plataforma.');
  }

  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);

  const [created] = await db
    .insert(gmInvitations)
    .values({
      tokenHash,
      email,
      note,
      invitedByUserId: adminCtx.user.id,
    })
    .returning({
      id: gmInvitations.id,
      email: gmInvitations.email,
      note: gmInvitations.note,
      createdAt: gmInvitations.createdAt,
    });

  await recordAuditLog(db, {
    actorUserId: adminCtx.user.id,
    action: 'admin.gm_invitation.created',
    targetType: 'gm_invitation',
    targetId: created.id,
    metadata: { email: created.email },
  });

  return {
    invitation: created,
    rawToken,
    invitePath: `/invite/gm/${rawToken}`,
  };
}

export async function listGmInvitations(db: AppDatabase, ctx: AuthContext | null) {
  assertAdmin(ctx);

  return db
    .select({
      id: gmInvitations.id,
      email: gmInvitations.email,
      note: gmInvitations.note,
      usedAt: gmInvitations.usedAt,
      revokedAt: gmInvitations.revokedAt,
      createdAt: gmInvitations.createdAt,
    })
    .from(gmInvitations)
    .orderBy(desc(gmInvitations.createdAt));
}

export async function revokeGmInvitation(
  db: AppDatabase,
  ctx: AuthContext | null,
  invitationId: string
) {
  const adminCtx = assertAdmin(ctx);

  const [updated] = await db
    .update(gmInvitations)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(gmInvitations.id, invitationId),
        isNull(gmInvitations.usedAt),
        isNull(gmInvitations.revokedAt)
      )
    )
    .returning({
      id: gmInvitations.id,
      email: gmInvitations.email,
      revokedAt: gmInvitations.revokedAt,
    });

  if (!updated) {
    throw notFound(
      'GM_INVITATION_NOT_REVOCABLE',
      'No s’ha trobat una invitació pendent amb aquest identificador.'
    );
  }

  await recordAuditLog(db, {
    actorUserId: adminCtx.user.id,
    action: 'admin.gm_invitation.revoked',
    targetType: 'gm_invitation',
    targetId: updated.id,
    metadata: { email: updated.email },
  });

  return updated;
}

export async function listUsers(db: AppDatabase, ctx: AuthContext | null) {
  assertAdmin(ctx);

  return db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      status: users.status,
      maxCampaigns: users.maxCampaigns,
      preferredLocale: users.preferredLocale,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));
}

export async function updateUserStatus(
  db: AppDatabase,
  ctx: AuthContext | null,
  targetUserId: string,
  nextStatus: UserStatus
) {
  const adminCtx = assertAdmin(ctx);

  if (targetUserId === adminCtx.user.id) {
    throw badRequest(
      'SELF_STATUS_FORBIDDEN',
      'No pots bloquejar ni desactivar el teu propi compte d’administrador.'
    );
  }

  const updatedUser = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(users)
      .set({
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetUserId))
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        status: users.status,
        updatedAt: users.updatedAt,
      });

    if (!updated) {
      throw notFound('USER_NOT_FOUND', 'Usuari no trobat.');
    }

    if (nextStatus === 'blocked' || nextStatus === 'disabled') {
      await revokeAllSessionsForUser(tx, updated.id);
    }

    await recordAuditLog(tx, {
      actorUserId: adminCtx.user.id,
      action: `admin.user.${nextStatus}`,
      targetType: 'user',
      targetId: updated.id,
      metadata: { email: updated.email, status: nextStatus },
    });

    return updated;
  });

  return updatedUser;
}

export async function listAuditLogs(
  db: AppDatabase,
  ctx: AuthContext | null,
  limit = 40
) {
  assertAdmin(ctx);
  const safeLimit = Math.min(Math.max(limit, 1), 100);

  return db
    .select({
      id: auditLogs.id,
      actorUserId: auditLogs.actorUserId,
      actorMemberId: auditLogs.actorMemberId,
      campaignId: auditLogs.campaignId,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(safeLimit);
}
