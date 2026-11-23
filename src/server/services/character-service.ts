import { and, desc, eq, sql } from 'drizzle-orm';
import { campaignMembers, characters } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { normalizeCampaignCreationConfig } from '@/domain/campaigns/creation-config';
import { badRequest, forbidden, notFound } from '@/domain/errors';
import {
  DEFAULT_PLAYER_EDITABLE_FIELDS,
  PROTECTED_OFFICIAL_CALCULATION_PATHS,
  buildEmptySheetFromPatch,
  computeDnd5e2014Sheet,
  dnd5e2014SheetPatchSchema,
  dnd5e2014SheetSchema,
  evaluatePlayerFieldAccess,
  extractProtectedPathsFromCreationPatch,
  extractTouchedPathsFromSheetPatch,
  mergeDnd5e2014SheetPatch,
  normalizeDnd5e2014Sheet,
  normalizeFieldPermissions,
  validateCharacterAgainstCampaignConfig,
  type CharacterFieldPermissions,
  type Dnd5e2014SheetData,
  type Dnd5e2014SheetPatchInput,
  type Dnd5e2014SheetPatchOutput,
  type NormalizedCharacterFieldPermissions,
} from '@/domain/systems/dnd5e-2014';
import { getGameSystem } from '@/domain/systems/registry';
import { assertCampaignAccess } from '../auth/policies';
import type { AuthContext } from '../auth/session';
import { recordAuditLog } from './audit-service';

export {
  DEFAULT_PLAYER_EDITABLE_FIELDS,
  PROTECTED_OFFICIAL_CALCULATION_PATHS,
  normalizeFieldPermissions,
  type CharacterFieldPermissions,
  type NormalizedCharacterFieldPermissions,
};

export const SUPPORTED_BASE_SHEET_FIELD_PATHS = [
  'generalInfo.appearanceNotes',
  'background.backstory',
] as const;

export type SupportedBaseSheetFieldPath = (typeof SUPPORTED_BASE_SHEET_FIELD_PATHS)[number];

export interface CreateCharacterInput {
  name: string;
  memberId?: string | null;
  overrideLimit?: boolean;
  sheetData?: Dnd5e2014SheetPatchInput;
  customFields?: Record<string, unknown>;
  gmNotes?: string;
  fieldPermissions?: CharacterFieldPermissions;
}

export interface UpdateCharacterBaseInput {
  name?: string;
  sheetFields?: Partial<Record<SupportedBaseSheetFieldPath, string>>;
  sheetPatch?: Dnd5e2014SheetPatchInput;
  customFields?: Record<string, unknown>;
  gmNotes?: string;
  fieldPermissions?: CharacterFieldPermissions;
  memberId?: string | null;
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

function sanitizeCustomFieldsPatch(raw: Record<string, unknown> | undefined): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!raw) return result;
  for (const [key, value] of Object.entries(raw)) {
    const cleanKey = key.trim();
    if (!cleanKey || value === null || value === undefined) continue;
    result[cleanKey] = value;
  }
  return result;
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
  // Normalize both v1 and v2 stored sheets safely without dropping user data
  const normalizedSheet = normalizeDnd5e2014Sheet(row.sheetData, row.name);

  if (access.accessRole === 'gm') {
    return {
      id: row.id,
      campaignId: row.campaignId,
      memberId: row.memberId,
      ownerDisplayName: row.ownerDisplayName ?? null,
      systemId: row.systemId,
      name: row.name,
      schemaVersion: row.schemaVersion,
      sheetData: normalizedSheet,
      computed: computeDnd5e2014Sheet(normalizedSheet),
      customFields: cloneJsonObject(row.customFields),
      gmNotes: row.gmNotes,
      fieldPermissions: perms,
      isMine: false,
      canEdit: true,
      editableFields: ['*'],
      authorizedOverrideFields: [...PROTECTED_OFFICIAL_CALCULATION_PATHS],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  const sanitized = stripGmOnlyFields(normalizedSheet, row.customFields, perms.gmOnlyFields);
  // Compute derived snapshot strictly over non-GM visible data
  const safeSheetForComputation = normalizeDnd5e2014Sheet(sanitized.sheetData, row.name);
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
    computed: computeDnd5e2014Sheet(safeSheetForComputation),
    customFields: sanitized.customFields,
    isMine,
    canEdit: isMine,
    editableFields: isMine ? perms.playerEditableFields : [],
    authorizedOverrideFields: isMine ? perms.authorizedOverrideFields : [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createCharacterBase(
  db: AppDatabase,
  ctx: AuthContext | null,
  campaignId: string,
  input: CreateCharacterInput
) {
  const access = await assertCampaignAccess(db, ctx, campaignId);
  const name = input.name.trim();

  if (name.length < 1 || name.length > 100) {
    throw badRequest(
      'INVALID_CHARACTER_NAME',
      'El nom del personatge és obligatori (màxim 100 caràcters).'
    );
  }

  const systemDef = getGameSystem(access.campaign.systemId);
  if (!systemDef) {
    throw badRequest('SYSTEM_NOT_REGISTERED', 'Sistema de rol no registrat al domini.');
  }

  const isGm = access.accessRole === 'gm';
  const allowOverride = isGm && input.overrideLimit === true;

  if (!isGm) {
    if (input.gmNotes !== undefined || input.fieldPermissions !== undefined) {
      throw forbidden(
        'GM_ONLY_FIELD_FORBIDDEN',
        'Només el Director de Joc pot establir notes privades o permisos de camps.'
      );
    }
    if (input.customFields && Object.keys(input.customFields).length > 0) {
      throw forbidden(
        'FIELD_EDIT_NOT_AUTHORIZED',
        'No tens permís del GM per definir camps personalitzats.'
      );
    }
  }

  let parsedInitialPatch: Dnd5e2014SheetPatchOutput | undefined;
  if (input.sheetData !== undefined) {
    const patchCheck = dnd5e2014SheetPatchSchema.safeParse(input.sheetData);
    if (!patchCheck.success) {
      throw badRequest(
        'INVALID_CHARACTER_SHEET',
        patchCheck.error.issues[0]?.message ?? 'Les dades inicials de la fitxa no són vàlides.',
        patchCheck.error.issues
      );
    }
    parsedInitialPatch = patchCheck.data;

    if (
      parsedInitialPatch.generalInfo?.name !== undefined &&
      parsedInitialPatch.generalInfo.name !== name
    ) {
      throw badRequest(
        'INVALID_CHARACTER_NAME',
        'El nom del personatge i `generalInfo.name` han de coincidir.'
      );
    }

    if (!isGm) {
      const protectedPaths = extractProtectedPathsFromCreationPatch(parsedInitialPatch);
      if (protectedPaths.length > 0) {
        throw forbidden(
          'OFFICIAL_CALCULATION_PROTECTED',
          `El camp "${protectedPaths[0]}" protegeix càlculs oficials de D&D 5e (2014) i requereix autorització del GM.`
        );
      }
    }
  }

  const creationConfig = normalizeCampaignCreationConfig(access.campaign.creationConfig);
  const candidateSheet = buildEmptySheetFromPatch(
    name,
    creationConfig.startingLevel,
    parsedInitialPatch
  );

  const sheetCheck = dnd5e2014SheetSchema.safeParse(candidateSheet);
  if (!sheetCheck.success) {
    throw badRequest(
      'INVALID_CHARACTER_SHEET',
      sheetCheck.error.issues[0]?.message ?? 'La fitxa resultant no compleix l’esquema v2.',
      sheetCheck.error.issues
    );
  }
  const validatedSheet = sheetCheck.data as Dnd5e2014SheetData;

  const creationValidation = validateCharacterAgainstCampaignConfig(
    validatedSheet,
    creationConfig,
    {
      isGm,
      isCreation: true,
    }
  );
  if (!creationValidation.valid) {
    throw badRequest(
      'CREATION_RESTRICTION_VIOLATION',
      creationValidation.violations[0] ?? 'La creació no compleix les regles de la campanya.',
      { violations: creationValidation.violations }
    );
  }

  const normalizedPermissions = normalizeFieldPermissions(
    isGm ? input.fieldPermissions : undefined
  );
  const cleanCustomFields = isGm ? sanitizeCustomFieldsPatch(input.customFields) : {};
  const gmNotes = isGm ? (input.gmNotes ?? '') : '';

  const created = await db.transaction(async (tx) => {
    let resolvedMemberId: string | null = null;

    if (isGm) {
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

    const [inserted] = await tx
      .insert(characters)
      .values({
        campaignId: access.campaign.id,
        memberId: resolvedMemberId,
        systemId: systemDef.id,
        name,
        schemaVersion: systemDef.schemaVersion,
        sheetData: validatedSheet,
        customFields: cleanCustomFields,
        fieldPermissions: normalizedPermissions,
        gmNotes,
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
        schemaVersion: inserted.schemaVersion,
        startingLevel: creationConfig.startingLevel,
      },
    });

    return inserted;
  });

  const computed = computeDnd5e2014Sheet(validatedSheet);

  if (isGm) {
    return {
      ...created,
      sheetData: validatedSheet,
      fieldPermissions: normalizedPermissions,
      computed,
      warnings: creationValidation.warnings,
    };
  }

  return {
    id: created.id,
    campaignId: created.campaignId,
    memberId: created.memberId,
    systemId: created.systemId,
    name: created.name,
    schemaVersion: created.schemaVersion,
    sheetData: validatedSheet,
    computed,
    customFields: created.customFields,
    warnings: creationValidation.warnings,
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

  const systemDef = getGameSystem(access.campaign.systemId);
  if (!systemDef) {
    throw badRequest('SYSTEM_NOT_REGISTERED', 'Sistema de rol no registrat al domini.');
  }

  const isGm = access.accessRole === 'gm';
  const perms = normalizeFieldPermissions(existing.fieldPermissions);
  const existingNormalized = normalizeDnd5e2014Sheet(existing.sheetData, existing.name);

  let parsedSheetPatch: Dnd5e2014SheetPatchOutput | undefined;
  if (patch.sheetPatch !== undefined) {
    const patchCheck = dnd5e2014SheetPatchSchema.safeParse(patch.sheetPatch);
    if (!patchCheck.success) {
      throw badRequest(
        'INVALID_CHARACTER_SHEET',
        patchCheck.error.issues[0]?.message ?? 'Les dades d’actualització de la fitxa no són vàlides.',
        patchCheck.error.issues
      );
    }
    parsedSheetPatch = patchCheck.data;
  }

  if (
    patch.name !== undefined &&
    parsedSheetPatch?.generalInfo?.name !== undefined &&
    patch.name.trim() !== parsedSheetPatch.generalInfo.name.trim()
  ) {
    throw badRequest(
      'INVALID_CHARACTER_NAME',
      'El nom del personatge i `generalInfo.name` no coincideixen.'
    );
  }

  const sheetPatchTouched = parsedSheetPatch
    ? extractTouchedPathsFromSheetPatch(parsedSheetPatch, existingNormalized, perms)
    : [];

  if (!isGm) {
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

    if (patch.name !== undefined) {
      const nameDecision = evaluatePlayerFieldAccess('name', perms);
      if (!nameDecision.allowed) {
        throw forbidden(
          'FIELD_EDIT_NOT_AUTHORIZED',
          'El Director de Joc no autoritza modificar el nom del personatge.'
        );
      }
    }

    if (patch.sheetFields) {
      for (const [fieldPath, value] of Object.entries(patch.sheetFields)) {
        if (value === undefined) continue;
        const decision = evaluatePlayerFieldAccess(fieldPath, perms);
        if (!decision.allowed) {
          throw forbidden(
            decision.reason === 'OFFICIAL_CALCULATION_PROTECTED'
              ? 'OFFICIAL_CALCULATION_PROTECTED'
              : 'FIELD_EDIT_NOT_AUTHORIZED',
            `No tens permís del GM per modificar el camp "${fieldPath}".`
          );
        }
      }
    }

    for (const touchedPath of sheetPatchTouched) {
      const decision = evaluatePlayerFieldAccess(touchedPath, perms);
      if (!decision.allowed) {
        if (decision.reason === 'OFFICIAL_CALCULATION_PROTECTED') {
          throw forbidden(
            'OFFICIAL_CALCULATION_PROTECTED',
            `El camp "${touchedPath}" protegeix càlculs oficials de D&D 5e (2014) i requereix autorització explícita del GM.`
          );
        }
        throw forbidden(
          'FIELD_EDIT_NOT_AUTHORIZED',
          `No tens permís del GM per modificar el camp "${touchedPath}".`
        );
      }
    }

    if (patch.customFields) {
      for (const customKey of Object.keys(patch.customFields)) {
        const cleanKey = customKey.trim();
        if (!cleanKey) continue;
        const decision = evaluatePlayerFieldAccess(`customFields.${cleanKey}`, perms);
        if (!decision.allowed) {
          throw forbidden(
            'FIELD_EDIT_NOT_AUTHORIZED',
            `No tens permís del GM per modificar el camp personalitzat "${cleanKey}".`
          );
        }
      }
    }
  }

  const changedFields: string[] = [];
  let nextName = existing.name;
  let nextSheetData: Dnd5e2014SheetData = existingNormalized;
  const nextCustomFields = cloneJsonObject(existing.customFields);
  let nextGmNotes = existing.gmNotes;
  let nextFieldPermissions: NormalizedCharacterFieldPermissions = perms;
  let nextMemberId = existing.memberId;

  if (parsedSheetPatch) {
    nextSheetData = mergeDnd5e2014SheetPatch(nextSheetData, parsedSheetPatch);
    if (parsedSheetPatch.generalInfo?.name !== undefined) {
      nextName = parsedSheetPatch.generalInfo.name;
    }
    changedFields.push(...sheetPatchTouched);
  }

  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (trimmed.length < 1 || trimmed.length > 100) {
      throw badRequest(
        'INVALID_CHARACTER_NAME',
        'El nom del personatge no pot quedar buit (màxim 100 caràcters).'
      );
    }
    nextName = trimmed;
    nextSheetData.generalInfo.name = nextName;
    if (!changedFields.includes('name')) {
      changedFields.push('name');
    }
  }

  if (patch.sheetFields) {
    if (patch.sheetFields['generalInfo.appearanceNotes'] !== undefined) {
      nextSheetData.generalInfo.appearanceNotes =
        patch.sheetFields['generalInfo.appearanceNotes'].trim();
      changedFields.push('generalInfo.appearanceNotes');
    }
    if (patch.sheetFields['background.backstory'] !== undefined) {
      nextSheetData.background.backstory = patch.sheetFields['background.backstory'].trim();
      changedFields.push('background.backstory');
    }
  }

  const sheetCheck = dnd5e2014SheetSchema.safeParse(nextSheetData);
  if (!sheetCheck.success) {
    throw badRequest(
      'INVALID_CHARACTER_SHEET',
      sheetCheck.error.issues[0]?.message ?? 'La fitxa resultant no compleix l’esquema v2.',
      sheetCheck.error.issues
    );
  }
  const validatedSheet = sheetCheck.data as Dnd5e2014SheetData;

  const creationConfig = normalizeCampaignCreationConfig(access.campaign.creationConfig);
  const allTouchedForCreation = [
    ...(patch.name !== undefined ? ['name'] : []),
    ...(patch.sheetFields ? Object.keys(patch.sheetFields) : []),
    ...sheetPatchTouched,
  ];
  const creationValidation = validateCharacterAgainstCampaignConfig(
    validatedSheet,
    creationConfig,
    {
      isGm,
      isCreation: false,
      touchedPaths: allTouchedForCreation,
    }
  );
  if (!creationValidation.valid) {
    throw badRequest(
      'CREATION_RESTRICTION_VIOLATION',
      creationValidation.violations[0] ?? 'Els canvis incompleixen les regles de la campanya.',
      { violations: creationValidation.violations }
    );
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

  if (isGm) {
    if (patch.gmNotes !== undefined) {
      nextGmNotes = patch.gmNotes;
      changedFields.push('gmNotes');
    }
    if (patch.fieldPermissions !== undefined) {
      nextFieldPermissions = normalizeFieldPermissions({
        playerEditableFields:
          patch.fieldPermissions.playerEditableFields !== undefined
            ? patch.fieldPermissions.playerEditableFields
            : perms.playerEditableFields,
        gmOnlyFields:
          patch.fieldPermissions.gmOnlyFields !== undefined
            ? patch.fieldPermissions.gmOnlyFields
            : perms.gmOnlyFields,
        authorizedOverrideFields:
          patch.fieldPermissions.authorizedOverrideFields !== undefined
            ? patch.fieldPermissions.authorizedOverrideFields
            : perms.authorizedOverrideFields,
      });
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
      schemaVersion: systemDef.schemaVersion,
      sheetData: validatedSheet,
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
    metadata: { changedFields: Array.from(new Set(changedFields)) },
  });

  const updatedCharacter = await getCampaignCharacter(db, ctx, campaignId, existing.id);
  return {
    ...updatedCharacter,
    warnings: creationValidation.warnings,
  };
}
