import { and, desc, eq } from 'drizzle-orm';
import { campaignMembers, characters } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { badRequest, forbidden } from '@/domain/errors';
import { getGameSystem } from '@/domain/systems/registry';
import { assertCampaignAccess } from '../auth/policies';
import type { AuthContext } from '../auth/session';
import { recordAuditLog } from './audit-service';

export async function listCampaignCharacters(
  db: AppDatabase,
  ctx: AuthContext | null,
  campaignId: string
) {
  const access = await assertCampaignAccess(db, ctx, campaignId);

  if (access.accessRole === 'gm') {
    return db
      .select({
        id: characters.id,
        campaignId: characters.campaignId,
        memberId: characters.memberId,
        systemId: characters.systemId,
        name: characters.name,
        schemaVersion: characters.schemaVersion,
        createdAt: characters.createdAt,
        updatedAt: characters.updatedAt,
      })
      .from(characters)
      .where(eq(characters.campaignId, access.campaign.id))
      .orderBy(desc(characters.createdAt));
  }

  return db
    .select({
      id: characters.id,
      campaignId: characters.campaignId,
      memberId: characters.memberId,
      systemId: characters.systemId,
      name: characters.name,
      schemaVersion: characters.schemaVersion,
      createdAt: characters.createdAt,
      updatedAt: characters.updatedAt,
    })
    .from(characters)
    .where(
      and(
        eq(characters.campaignId, access.campaign.id),
        eq(characters.memberId, access.member!.id)
      )
    )
    .orderBy(desc(characters.createdAt));
}

export async function createCharacterBase(
  db: AppDatabase,
  ctx: AuthContext | null,
  campaignId: string,
  input: { name: string; memberId?: string | null }
) {
  const access = await assertCampaignAccess(db, ctx, campaignId);
  const name = input.name.trim();

  if (name.length < 1) {
    throw badRequest('INVALID_CHARACTER_NAME', 'El nom del personatge és obligatori.');
  }

  const systemDef = getGameSystem(access.campaign.systemId);
  if (!systemDef) {
    throw badRequest('SYSTEM_NOT_REGISTERED', 'Sistema de rol no registrat al domini.');
  }

  let resolvedMemberId: string | null = null;
  if (access.accessRole === 'gm') {
    if (input.memberId) {
      const [member] = await db
        .select({ id: campaignMembers.id })
        .from(campaignMembers)
        .where(
          and(
            eq(campaignMembers.id, input.memberId),
            eq(campaignMembers.campaignId, access.campaign.id),
            eq(campaignMembers.status, 'active')
          )
        )
        .limit(1);

      if (!member) {
        throw badRequest('INVALID_MEMBER', 'El jugador indicat no pertany a aquesta campanya.');
      }
      resolvedMemberId = member.id;
    }
  } else {
    if (input.memberId && input.memberId !== access.member!.id) {
      throw forbidden(
        'CHARACTER_OWNER_FORBIDDEN',
        'No pots crear personatges assignats a un altre jugador.'
      );
    }
    resolvedMemberId = access.member!.id;
  }

  const emptySheet = systemDef.createEmptySheet(name);

  const [created] = await db
    .insert(characters)
    .values({
      campaignId: access.campaign.id,
      memberId: resolvedMemberId,
      systemId: systemDef.id,
      name,
      schemaVersion: systemDef.schemaVersion,
      sheetData: emptySheet,
      customFields: {},
      fieldPermissions: {},
      createdByUserId: ctx?.kind === 'user' ? ctx.user.id : null,
    })
    .returning();

  await recordAuditLog(db, {
    actorUserId: ctx?.kind === 'user' ? ctx.user.id : null,
    actorMemberId: ctx?.kind === 'guest' ? ctx.member.id : null,
    campaignId: access.campaign.id,
    action: 'character.base_created',
    targetType: 'character',
    targetId: created.id,
    metadata: { name: created.name, systemId: created.systemId },
  });

  return created;
}
