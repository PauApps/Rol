import { and, desc, eq, sql } from 'drizzle-orm';
import { campaignMembers, characters } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { normalizeCampaignCreationConfig } from '@/domain/campaigns/creation-config';
import { badRequest, forbidden, notFound } from '@/domain/errors';
import { getGameSystem } from '@/domain/systems/registry';
import { assertCampaignAccess } from '../auth/policies';
import type { AuthContext } from '../auth/session';
import { recordAuditLog } from './audit-service';

export interface CharacterFieldPermissions {
  playerEditableFields?: string[];
  gmOnlyFields?: string[];
}

export const DEFAULT_PLAYER_EDITABLE_FIELDS = [
  'name',
  'generalInfo.appearanceNotes',
  'background.backstory',
] as const;

export const SUPPORTED_BASE_SHEET_FIELD_PATHS = [
  'generalInfo.appearanceNotes',
  'background.backstory',
] as const;

export type SupportedBaseSheetFieldPath = (typeof SUPPORTED_BASE_SHEET_FIELD_PATHS)[number];

export interface UpdateCharacterBaseInput {
  name?: string;
  sheetFields?: Partial<Record<SupportedBaseSheetFieldPath, string>>;
  customFields?: Record<string, unknown>;
  gmNotes?: string;
  fieldPermissions?: CharacterFieldPermissions;
  memberId?: string | null;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const set = new Set<string>();
  for (const item of value) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed) set.add(trimmed);
    }
  }
  return Array.from(set);
}

export function normalizeFieldPermissions(raw: unknown): Required<CharacterFieldPermissions> {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const gmOnlyFields = normalizeStringArray(obj.gmOnlyFields) ?? [];
  const gmOnlySet = new Set(gmOnlyFields);

  const rawEditable = normalizeStringArray(obj.playerEditableFields);
  const baseEditable =
    rawEditable !== undefined ? rawEditable : [...DEFAULT_PLAYER_EDITABLE_FIELDS];

  return {
    playerEditableFields: baseEditable.filter((field) => !gmOnlySet.has(field)),
    gmOnlyFields,
  };
}

function cloneJsonObject<T extends Record<string, unknown>>(obj: T): T {
  return JSON.parse(JSON.stringify(obj ?? {})) as T;
}

function deleteNestedDottedPath(target: Record<string, unknown>, dottedPath: string): void {
  const segments = dottedPath.split('.').filter(Boolean);
  if (segments.length === 0) return;

  let current: Record<string, unknown> = target;
  for (let i = 0; i < segments.length - 1; i++) {
    const next = current[segments[i]];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      return;
    }
    current = next as Record<string, unknown>;
  }
  delete current[segments[segments.length - 1]];
}

function setNestedDottedPath(
  target: Record<string, unknown>,
  dottedPath: string,
  value: unknown
): void {
  const segments = dottedPath.split('.').filter(Boolean);
  if (segments.length === 0) return;

  let current: Record<string, unknown> = target;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const next = current[seg];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      current[seg] = {};
    }
    current = current[seg] as Record<string, unknown>;
  }
  current[segments[segments.length - 1]] = value;
}

export function stripGmOnlyFields(
  sheetData: Record<string, unknown>,
  customFields: Record<string, unknown>,
  gmOnlyFields: string[]
): {
  sheetData: Record<string, unknown>;
  customFields: Record<string, unknown>;
} {
  const clonedSheet = cloneJsonObject(sheetData);
  const clonedCustom = cloneJsonObject(customFields);

  for (const fieldPath of gmOnlyFields) {
    if (fieldPath === 'customFields') {
      for (const key of Object.keys(clonedCustom)) {
        delete clonedCustom[key];
      }
      continue;
    }
    if (fieldPath.startsWith('customFields.')) {
      deleteNestedDottedPath(clonedCustom, fieldPath.slice('customFields.'.length));
      continue;
    }
    deleteNestedDottedPath(clonedSheet, fieldPath);
  }

  return {
    sheetData: clonedSheet,
    customFields: clonedCustom,
  };
}

/**
 * Lists ALL characters belonging to the campaign.
 * - Both GM and active players/guests of the campaign can inspect the party's characters.
 * - Strict campaign isolation applies via `assertCampaignAccess`.
 * - GM-private notes and GM-only permission configuration are omitted for non-GM actors.
 */
export async function listCampaignCharacters(
  db: AppDatabase,
  ctx: AuthContext | null,
  campaignId: string
) {
  const access = await assertCampaignAccess(db, ctx, campaignId);

  const rows = await db
    .select({
      id: characters.id,
      campaignId: characters.campaignId,
      memberId: characters.memberId,
      ownerDisplayName: campaignMembers.displayName,
      systemId: characters.systemId,
      name: characters.name,
      schemaVersion: characters.schemaVersion,
      gmNotes: characters.gmNotes,
      fieldPermissions: characters.fieldPermissions,
      createdAt: characters.createdAt,
      updatedAt: characters.updatedAt,
    })
    .from(characters)
    .leftJoin(campaignMembers, eq(characters.memberId, campaignMembers.id))
    .where(eq(characters.campaignId, access.campaign.id))
    .orderBy(desc(characters.createdAt));

  if (access.accessRole === 'gm') {
    return rows.map((row) => ({
      id: row.id,
      campaignId: row.campaignId,
      memberId: row.memberId,
      ownerDisplayName: row.ownerDisplayName ?? null,
      systemId: row.systemId,
      name: row.name,
      schemaVersion: row.schemaVersion,
      isMine: false,
      canEdit: true,
      gmNotes: row.gmNotes,
      fieldPermissions: normalizeFieldPermissions(row.fieldPermissions),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  const myMemberId = access.member!.id;
  return rows.map((row) => {
    const isMine = row.memberId === myMemberId;
    return {
      id: row.id,
      campaignId: row.campaignId,
      memberId: row.memberId,
      ownerDisplayName: row.ownerDisplayName ?? null,
      systemId: row.systemId,
      name: row.name,
      schemaVersion: row.schemaVersion,
      isMine,
      canEdit: isMine,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
}

export async function getCampaignCharacter(
  db: AppDatabase,
  ctx: AuthContext | null,
  campaignId: string,
  characterId: string
) {
  const access = await assertCampaignAccess(db, ctx, campaignId);

  const [row] = await db
    .select({
      id: characters.id,
      campaignId: characters.campaignId,
      memberId: characters.memberId,
      ownerDisplayName: campaignMembers.displayName,
      systemId: characters.systemId,
      name: characters.name,
      schemaVersion: characters.schemaVersion,
      sheetData: characters.sheetData,
      customFields: characters.customFields,
      fieldPermissions: characters.fieldPermissions,
      gmNotes: characters.gmNotes,
      createdAt: characters.createdAt,
      updatedAt: characters.updatedAt,
    })
    .from(characters)
    .leftJoin(campaignMembers, eq(characters.memberId, campaignMembers.id))
    .where(and(eq(characters.id, characterId), eq(characters.campaignId, access.campaign.id)))
    .limit(1);

  if (!row) {
    throw notFound('CHARACTER_NOT_FOUND', 'Personatge no trobat dins d’aquesta campanya.');
  }

  const perms = normalizeFieldPermissions(row.fieldPermissions);

  if (access.accessRole === 'gm') {
    return {
      id: row.id,
      campaignId: row.campaignId,
      memberId: row.memberId,
      ownerDisplayName: row.ownerDisplayName ?? null,
      systemId: row.systemId,
      name: row.name,
      schemaVersion: row.schemaVersion,
      sheetData: cloneJsonObject(row.sheetData),
      customFields: cloneJsonObject(row.customFields),
      gmNotes: row.gmNotes,
      fieldPermissions: perms,
      isMine: false,
      canEdit: true,
      editableFields: ['*'],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  const sanitized = stripGmOnlyFields(row.sheetData, row.customFields, perms.gmOnlyFields);
  const isMine = row.memberId === access.member!.id;

  return {
    id: row.id,
    campaignId: row.campaignId,
    memberId: row.memberId,
    ownerDisplayName: row.ownerDisplayName ?? null,
    systemId: row.systemId,
    name: row.name,
    schemaVersion: row.schemaVersion,
    sheetData: sanitized.sheetData,
    customFields: sanitized.customFields,
    isMine,
    canEdit: isMine,
    editableFields: isMine ? perms.playerEditableFields : [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createCharacterBase(
  db: AppDatabase,
  ctx: AuthContext | null,
  campaignId: string,
  input: { name: string; memberId?: string | null; overrideLimit?: boolean }
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

  const allowOverride = access.accessRole === 'gm' && input.overrideLimit === true;

  const created = await db.transaction(async (tx) => {
    let resolvedMemberId: string | null = null;

    if (access.accessRole === 'gm') {
      if (input.memberId) {
        const [member] = await tx
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

    // Server-side enforcement of per-player character limit
    if (resolvedMemberId !== null && access.campaign.maxCharactersPerPlayer !== null) {
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(characters)
        .where(
          and(
            eq(characters.campaignId, access.campaign.id),
            eq(characters.memberId, resolvedMemberId)
          )
        );

      if (count >= access.campaign.maxCharactersPerPlayer && !allowOverride) {
        throw forbidden(
          'CHARACTER_LIMIT_REACHED',
          `S’ha assolit el límit màxim de ${access.campaign.maxCharactersPerPlayer} personatges per jugador en aquesta campanya.`
        );
      }
    }

    const creationConfig = normalizeCampaignCreationConfig(access.campaign.creationConfig);
    const emptySheet = systemDef.createEmptySheet(name);
    setNestedDottedPath(emptySheet, 'progression.totalLevel', creationConfig.startingLevel);

    const [inserted] = await tx
      .insert(characters)
      .values({
        campaignId: access.campaign.id,
        memberId: resolvedMemberId,
        systemId: systemDef.id,
        name,
        schemaVersion: systemDef.schemaVersion,
        sheetData: emptySheet,
        customFields: {},
        fieldPermissions: {
          playerEditableFields: [...DEFAULT_PLAYER_EDITABLE_FIELDS],
          gmOnlyFields: [],
        },
        gmNotes: '',
        createdByUserId: ctx?.kind === 'user' ? ctx.user.id : null,
      })
      .returning();

    await recordAuditLog(tx, {
      actorUserId: ctx?.kind === 'user' ? ctx.user.id : null,
      actorMemberId: ctx?.kind === 'guest' ? ctx.member.id : null,
      campaignId: access.campaign.id,
      action: 'character.base_created',
      targetType: 'character',
      targetId: inserted.id,
      metadata: {
        name: inserted.name,
        systemId: inserted.systemId,
        startingLevel: creationConfig.startingLevel,
      },
    });

    return inserted;
  });

  if (access.accessRole === 'gm') {
    return created;
  }

  return {
    id: created.id,
    campaignId: created.campaignId,
    memberId: created.memberId,
    systemId: created.systemId,
    name: created.name,
    schemaVersion: created.schemaVersion,
    sheetData: created.sheetData,
    customFields: created.customFields,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  };
}

export async function updateCharacterBase(
  db: AppDatabase,
  ctx: AuthContext | null,
  campaignId: string,
  characterId: string,
  patch: UpdateCharacterBaseInput
) {
  const access = await assertCampaignAccess(db, ctx, campaignId);

  const [existing] = await db
    .select()
    .from(characters)
    .where(and(eq(characters.id, characterId), eq(characters.campaignId, access.campaign.id)))
    .limit(1);

  if (!existing) {
    throw notFound('CHARACTER_NOT_FOUND', 'Personatge no trobat dins d’aquesta campanya.');
  }

  const perms = normalizeFieldPermissions(existing.fieldPermissions);

  if (access.accessRole !== 'gm') {
    if (existing.memberId !== access.member!.id) {
      throw forbidden(
        'CHARACTER_EDIT_FORBIDDEN',
        'Només pots modificar el teu propi personatge.'
      );
    }

    if (
      patch.gmNotes !== undefined ||
      patch.fieldPermissions !== undefined ||
      patch.memberId !== undefined
    ) {
      throw forbidden(
        'GM_ONLY_FIELD_FORBIDDEN',
        'Només el Director de Joc pot modificar les notes privades, permisos o titularitat.'
      );
    }

    const editableSet = new Set(perms.playerEditableFields);
    const gmOnlySet = new Set(perms.gmOnlyFields);

    if (patch.name !== undefined && (!editableSet.has('name') || gmOnlySet.has('name'))) {
      throw forbidden(
        'FIELD_EDIT_NOT_AUTHORIZED',
        'El Director de Joc no autoritza modificar el nom del personatge.'
      );
    }

    if (patch.sheetFields) {
      for (const [fieldPath, value] of Object.entries(patch.sheetFields)) {
        if (value === undefined) continue;
        if (!editableSet.has(fieldPath) || gmOnlySet.has(fieldPath)) {
          throw forbidden(
            'FIELD_EDIT_NOT_AUTHORIZED',
            `No tens permís del GM per modificar el camp "${fieldPath}".`
          );
        }
      }
    }

    if (patch.customFields) {
      for (const customKey of Object.keys(patch.customFields)) {
        const dotted = `customFields.${customKey}`;
        const allowedByWildcard =
          editableSet.has('customFields') && !gmOnlySet.has('customFields');
        const allowedExplicit = editableSet.has(dotted);
        if ((!allowedByWildcard && !allowedExplicit) || gmOnlySet.has(dotted)) {
          throw forbidden(
            'FIELD_EDIT_NOT_AUTHORIZED',
            `No tens permís del GM per modificar el camp personalitzat "${customKey}".`
          );
        }
      }
    }
  }

  const changedFields: string[] = [];
  let nextName = existing.name;
  const nextSheetData = cloneJsonObject(existing.sheetData);
  const nextCustomFields = cloneJsonObject(existing.customFields);
  let nextGmNotes = existing.gmNotes;
  let nextFieldPermissions = perms;
  let nextMemberId = existing.memberId;

  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (trimmed.length < 1) {
      throw badRequest('INVALID_CHARACTER_NAME', 'El nom del personatge no pot quedar buit.');
    }
    nextName = trimmed;
    setNestedDottedPath(nextSheetData, 'generalInfo.name', nextName);
    changedFields.push('name');
  }

  if (patch.sheetFields) {
    for (const [fieldPath, value] of Object.entries(patch.sheetFields)) {
      if (value === undefined) continue;
      setNestedDottedPath(nextSheetData, fieldPath, value.trim());
      changedFields.push(fieldPath);
    }
  }

  if (patch.customFields) {
    for (const [key, value] of Object.entries(patch.customFields)) {
      const cleanKey = key.trim();
      if (!cleanKey) continue;
      if (value === null || value === undefined) {
        delete nextCustomFields[cleanKey];
      } else {
        nextCustomFields[cleanKey] = value;
      }
      changedFields.push(`customFields.${cleanKey}`);
    }
  }

  if (access.accessRole === 'gm') {
    if (patch.gmNotes !== undefined) {
      nextGmNotes = patch.gmNotes;
      changedFields.push('gmNotes');
    }
    if (patch.fieldPermissions !== undefined) {
      nextFieldPermissions = normalizeFieldPermissions(patch.fieldPermissions);
      changedFields.push('fieldPermissions');
    }
    if (patch.memberId !== undefined) {
      if (patch.memberId === null) {
        nextMemberId = null;
      } else {
        const [member] = await db
          .select({ id: campaignMembers.id })
          .from(campaignMembers)
          .where(
            and(
              eq(campaignMembers.id, patch.memberId),
              eq(campaignMembers.campaignId, access.campaign.id),
              eq(campaignMembers.status, 'active')
            )
          )
          .limit(1);

        if (!member) {
          throw badRequest('INVALID_MEMBER', 'El jugador indicat no pertany a aquesta campanya.');
        }
        nextMemberId = member.id;
      }
      changedFields.push('memberId');
    }
  }

  await db
    .update(characters)
    .set({
      name: nextName,
      sheetData: nextSheetData,
      customFields: nextCustomFields,
      gmNotes: nextGmNotes,
      fieldPermissions: nextFieldPermissions,
      memberId: nextMemberId,
      updatedAt: new Date(),
    })
    .where(and(eq(characters.id, existing.id), eq(characters.campaignId, access.campaign.id)));

  await recordAuditLog(db, {
    actorUserId: ctx?.kind === 'user' ? ctx.user.id : null,
    actorMemberId: ctx?.kind === 'guest' ? ctx.member.id : null,
    campaignId: access.campaign.id,
    action: 'character.updated',
    targetType: 'character',
    targetId: existing.id,
    metadata: { changedFields },
  });

  return getCampaignCharacter(db, ctx, campaignId, existing.id);
}
