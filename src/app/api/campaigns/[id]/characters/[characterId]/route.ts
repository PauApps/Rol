import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { getServerAuthContext } from '@/server/auth/session';
import { assertUuid, handleApiError, parseJsonBody } from '@/server/http';
import {
  getCampaignCharacter,
  updateCharacterBase,
} from '@/server/services/character-service';

export const dynamic = 'force-dynamic';

const updateCharacterSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  sheetFields: z
    .object({
      'generalInfo.appearanceNotes': z.string().max(4000).optional(),
      'background.backstory': z.string().max(8000).optional(),
    })
    .optional(),
  customFields: z.record(z.string().max(80), z.union([z.string().max(2000), z.number(), z.boolean(), z.null()])).optional(),
  gmNotes: z.string().max(8000).optional(),
  fieldPermissions: z
    .object({
      playerEditableFields: z.array(z.string().max(80)).max(30).optional(),
      gmOnlyFields: z.array(z.string().max(80)).max(30).optional(),
    })
    .optional(),
  memberId: z.string().uuid().nullable().optional(),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string; characterId: string }> }
) {
  try {
    const { id, characterId } = await context.params;
    assertUuid(id, 'campanya');
    assertUuid(characterId, 'personatge');
    const ctx = await getServerAuthContext();
    const db = await getDb();
    const character = await getCampaignCharacter(db, ctx, id, characterId);
    return NextResponse.json({ character });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; characterId: string }> }
) {
  try {
    const { id, characterId } = await context.params;
    assertUuid(id, 'campanya');
    assertUuid(characterId, 'personatge');
    const body = await parseJsonBody(request, updateCharacterSchema);
    const ctx = await getServerAuthContext();
    const db = await getDb();
    const character = await updateCharacterBase(db, ctx, id, characterId, body);
    return NextResponse.json({ character });
  } catch (error) {
    return handleApiError(error);
  }
}
