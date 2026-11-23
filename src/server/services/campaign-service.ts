import { and, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import {
  auditLogs,
  campaignMembers,
  campaigns,
  characters,
  gameSystems,
  playerInvitations,
  type CampaignStatus,
} from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { badRequest, forbidden, gone, notFound } from '@/domain/errors';
import { assertCampaignAccess, assertCampaignGm, assertGm } from '../auth/policies';
import { revokeAllSessionsForMember, type AuthContext } from '../auth/session';
import { recordAuditLog } from './audit-service';

const TRASH_RETENTION_DAYS = 30;

export async function listGameSystems(db: AppDatabase) {
  return db
    .select({
      id: gameSystems.id,
      name: gameSystems.name,
      shortName: gameSystems.shortName,
      version: gameSystems.version,
      isActive: gameSystems.isActive,
    })
    .from(gameSystems)
    .where(eq(gameSystems.isActive, true));
}

export async function createCampaign(
  db: AppDatabase,
  ctx: AuthContext | null,
  input: { name: string; systemId: string }
) {
  const gmCtx = assertGm(ctx);
  const name = input.name.trim();

  if (name.length < 2) {
    throw badRequest('INVALID_CAMPAIGN_NAME', 'El nom de la campanya ha de tenir almenys 2 caràcters.');
  }

  const [system] = await db
    .select()
    .from(gameSystems)
    .where(and(eq(gameSystems.id, input.systemId), eq(gameSystems.isActive, true)))
    .limit(1);

  if (!system) {
    throw badRequest('INVALID_GAME_SYSTEM', 'El sistema de rol seleccionat no és disponible.');
  }

  if (gmCtx.user.maxCampaigns !== null) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(campaigns)
      .where(and(eq(campaigns.gmUserId, gmCtx.user.id), isNull(campaigns.deletedAt)));

    if (count >= gmCtx.user.maxCampaigns) {
      throw forbidden(
        'CAMPAIGN_LIMIT_REACHED',
        'Has assolit el límit de campanyes actives permès per al teu compte.'
      );
    }
  }

  const [created] = await db
    .insert(campaigns)
    .values({
      gmUserId: gmCtx.user.id,
      systemId: system.id,
      name,
      status: 'active',
    })
    .returning();

  await recordAuditLog(db, {
    actorUserId: gmCtx.user.id,
    campaignId: created.id,
    action: 'campaign.created',
    targetType: 'campaign',
    targetId: created.id,
    metadata: { name: created.name, systemId: created.systemId },
  });

  return created;
}

export interface CampaignListItem {
  id: string;
  name: string;
  description: string;
  systemId: string;
  systemShortName: string;
  status: CampaignStatus;
  roleInCampaign: 'gm' | 'player' | 'guest';
  playerCount: number;
  characterCount: number;
  deletedAt: Date | null;
  purgeEligibleAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function listCampaignsForActor(
  db: AppDatabase,
  ctx: AuthContext | null,
  options?: { includeTrash?: boolean }
): Promise<CampaignListItem[]> {
  if (!ctx) {
    return [];
  }

  const includeTrash = Boolean(options?.includeTrash);

  if (ctx.kind === 'guest') {
    if (includeTrash) {
      return [];
    }
    const [row] = await db
      .select({
        campaign: campaigns,
        systemShortName: gameSystems.shortName,
      })
      .from(campaignMembers)
      .innerJoin(campaigns, eq(campaignMembers.campaignId, campaigns.id))
      .innerJoin(gameSystems, eq(campaigns.systemId, gameSystems.id))
      .where(
        and(
          eq(campaignMembers.id, ctx.member.id),
          eq(campaignMembers.status, 'active'),
          isNull(campaigns.deletedAt)
        )
      )
      .limit(1);

    if (!row) {
      return [];
    }

    const counts = await fetchCampaignCounts(db, [row.campaign.id]);
    return [
      {
        id: row.campaign.id,
        name: row.campaign.name,
        description: row.campaign.description,
        systemId: row.campaign.systemId,
        systemShortName: row.systemShortName,
        status: row.campaign.status,
        roleInCampaign: 'guest',
        playerCount: counts.players.get(row.campaign.id) ?? 0,
        characterCount: counts.characters.get(row.campaign.id) ?? 0,
        deletedAt: row.campaign.deletedAt,
        purgeEligibleAt: row.campaign.purgeEligibleAt,
        createdAt: row.campaign.createdAt,
        updatedAt: row.campaign.updatedAt,
      },
    ];
  }

  if (ctx.user.role === 'gm') {
    const rows = await db
      .select({
        campaign: campaigns,
        systemShortName: gameSystems.shortName,
      })
      .from(campaigns)
      .innerJoin(gameSystems, eq(campaigns.systemId, gameSystems.id))
      .where(
        and(
          eq(campaigns.gmUserId, ctx.user.id),
          includeTrash ? isNotNull(campaigns.deletedAt) : isNull(campaigns.deletedAt)
        )
      )
      .orderBy(desc(campaigns.updatedAt));

    const counts = await fetchCampaignCounts(
      db,
      rows.map((r) => r.campaign.id)
    );

    return rows.map((r) => ({
      id: r.campaign.id,
      name: r.campaign.name,
      description: r.campaign.description,
      systemId: r.campaign.systemId,
      systemShortName: r.systemShortName,
      status: r.campaign.status,
      roleInCampaign: 'gm',
      playerCount: counts.players.get(r.campaign.id) ?? 0,
      characterCount: counts.characters.get(r.campaign.id) ?? 0,
      deletedAt: r.campaign.deletedAt,
      purgeEligibleAt: r.campaign.purgeEligibleAt,
      createdAt: r.campaign.createdAt,
      updatedAt: r.campaign.updatedAt,
    }));
  }

  if (ctx.user.role === 'player') {
    if (includeTrash) {
      return [];
    }
    const rows = await db
      .select({
        campaign: campaigns,
        systemShortName: gameSystems.shortName,
      })
      .from(campaignMembers)
      .innerJoin(campaigns, eq(campaignMembers.campaignId, campaigns.id))
      .innerJoin(gameSystems, eq(campaigns.systemId, gameSystems.id))
      .where(
        and(
          eq(campaignMembers.userId, ctx.user.id),
          eq(campaignMembers.status, 'active'),
          isNull(campaigns.deletedAt)
        )
      )
      .orderBy(desc(campaigns.updatedAt));

    const counts = await fetchCampaignCounts(
      db,
      rows.map((r) => r.campaign.id)
    );

    return rows.map((r) => ({
      id: r.campaign.id,
      name: r.campaign.name,
      description: r.campaign.description,
      systemId: r.campaign.systemId,
      systemShortName: r.systemShortName,
      status: r.campaign.status,
      roleInCampaign: 'player',
      playerCount: counts.players.get(r.campaign.id) ?? 0,
      characterCount: counts.characters.get(r.campaign.id) ?? 0,
      deletedAt: r.campaign.deletedAt,
      purgeEligibleAt: r.campaign.purgeEligibleAt,
      createdAt: r.campaign.createdAt,
      updatedAt: r.campaign.updatedAt,
    }));
  }

  return [];
}

async function fetchCampaignCounts(db: AppDatabase, campaignIds: string[]) {
  const playersMap = new Map<string, number>();
  const charsMap = new Map<string, number>();

  if (campaignIds.length === 0) {
    return { players: playersMap, characters: charsMap };
  }

  const playerCounts = await db
    .select({
      campaignId: campaignMembers.campaignId,
      count: sql<number>`count(*)::int`,
    })
    .from(campaignMembers)
    .where(
      and(
        inArray(campaignMembers.campaignId, campaignIds),
        eq(campaignMembers.status, 'active')
      )
    )
    .groupBy(campaignMembers.campaignId);

  for (const row of playerCounts) {
    playersMap.set(row.campaignId, row.count);
  }

  const charCounts = await db
    .select({
      campaignId: characters.campaignId,
      count: sql<number>`count(*)::int`,
    })
    .from(characters)
    .where(inArray(characters.campaignId, campaignIds))
    .groupBy(characters.campaignId);

  for (const row of charCounts) {
    charsMap.set(row.campaignId, row.count);
  }

  return { players: playersMap, characters: charsMap };
}

export async function getCampaignDetail(
  db: AppDatabase,
  ctx: AuthContext | null,
  campaignId: string
) {
  const access = await assertCampaignAccess(db, ctx, campaignId);

  const [system] = await db
    .select({
      id: gameSystems.id,
      name: gameSystems.name,
      shortName: gameSystems.shortName,
      version: gameSystems.version,
    })
    .from(gameSystems)
    .where(eq(gameSystems.id, access.campaign.systemId))
    .limit(1);

  const counts = await fetchCampaignCounts(db, [access.campaign.id]);

  const rawActivity = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(eq(auditLogs.campaignId, access.campaign.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(15);

  const baseCampaign = {
    id: access.campaign.id,
    name: access.campaign.name,
    description: access.campaign.description,
    systemId: access.campaign.systemId,
    status: access.campaign.status,
    maxCharactersPerPlayer: access.campaign.maxCharactersPerPlayer,
    createdAt: access.campaign.createdAt,
    updatedAt: access.campaign.updatedAt,
  };

  const stats = {
    playerCount: counts.players.get(access.campaign.id) ?? 0,
    characterCount: counts.characters.get(access.campaign.id) ?? 0,
  };

  if (access.accessRole === 'gm') {
    const members = await db
      .select({
        id: campaignMembers.id,
        displayName: campaignMembers.displayName,
        memberType: campaignMembers.memberType,
        status: campaignMembers.status,
        joinedAt: campaignMembers.joinedAt,
      })
      .from(campaignMembers)
      .where(eq(campaignMembers.campaignId, access.campaign.id))
      .orderBy(desc(campaignMembers.joinedAt));

    const invitations = await db
      .select({
        id: playerInvitations.id,
        kind: playerInvitations.kind,
        targetMemberId: playerInvitations.targetMemberId,
        label: playerInvitations.label,
        usedAt: playerInvitations.usedAt,
        revokedAt: playerInvitations.revokedAt,
        createdAt: playerInvitations.createdAt,
      })
      .from(playerInvitations)
      .where(eq(playerInvitations.campaignId, access.campaign.id))
      .orderBy(desc(playerInvitations.createdAt));

    return {
      canManage: true as const,
      accessRole: 'gm' as const,
      campaign: baseCampaign,
      system,
      stats,
      recentActivity: rawActivity,
      members,
      invitations,
      currentMember: null,
    };
  }

  return {
    canManage: false as const,
    accessRole: access.accessRole,
    campaign: baseCampaign,
    system,
    stats,
    recentActivity: rawActivity,
    currentMember: access.member
      ? {
          id: access.member.id,
          displayName: access.member.displayName,
          memberType: access.member.memberType,
          status: access.member.status,
          joinedAt: access.member.joinedAt,
        }
      : null,
  };
}

export async function updateCampaign(
  db: AppDatabase,
  ctx: AuthContext | null,
  campaignId: string,
  input: {
    name?: string;
    description?: string;
    status?: CampaignStatus;
  }
) {
  const { gmCtx, campaign } = await assertCampaignGm(db, ctx, campaignId);

  const nextName = input.name !== undefined ? input.name.trim() : campaign.name;
  if (nextName.length < 2) {
    throw badRequest('INVALID_CAMPAIGN_NAME', 'El nom de la campanya ha de tenir almenys 2 caràcters.');
  }

  const nextDescription =
    input.description !== undefined ? input.description.trim() : campaign.description;
  const nextStatus = input.status ?? campaign.status;

  const [updated] = await db
    .update(campaigns)
    .set({
      name: nextName,
      description: nextDescription,
      status: nextStatus,
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaign.id))
    .returning();

  await recordAuditLog(db, {
    actorUserId: gmCtx.user.id,
    campaignId: updated.id,
    action: 'campaign.updated',
    targetType: 'campaign',
    targetId: updated.id,
    metadata: {
      previousStatus: campaign.status,
      newStatus: updated.status,
      name: updated.name,
    },
  });

  return updated;
}

export async function trashCampaign(
  db: AppDatabase,
  ctx: AuthContext | null,
  campaignId: string
) {
  const { gmCtx, campaign } = await assertCampaignGm(db, ctx, campaignId);

  const now = new Date();
  const purgeEligibleAt = new Date(now.getTime() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const [trashed] = await db
    .update(campaigns)
    .set({
      deletedAt: now,
      purgeEligibleAt,
      updatedAt: now,
    })
    .where(eq(campaigns.id, campaign.id))
    .returning();

  await recordAuditLog(db, {
    actorUserId: gmCtx.user.id,
    campaignId: trashed.id,
    action: 'campaign.trashed',
    targetType: 'campaign',
    targetId: trashed.id,
    metadata: { purgeEligibleAt: purgeEligibleAt.toISOString() },
  });

  return trashed;
}

export async function restoreCampaign(
  db: AppDatabase,
  ctx: AuthContext | null,
  campaignId: string
) {
  const { gmCtx, campaign } = await assertCampaignGm(db, ctx, campaignId, {
    allowDeleted: true,
  });

  if (!campaign.deletedAt || !campaign.purgeEligibleAt) {
    throw badRequest('CAMPAIGN_NOT_IN_TRASH', 'Aquesta campanya no es troba a la paperera.');
  }

  if (new Date() > campaign.purgeEligibleAt) {
    throw gone(
      'TRASH_RECOVERY_EXPIRED',
      'El termini de recuperació de 30 dies per a aquesta campanya ha caducat.'
    );
  }

  const [restored] = await db
    .update(campaigns)
    .set({
      deletedAt: null,
      purgeEligibleAt: null,
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaign.id))
    .returning();

  await recordAuditLog(db, {
    actorUserId: gmCtx.user.id,
    campaignId: restored.id,
    action: 'campaign.restored',
    targetType: 'campaign',
    targetId: restored.id,
  });

  return restored;
}

export async function purgeCampaign(
  db: AppDatabase,
  ctx: AuthContext | null,
  campaignId: string,
  confirmName: string
) {
  const { gmCtx, campaign } = await assertCampaignGm(db, ctx, campaignId, {
    allowDeleted: true,
  });

  if (!campaign.deletedAt) {
    throw badRequest(
      'TRASH_FIRST_REQUIRED',
      'Cal enviar primer la campanya a la paperera abans d’eliminar-la definitivament.'
    );
  }

  if (confirmName.trim() !== campaign.name.trim()) {
    throw badRequest(
      'CONFIRM_NAME_MISMATCH',
      'El nom confirmat no coincideix exactament amb el nom de la campanya.'
    );
  }

  await db.transaction(async (tx) => {
    const members = await tx
      .select({ id: campaignMembers.id })
      .from(campaignMembers)
      .where(eq(campaignMembers.campaignId, campaign.id));

    for (const m of members) {
      await revokeAllSessionsForMember(tx, m.id);
    }

    await recordAuditLog(tx, {
      actorUserId: gmCtx.user.id,
      campaignId: null,
      action: 'campaign.purged',
      targetType: 'campaign',
      targetId: campaign.id,
      metadata: { name: campaign.name },
    });

    await tx.delete(campaigns).where(eq(campaigns.id, campaign.id));
  });

  return { purgedId: campaign.id };
}
