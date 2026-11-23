import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  auditLogs,
  campaignMembers,
  campaigns,
  characterRevisions,
  characters,
  playerInvitations,
  users,
} from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { badRequest, conflict, forbidden, unauthorized } from '@/domain/errors';
import { hashPassword, verifyPassword } from '../auth/crypto';
import {
  createSessionForUser,
  revokeAllSessionsForMember,
  type AuthContext,
} from '../auth/session';
import { recordAuditLog } from './audit-service';
import { normalizeEmail, type SafeUserSummary } from './auth-service';

export interface LinkIdentityResult {
  user: SafeUserSummary;
  campaignId: string;
  memberId: string;
  merged: boolean;
  rawToken: string;
  expiresAt: Date;
}

/**
 * Upgrades an active guest membership in a campaign to a brand-new registered player account,
 * preserving the member record and all characters without duplicating anything.
 */
export async function linkGuestToNewAccount(
  db: AppDatabase,
  ctx: AuthContext | null,
  input: { email: string; displayName?: string; password: string }
): Promise<LinkIdentityResult> {
  if (!ctx) {
    throw unauthorized();
  }
  if (ctx.kind !== 'guest') {
    throw forbidden(
      'GUEST_SESSION_REQUIRED',
      'Només un jugador convidat pot vincular el seu accés a un compte.'
    );
  }

  const email = normalizeEmail(input.email);
  const displayName = (input.displayName ?? ctx.member.displayName).trim();

  if (!email || !email.includes('@')) {
    throw badRequest('INVALID_EMAIL', 'Introdueix un correu electrònic vàlid.');
  }
  if (displayName.length < 2) {
    throw badRequest('INVALID_DISPLAY_NAME', 'El nom visible ha de tenir almenys 2 caràcters.');
  }
  if (input.password.length < 8) {
    throw badRequest('WEAK_PASSWORD', 'La contrasenya ha de tenir almenys 8 caràcters.');
  }

  const passwordHash = await hashPassword(input.password);

  const txResult = await db.transaction(async (tx) => {
    const [guestRow] = await tx
      .select({
        member: campaignMembers,
        campaign: campaigns,
      })
      .from(campaignMembers)
      .innerJoin(campaigns, eq(campaignMembers.campaignId, campaigns.id))
      .where(eq(campaignMembers.id, ctx.member.id))
      .limit(1);

    if (
      !guestRow ||
      guestRow.campaign.deletedAt !== null ||
      guestRow.member.status !== 'active' ||
      guestRow.member.memberType !== 'guest' ||
      guestRow.member.userId !== null
    ) {
      throw forbidden(
        'GUEST_MEMBERSHIP_NOT_LINKABLE',
        'Aquest accés de convidat ja no és vàlid o ja està vinculat a un compte.'
      );
    }

    const [existingUser] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      throw conflict('EMAIL_IN_USE', 'Ja existeix un compte amb aquest correu electrònic.');
    }

    const [createdUser] = await tx
      .insert(users)
      .values({
        email,
        passwordHash,
        displayName,
        role: 'player',
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
      .update(campaignMembers)
      .set({
        userId: createdUser.id,
        memberType: 'registered',
        displayName,
        updatedAt: new Date(),
      })
      .where(eq(campaignMembers.id, guestRow.member.id));

    await revokeAllSessionsForMember(tx, guestRow.member.id);

    await tx
      .update(playerInvitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(playerInvitations.targetMemberId, guestRow.member.id),
          isNull(playerInvitations.usedAt),
          isNull(playerInvitations.revokedAt)
        )
      );

    await recordAuditLog(tx, {
      actorUserId: createdUser.id,
      campaignId: guestRow.campaign.id,
      action: 'player_identity.linked_new_account',
      targetType: 'campaign_member',
      targetId: guestRow.member.id,
      metadata: { email: createdUser.email },
    });

    return {
      user: createdUser,
      campaignId: guestRow.campaign.id,
      memberId: guestRow.member.id,
    };
  });

  const session = await createSessionForUser(db, txResult.user.id);

  return {
    user: txResult.user,
    campaignId: txResult.campaignId,
    memberId: txResult.memberId,
    merged: false,
    rawToken: session.rawToken,
    expiresAt: session.expiresAt,
  };
}

/**
 * Links an active guest membership to an existing registered account after verifying password
 * credentials. Consolidates memberships/characters cleanly without creating duplicates if the
 * target account already belongs to the same campaign.
 */
export async function linkGuestToExistingAccount(
  db: AppDatabase,
  ctx: AuthContext | null,
  input: { email: string; password: string }
): Promise<LinkIdentityResult> {
  if (!ctx) {
    throw unauthorized();
  }
  if (ctx.kind !== 'guest') {
    throw forbidden(
      'GUEST_SESSION_REQUIRED',
      'Només un jugador convidat pot vincular el seu accés a un compte existent.'
    );
  }

  const email = normalizeEmail(input.email);

  const txResult = await db.transaction(async (tx) => {
    const [guestRow] = await tx
      .select({
        member: campaignMembers,
        campaign: campaigns,
      })
      .from(campaignMembers)
      .innerJoin(campaigns, eq(campaignMembers.campaignId, campaigns.id))
      .where(eq(campaignMembers.id, ctx.member.id))
      .limit(1);

    if (
      !guestRow ||
      guestRow.campaign.deletedAt !== null ||
      guestRow.member.status !== 'active' ||
      guestRow.member.memberType !== 'guest' ||
      guestRow.member.userId !== null
    ) {
      throw forbidden(
        'GUEST_MEMBERSHIP_NOT_LINKABLE',
        'Aquest accés de convidat ja no és vàlid o ja està vinculat a un compte.'
      );
    }

    const [targetUser] = await tx
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!targetUser) {
      throw unauthorized('INVALID_CREDENTIALS', 'Correu o contrasenya incorrectes.');
    }

    const validPassword = await verifyPassword(input.password, targetUser.passwordHash);
    if (!validPassword) {
      throw unauthorized('INVALID_CREDENTIALS', 'Correu o contrasenya incorrectes.');
    }

    if (targetUser.status !== 'active') {
      throw forbidden('ACCOUNT_INACTIVE', 'El compte indicat es troba bloquejat o desactivat.');
    }

    if (targetUser.role === 'admin') {
      throw forbidden(
        'ADMIN_CANNOT_BE_PLAYER',
        'Un compte d’administrador principal no es pot vincular com a jugador.'
      );
    }

    if (guestRow.campaign.gmUserId === targetUser.id) {
      throw conflict(
        'ALREADY_CAMPAIGN_GM',
        'Aquest compte ja és el Director de Joc d’aquesta campanya.'
      );
    }

    const [existingMembership] = await tx
      .select()
      .from(campaignMembers)
      .where(
        and(
          eq(campaignMembers.campaignId, guestRow.campaign.id),
          eq(campaignMembers.userId, targetUser.id)
        )
      )
      .limit(1);

    await revokeAllSessionsForMember(tx, guestRow.member.id);

    let finalMemberId = guestRow.member.id;
    let merged = false;

    if (!existingMembership) {
      await tx
        .update(campaignMembers)
        .set({
          userId: targetUser.id,
          memberType: 'registered',
          updatedAt: new Date(),
        })
        .where(eq(campaignMembers.id, guestRow.member.id));

      await tx
        .update(playerInvitations)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(playerInvitations.targetMemberId, guestRow.member.id),
            isNull(playerInvitations.usedAt),
            isNull(playerInvitations.revokedAt)
          )
        );
    } else {
      if (existingMembership.status !== 'active') {
        throw forbidden(
          'MEMBER_REVOKED_IN_CAMPAIGN',
          'Aquest compte té l’accés revocat dins d’aquesta campanya.'
        );
      }

      if (guestRow.campaign.maxCharactersPerPlayer !== null) {
        const [{ count: existingChars }] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(characters)
          .where(
            and(
              eq(characters.campaignId, guestRow.campaign.id),
              eq(characters.memberId, existingMembership.id)
            )
          );
        const [{ count: guestChars }] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(characters)
          .where(
            and(
              eq(characters.campaignId, guestRow.campaign.id),
              eq(characters.memberId, guestRow.member.id)
            )
          );

        if (existingChars + guestChars > guestRow.campaign.maxCharactersPerPlayer) {
          throw conflict(
            'CHARACTER_LIMIT_EXCEEDED_ON_MERGE',
            `La fusió superaria el límit de ${guestRow.campaign.maxCharactersPerPlayer} personatges per jugador d’aquesta campanya.`
          );
        }
      }

      // Move characters and historical references before removing redundant guest member row
      await tx
        .update(characters)
        .set({ memberId: existingMembership.id, updatedAt: new Date() })
        .where(
          and(
            eq(characters.campaignId, guestRow.campaign.id),
            eq(characters.memberId, guestRow.member.id)
          )
        );

      await tx
        .update(characterRevisions)
        .set({ changedByMemberId: existingMembership.id })
        .where(eq(characterRevisions.changedByMemberId, guestRow.member.id));

      await tx
        .update(auditLogs)
        .set({ actorMemberId: existingMembership.id })
        .where(eq(auditLogs.actorMemberId, guestRow.member.id));

      await tx
        .update(playerInvitations)
        .set({ usedByMemberId: existingMembership.id })
        .where(eq(playerInvitations.usedByMemberId, guestRow.member.id));

      await tx
        .delete(playerInvitations)
        .where(eq(playerInvitations.targetMemberId, guestRow.member.id));

      await tx.delete(campaignMembers).where(eq(campaignMembers.id, guestRow.member.id));

      finalMemberId = existingMembership.id;
      merged = true;
    }

    await recordAuditLog(tx, {
      actorUserId: targetUser.id,
      campaignId: guestRow.campaign.id,
      action: 'player_identity.linked_existing_account',
      targetType: 'campaign_member',
      targetId: finalMemberId,
      metadata: { merged },
    });

    return {
      user: {
        id: targetUser.id,
        email: targetUser.email,
        displayName: targetUser.displayName,
        role: targetUser.role,
        status: targetUser.status,
        preferredLocale: targetUser.preferredLocale,
      } satisfies SafeUserSummary,
      campaignId: guestRow.campaign.id,
      memberId: finalMemberId,
      merged,
    };
  });

  const session = await createSessionForUser(db, txResult.user.id);

  return {
    user: txResult.user,
    campaignId: txResult.campaignId,
    memberId: txResult.memberId,
    merged: txResult.merged,
    rawToken: session.rawToken,
    expiresAt: session.expiresAt,
  };
}
