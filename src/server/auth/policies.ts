import { and, eq, isNull } from 'drizzle-orm';
import { campaignMembers, campaigns } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { forbidden, notFound, unauthorized } from '@/domain/errors';
import type { AuthContext, UserAuthContext } from './session';

export function assertAuthenticated(ctx: AuthContext | null): AuthContext {
  if (!ctx) {
    throw unauthorized();
  }
  return ctx;
}

export function assertAdmin(ctx: AuthContext | null): UserAuthContext {
  const authed = assertAuthenticated(ctx);
  if (authed.kind !== 'user' || authed.user.role !== 'admin') {
    throw forbidden('ADMIN_REQUIRED', 'Només l’administrador principal pot realitzar aquesta acció.');
  }
  return authed;
}

export function assertGm(ctx: AuthContext | null): UserAuthContext {
  const authed = assertAuthenticated(ctx);
  if (authed.kind !== 'user' || authed.user.role !== 'gm') {
    throw forbidden('GM_REQUIRED', 'Cal tenir un compte de Director de Joc (GM) actiu.');
  }
  return authed;
}

export async function assertCampaignGm(
  db: AppDatabase,
  ctx: AuthContext | null,
  campaignId: string,
  options?: { allowDeleted?: boolean }
) {
  const gmCtx = assertGm(ctx);

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);

  if (!campaign) {
    throw notFound('CAMPAIGN_NOT_FOUND', 'Campanya no trobada.');
  }

  if (campaign.gmUserId !== gmCtx.user.id) {
    throw forbidden('CAMPAIGN_FORBIDDEN', 'Només el GM propietari pot gestionar aquesta campanya.');
  }

  if (!options?.allowDeleted && campaign.deletedAt !== null) {
    throw notFound('CAMPAIGN_IN_TRASH', 'La campanya es troba a la paperera.');
  }

  return { gmCtx, campaign };
}

export interface CampaignAccessResult {
  campaign: typeof campaigns.$inferSelect;
  accessRole: 'gm' | 'player' | 'guest';
  member: typeof campaignMembers.$inferSelect | null;
}

export async function assertCampaignAccess(
  db: AppDatabase,
  ctx: AuthContext | null,
  campaignId: string
): Promise<CampaignAccessResult> {
  const authed = assertAuthenticated(ctx);

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), isNull(campaigns.deletedAt)))
    .limit(1);

  if (!campaign) {
    throw notFound('CAMPAIGN_NOT_FOUND', 'Campanya no trobada o eliminada.');
  }

  if (authed.kind === 'guest') {
    if (authed.member.campaignId !== campaign.id) {
      throw forbidden('CROSS_CAMPAIGN_FORBIDDEN', 'No tens accés a aquesta campanya.');
    }

    const [member] = await db
      .select()
      .from(campaignMembers)
      .where(
        and(
          eq(campaignMembers.id, authed.member.id),
          eq(campaignMembers.campaignId, campaign.id),
          eq(campaignMembers.status, 'active')
        )
      )
      .limit(1);

    if (!member) {
      throw forbidden('MEMBER_REVOKED', 'El teu accés a aquesta campanya ha estat revocat.');
    }

    return {
      campaign,
      accessRole: 'guest',
      member,
    };
  }

  if (authed.user.role === 'gm' && campaign.gmUserId === authed.user.id) {
    return {
      campaign,
      accessRole: 'gm',
      member: null,
    };
  }

  const [member] = await db
    .select()
    .from(campaignMembers)
    .where(
      and(
        eq(campaignMembers.campaignId, campaign.id),
        eq(campaignMembers.userId, authed.user.id),
        eq(campaignMembers.status, 'active')
      )
    )
    .limit(1);

  if (!member) {
    throw forbidden('CAMPAIGN_FORBIDDEN', 'No tens accés a aquesta campanya.');
  }

  return {
    campaign,
    accessRole: 'player',
    member,
  };
}
