import { and, eq, isNull } from 'drizzle-orm';
import { gmInvitations, users } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { badRequest, conflict, forbidden, gone, notFound, unauthorized } from '@/domain/errors';
import { hashPassword, hashToken, verifyPassword } from '../auth/crypto';
import {
  createSessionForUser,
  revokeSessionById,
  type AuthContext,
} from '../auth/session';
import { recordAuditLog } from './audit-service';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface SafeUserSummary {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'gm' | 'player';
  status: 'active' | 'blocked' | 'disabled';
  preferredLocale: string;
}

export async function loginWithPassword(
  db: AppDatabase,
  input: { email: string; password: string }
): Promise<{ user: SafeUserSummary; rawToken: string; expiresAt: Date }> {
  const email = normalizeEmail(input.email);

  const [userRow] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!userRow) {
    throw unauthorized('INVALID_CREDENTIALS', 'Correu o contrasenya incorrectes.');
  }

  const passwordValid = await verifyPassword(input.password, userRow.passwordHash);
  if (!passwordValid) {
    throw unauthorized('INVALID_CREDENTIALS', 'Correu o contrasenya incorrectes.');
  }

  if (userRow.status === 'blocked') {
    throw forbidden('ACCOUNT_BLOCKED', 'El teu compte ha estat bloquejat per l’administrador.');
  }

  if (userRow.status === 'disabled') {
    throw forbidden('ACCOUNT_DISABLED', 'El teu compte està desactivat.');
  }

  const session = await createSessionForUser(db, userRow.id);

  await recordAuditLog(db, {
    actorUserId: userRow.id,
    action: 'auth.login',
    targetType: 'user',
    targetId: userRow.id,
    metadata: { role: userRow.role },
  });

  return {
    user: {
      id: userRow.id,
      email: userRow.email,
      displayName: userRow.displayName,
      role: userRow.role,
      status: userRow.status,
      preferredLocale: userRow.preferredLocale,
    },
    rawToken: session.rawToken,
    expiresAt: session.expiresAt,
  };
}

export async function logoutSession(db: AppDatabase, ctx: AuthContext | null): Promise<void> {
  if (!ctx) {
    return;
  }

  await revokeSessionById(db, ctx.sessionId);

  await recordAuditLog(db, {
    actorUserId: ctx.kind === 'user' ? ctx.user.id : null,
    actorMemberId: ctx.kind === 'guest' ? ctx.member.id : null,
    campaignId: ctx.kind === 'guest' ? ctx.member.campaignId : null,
    action: 'auth.logout',
    targetType: 'session',
    targetId: ctx.sessionId,
  });
}

export async function inspectGmInvitation(db: AppDatabase, rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const [invite] = await db
    .select({
      id: gmInvitations.id,
      email: gmInvitations.email,
      note: gmInvitations.note,
      usedAt: gmInvitations.usedAt,
      revokedAt: gmInvitations.revokedAt,
      createdAt: gmInvitations.createdAt,
    })
    .from(gmInvitations)
    .where(eq(gmInvitations.tokenHash, tokenHash))
    .limit(1);

  if (!invite) {
    throw notFound('GM_INVITATION_NOT_FOUND', 'La invitació de GM no existeix o no és vàlida.');
  }
  if (invite.revokedAt) {
    throw gone('GM_INVITATION_REVOKED', 'Aquesta invitació de GM ha estat revocada.');
  }
  if (invite.usedAt) {
    throw gone('GM_INVITATION_USED', 'Aquesta invitació de GM ja s’ha utilitzat.');
  }

  return {
    id: invite.id,
    email: invite.email,
    note: invite.note,
    createdAt: invite.createdAt,
  };
}

/**
 * Registers a GM account ONLY when holding an active, unused, non-revoked admin invitation.
 * Public GM registration does not exist anywhere in the platform.
 */
export async function registerGmWithInvitation(
  db: AppDatabase,
  input: {
    rawToken: string;
    email: string;
    displayName: string;
    password: string;
  }
): Promise<{ user: SafeUserSummary; rawToken: string; expiresAt: Date }> {
  const email = normalizeEmail(input.email);
  const displayName = input.displayName.trim();

  if (displayName.length < 2) {
    throw badRequest('INVALID_DISPLAY_NAME', 'El nom visible ha de tenir almenys 2 caràcters.');
  }
  if (input.password.length < 8) {
    throw badRequest('WEAK_PASSWORD', 'La contrasenya ha de tenir almenys 8 caràcters.');
  }

  const tokenHash = hashToken(input.rawToken);
  const passwordHash = await hashPassword(input.password);

  const createdUser = await db.transaction(async (tx) => {
    const [invite] = await tx
      .select()
      .from(gmInvitations)
      .where(eq(gmInvitations.tokenHash, tokenHash))
      .limit(1);

    if (!invite) {
      throw notFound('GM_INVITATION_NOT_FOUND', 'La invitació de GM no existeix o no és vàlida.');
    }
    if (invite.revokedAt) {
      throw gone('GM_INVITATION_REVOKED', 'Aquesta invitació de GM ha estat revocada.');
    }
    if (invite.usedAt) {
      throw gone('GM_INVITATION_USED', 'Aquesta invitació de GM ja s’ha utilitzat.');
    }
    if (normalizeEmail(invite.email) !== email) {
      throw forbidden(
        'INVITATION_EMAIL_MISMATCH',
        'El correu electrònic no coincideix amb el de la invitació.'
      );
    }

    const [existingUser] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      throw conflict('EMAIL_IN_USE', 'Ja existeix un compte registrat amb aquest correu.');
    }

    const [consumedInvite] = await tx
      .update(gmInvitations)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(gmInvitations.id, invite.id),
          isNull(gmInvitations.usedAt),
          isNull(gmInvitations.revokedAt)
        )
      )
      .returning({ id: gmInvitations.id });

    if (!consumedInvite) {
      throw gone('GM_INVITATION_USED', 'Aquesta invitació de GM ja s’ha utilitzat.');
    }

    const [insertedUser] = await tx
      .insert(users)
      .values({
        email,
        passwordHash,
        displayName,
        role: 'gm',
        status: 'active',
        preferredLocale: 'ca',
      })
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        status: users.status,
        preferredLocale: users.preferredLocale,
      });

    await tx
      .update(gmInvitations)
      .set({ usedByUserId: insertedUser.id })
      .where(eq(gmInvitations.id, invite.id));

    await recordAuditLog(tx, {
      actorUserId: insertedUser.id,
      action: 'gm.registered',
      targetType: 'user',
      targetId: insertedUser.id,
      metadata: { invitationId: invite.id, email: insertedUser.email },
    });

    return insertedUser;
  });

  const session = await createSessionForUser(db, createdUser.id);

  return {
    user: createdUser,
    rawToken: session.rawToken,
    expiresAt: session.expiresAt,
  };
}
