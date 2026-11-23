import { and, eq, isNull } from 'drizzle-orm';
import {
  campaignMembers,
  campaigns,
  gameSystems,
  playerInvitations,
  users,
} from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import {
  badRequest,
  conflict,
  forbidden,
  gone,
  notFound,
  unauthorized,
} from '@/domain/errors';
import { generateSecureToken, hashPassword, hashToken, verifyPassword } from '../auth/crypto';
import { assertCampaignGm } from '../auth/policies';
import {
  createSessionForMember,
  createSessionForUser,
  revokeAllSessionsForMember,
  type AuthContext,
} from '../auth/session';
import { recordAuditLog } from './audit-service';
import { normalizeEmail } from './auth-service';

export type AcceptPlayerInvitationInput =
  | { mode: 'guest'; displayName: string }
  | { mode: 'register'; email: string; displayName: string; password: string }
  | { mode: 'login'; email: string; password: string }
  | { mode: 'recover' };

/**
 * Generates a single-use individual player invitation for a campaign.
 * Invitations NEVER auto-expire (DOCUMENT_MESTRE.md §5).
 */
export async function createPlayerInvitation(
  db: AppDatabase,
  ctx: AuthContext | null,
  campaignId: string,
  input?: { label?: string }
) {
  const { gmCtx, campaign } = await assertCampaignGm(db, ctx, campaignId);
  const label = (input?.label ?? '').trim();

  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);

  const [created] = await db
    .insert(playerInvitations)
    .values({
      campaignId: campaign.id,
      kind: 'join',
      targetMemberId: null,
      tokenHash,
      label,
      createdByUserId: gmCtx.user.id,
    })
    .returning({
      id: playerInvitations.id,
      campaignId: playerInvitations.campaignId,
      kind: playerInvitations.kind,
      label: playerInvitations.label,
      createdAt: playerInvitations.createdAt,
    });

  await recordAuditLog(db, {
    actorUserId: gmCtx.user.id,
    campaignId: campaign.id,
    action: 'player_invitation.created',
    targetType: 'player_invitation',
    targetId: created.id,
    metadata: { label: created.label },
  });

  return {
    invitation: created,
    rawToken,
    invitePath: `/invite/player/${rawToken}`,
  };
}

export async function revokePlayerInvitation(
  db: AppDatabase,
  ctx: AuthContext | null,
  campaignId: string,
  invitationId: string
) {
  const { gmCtx, campaign } = await assertCampaignGm(db, ctx, campaignId);

  const [updated] = await db
    .update(playerInvitations)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(playerInvitations.id, invitationId),
        eq(playerInvitations.campaignId, campaign.id),
        isNull(playerInvitations.usedAt),
        isNull(playerInvitations.revokedAt)
      )
    )
    .returning({
      id: playerInvitations.id,
      revokedAt: playerInvitations.revokedAt,
    });

  if (!updated) {
    throw notFound(
      'INVITATION_NOT_REVOCABLE',
      'No s’ha trobat una invitació pendent per revocar en aquesta campanya.'
    );
  }

  await recordAuditLog(db, {
    actorUserId: gmCtx.user.id,
    campaignId: campaign.id,
    action: 'player_invitation.revoked',
    targetType: 'player_invitation',
    targetId: updated.id,
  });

  return updated;
}

/**
 * Generates a dedicated access recovery link bound strictly to ONE existing guest member.
 * Revokes prior unused recovery links for that same member so old lost links cannot be abused,
 * and prevents impersonation of any other player (DOCUMENT_MESTRE.md §5).
 */
export async function createMemberRecoveryLink(
  db: AppDatabase,
  ctx: AuthContext | null,
  campaignId: string,
  memberId: string
) {
  const { gmCtx, campaign } = await assertCampaignGm(db, ctx, campaignId);

  const [member] = await db
    .select()
    .from(campaignMembers)
    .where(and(eq(campaignMembers.id, memberId), eq(campaignMembers.campaignId, campaign.id)))
    .limit(1);

  if (!member) {
    throw notFound('MEMBER_NOT_FOUND', 'Jugador no trobat dins d’aquesta campanya.');
  }

  if (member.status !== 'active') {
    throw badRequest(
      'MEMBER_REVOKED',
      'Aquest jugador té l’accés revocat i no pot rebre un enllaç de recuperació.'
    );
  }

  if (member.memberType !== 'guest') {
    throw badRequest(
      'REGISTERED_ACCOUNT_USE_LOGIN',
      'Els jugadors amb compte registrat accedeixen amb el seu correu i contrasenya.'
    );
  }

  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);

  const created = await db.transaction(async (tx) => {
    await tx
      .update(playerInvitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(playerInvitations.campaignId, campaign.id),
          eq(playerInvitations.kind, 'recovery'),
          eq(playerInvitations.targetMemberId, member.id),
          isNull(playerInvitations.usedAt),
          isNull(playerInvitations.revokedAt)
        )
      );

    const [inserted] = await tx
      .insert(playerInvitations)
      .values({
        campaignId: campaign.id,
        kind: 'recovery',
        targetMemberId: member.id,
        tokenHash,
        label: `Recuperació: ${member.displayName}`,
        createdByUserId: gmCtx.user.id,
      })
      .returning({
        id: playerInvitations.id,
        campaignId: playerInvitations.campaignId,
        kind: playerInvitations.kind,
        targetMemberId: playerInvitations.targetMemberId,
        label: playerInvitations.label,
        createdAt: playerInvitations.createdAt,
      });

    await recordAuditLog(tx, {
      actorUserId: gmCtx.user.id,
      campaignId: campaign.id,
      action: 'player_recovery.created',
      targetType: 'campaign_member',
      targetId: member.id,
      metadata: { displayName: member.displayName },
    });

    return inserted;
  });

  return {
    invitation: created,
    rawToken,
    invitePath: `/invite/player/${rawToken}`,
  };
}

export async function revokeCampaignMember(
  db: AppDatabase,
  ctx: AuthContext | null,
  campaignId: string,
  memberId: string
) {
  const { gmCtx, campaign } = await assertCampaignGm(db, ctx, campaignId);

  const updatedMember = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(campaignMembers)
      .set({
        status: 'revoked',
        updatedAt: new Date(),
      })
      .where(and(eq(campaignMembers.id, memberId), eq(campaignMembers.campaignId, campaign.id)))
      .returning();

    if (!updated) {
      throw notFound('MEMBER_NOT_FOUND', 'Jugador no trobat en aquesta campanya.');
    }

    await revokeAllSessionsForMember(tx, updated.id);

    await tx
      .update(playerInvitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(playerInvitations.targetMemberId, updated.id),
          isNull(playerInvitations.usedAt),
          isNull(playerInvitations.revokedAt)
        )
      );

    await recordAuditLog(tx, {
      actorUserId: gmCtx.user.id,
      campaignId: campaign.id,
      action: 'campaign_member.revoked',
      targetType: 'campaign_member',
      targetId: updated.id,
      metadata: { displayName: updated.displayName },
    });

    return updated;
  });

  return updatedMember;
}

export async function inspectPlayerInvitation(db: AppDatabase, rawToken: string) {
  const tokenHash = hashToken(rawToken);

  const [row] = await db
    .select({
      invitation: playerInvitations,
      campaignName: campaigns.name,
      campaignDeletedAt: campaigns.deletedAt,
      systemName: gameSystems.shortName,
    })
    .from(playerInvitations)
    .innerJoin(campaigns, eq(playerInvitations.campaignId, campaigns.id))
    .innerJoin(gameSystems, eq(campaigns.systemId, gameSystems.id))
    .where(eq(playerInvitations.tokenHash, tokenHash))
    .limit(1);

  if (!row || row.campaignDeletedAt !== null) {
    throw notFound('INVITATION_NOT_FOUND', 'Aquesta invitació no existeix o la campanya ja no està disponible.');
  }

  if (row.invitation.revokedAt) {
    throw gone('INVITATION_REVOKED', 'Aquesta invitació ha estat revocada pel Director de Joc.');
  }

  if (row.invitation.usedAt) {
    throw gone('INVITATION_USED', 'Aquesta invitació ja ha estat utilitzada.');
  }

  let targetDisplayName: string | null = null;
  if (row.invitation.kind === 'recovery' && row.invitation.targetMemberId) {
    const [target] = await db
      .select({ displayName: campaignMembers.displayName, status: campaignMembers.status })
      .from(campaignMembers)
      .where(eq(campaignMembers.id, row.invitation.targetMemberId))
      .limit(1);

    if (!target || target.status !== 'active') {
      throw gone('MEMBER_REVOKED', 'L’accés d’aquest jugador ha estat revocat.');
    }
    targetDisplayName = target.displayName;
  }

  return {
    id: row.invitation.id,
    kind: row.invitation.kind,
    campaignId: row.invitation.campaignId,
    campaignName: row.campaignName,
    systemName: row.systemName,
    label: row.invitation.label,
    targetDisplayName,
    createdAt: row.invitation.createdAt,
  };
}

export async function acceptPlayerInvitation(
  db: AppDatabase,
  rawToken: string,
  input: AcceptPlayerInvitationInput
): Promise<{
  campaignId: string;
  memberId: string;
  accessType: 'guest' | 'registered';
  rawToken: string;
  expiresAt: Date;
}> {
  const tokenHash = hashToken(rawToken);

  const txResult = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        invitation: playerInvitations,
        campaign: campaigns,
      })
      .from(playerInvitations)
      .innerJoin(campaigns, eq(playerInvitations.campaignId, campaigns.id))
      .where(eq(playerInvitations.tokenHash, tokenHash))
      .limit(1);

    if (!row || row.campaign.deletedAt !== null) {
      throw notFound('INVITATION_NOT_FOUND', 'La invitació no existeix o la campanya no és activa.');
    }

    const invite = row.invitation;
    if (invite.revokedAt) {
      throw gone('INVITATION_REVOKED', 'Aquesta invitació ha estat revocada.');
    }
    if (invite.usedAt) {
      throw gone('INVITATION_USED', 'Aquesta invitació ja s’ha utilitzat.');
    }

    if (invite.kind === 'recovery' && input.mode !== 'recover') {
      throw badRequest(
        'RECOVERY_MODE_REQUIRED',
        'Aquest enllaç és exclusivament per recuperar un accés existent.'
      );
    }

    if (invite.kind === 'join' && input.mode === 'recover') {
      throw badRequest(
        'JOIN_MODE_REQUIRED',
        'Aquesta invitació és per unir-se com a jugador nou, no per recuperar un accés.'
      );
    }

    const [consumed] = await tx
      .update(playerInvitations)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(playerInvitations.id, invite.id),
          isNull(playerInvitations.usedAt),
          isNull(playerInvitations.revokedAt)
        )
      )
      .returning({ id: playerInvitations.id });

    if (!consumed) {
      throw gone('INVITATION_USED', 'Aquesta invitació ja s’ha utilitzat.');
    }

    if (input.mode === 'guest') {
      const displayName = input.displayName.trim();
      if (displayName.length < 2) {
        throw badRequest('INVALID_ALIAS', 'Introdueix un nom o àlies d’almenys 2 caràcters.');
      }

      const [member] = await tx
        .insert(campaignMembers)
        .values({
          campaignId: row.campaign.id,
          userId: null,
          memberType: 'guest',
          displayName,
          status: 'active',
        })
        .returning();

      await tx
        .update(playerInvitations)
        .set({ usedByMemberId: member.id })
        .where(eq(playerInvitations.id, invite.id));

      await recordAuditLog(tx, {
        actorMemberId: member.id,
        campaignId: row.campaign.id,
        action: 'player_invitation.accepted_guest',
        targetType: 'campaign_member',
        targetId: member.id,
        metadata: { displayName: member.displayName },
      });

      return {
        kind: 'member' as const,
        campaignId: row.campaign.id,
        memberId: member.id,
      };
    }

    if (input.mode === 'register') {
      const email = normalizeEmail(input.email);
      const displayName = input.displayName.trim();

      if (!email || !email.includes('@')) {
        throw badRequest('INVALID_EMAIL', 'Introdueix un correu electrònic vàlid.');
      }
      if (displayName.length < 2) {
        throw badRequest('INVALID_DISPLAY_NAME', 'El nom visible ha de tenir almenys 2 caràcters.');
      }
      if (input.password.length < 8) {
        throw badRequest('WEAK_PASSWORD', 'La contrasenya ha de tenir almenys 8 caràcters.');
      }

      const [existingUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser) {
        throw conflict('EMAIL_IN_USE', 'Ja existeix un compte amb aquest correu electrònic.');
      }

      const passwordHash = await hashPassword(input.password);
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
        .returning();

      const [member] = await tx
        .insert(campaignMembers)
        .values({
          campaignId: row.campaign.id,
          userId: createdUser.id,
          memberType: 'registered',
          displayName,
          status: 'active',
        })
        .returning();

      await tx
        .update(playerInvitations)
        .set({ usedByMemberId: member.id })
        .where(eq(playerInvitations.id, invite.id));

      await recordAuditLog(tx, {
        actorUserId: createdUser.id,
        campaignId: row.campaign.id,
        action: 'player_invitation.accepted_register',
        targetType: 'campaign_member',
        targetId: member.id,
        metadata: { email: createdUser.email },
      });

      return {
        kind: 'user' as const,
        campaignId: row.campaign.id,
        memberId: member.id,
        userId: createdUser.id,
      };
    }

    if (input.mode === 'login') {
      const email = normalizeEmail(input.email);
      const [userRow] = await tx
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!userRow) {
        throw unauthorized('INVALID_CREDENTIALS', 'Correu o contrasenya incorrectes.');
      }

      const validPassword = await verifyPassword(input.password, userRow.passwordHash);
      if (!validPassword) {
        throw unauthorized('INVALID_CREDENTIALS', 'Correu o contrasenya incorrectes.');
      }

      if (userRow.status !== 'active') {
        throw forbidden('ACCOUNT_INACTIVE', 'Aquest compte no es troba actiu.');
      }

      if (userRow.role === 'admin') {
        throw forbidden(
          'ADMIN_CANNOT_BE_PLAYER',
          'Un compte d’administrador principal no pot unir-se com a jugador.'
        );
      }

      if (row.campaign.gmUserId === userRow.id) {
        throw conflict(
          'ALREADY_CAMPAIGN_GM',
          'Ja ets el Director de Joc d’aquesta campanya.'
        );
      }

      const [existingMembership] = await tx
        .select()
        .from(campaignMembers)
        .where(
          and(
            eq(campaignMembers.campaignId, row.campaign.id),
            eq(campaignMembers.userId, userRow.id)
          )
        )
        .limit(1);

      if (existingMembership && existingMembership.status === 'active') {
        throw conflict('ALREADY_MEMBER', 'Aquest compte ja participa en la campanya.');
      }

      let member: typeof campaignMembers.$inferSelect;
      if (existingMembership) {
        const [reactivated] = await tx
          .update(campaignMembers)
          .set({ status: 'active', updatedAt: new Date() })
          .where(eq(campaignMembers.id, existingMembership.id))
          .returning();
        member = reactivated;
      } else {
        const [inserted] = await tx
          .insert(campaignMembers)
          .values({
            campaignId: row.campaign.id,
            userId: userRow.id,
            memberType: 'registered',
            displayName: userRow.displayName,
            status: 'active',
          })
          .returning();
        member = inserted;
      }

      await tx
        .update(playerInvitations)
        .set({ usedByMemberId: member.id })
        .where(eq(playerInvitations.id, invite.id));

      await recordAuditLog(tx, {
        actorUserId: userRow.id,
        campaignId: row.campaign.id,
        action: 'player_invitation.accepted_login',
        targetType: 'campaign_member',
        targetId: member.id,
      });

      return {
        kind: 'user' as const,
        campaignId: row.campaign.id,
        memberId: member.id,
        userId: userRow.id,
      };
    }

    // input.mode === 'recover'
    if (!invite.targetMemberId) {
      throw badRequest('INVALID_RECOVERY_TARGET', 'Aquest enllaç no té cap jugador vinculat.');
    }

    const [targetMember] = await tx
      .select()
      .from(campaignMembers)
      .where(
        and(
          eq(campaignMembers.id, invite.targetMemberId),
          eq(campaignMembers.campaignId, row.campaign.id)
        )
      )
      .limit(1);

    if (!targetMember || targetMember.status !== 'active' || targetMember.memberType !== 'guest') {
      throw forbidden('RECOVERY_DENIED', 'No és possible recuperar aquest accés.');
    }

    // Revoke any previous lost sessions of this specific guest member
    await revokeAllSessionsForMember(tx, targetMember.id);

    await tx
      .update(playerInvitations)
      .set({ usedByMemberId: targetMember.id })
      .where(eq(playerInvitations.id, invite.id));

    await recordAuditLog(tx, {
      actorMemberId: targetMember.id,
      campaignId: row.campaign.id,
      action: 'player_recovery.accepted',
      targetType: 'campaign_member',
      targetId: targetMember.id,
    });

    return {
      kind: 'member' as const,
      campaignId: row.campaign.id,
      memberId: targetMember.id,
    };
  });

  if (txResult.kind === 'user') {
    const session = await createSessionForUser(db, txResult.userId);
    return {
      campaignId: txResult.campaignId,
      memberId: txResult.memberId,
      accessType: 'registered',
      rawToken: session.rawToken,
      expiresAt: session.expiresAt,
    };
  }

  const session = await createSessionForMember(db, txResult.memberId);
  return {
    campaignId: txResult.campaignId,
    memberId: txResult.memberId,
    accessType: 'guest',
    rawToken: session.rawToken,
    expiresAt: session.expiresAt,
  };
}
