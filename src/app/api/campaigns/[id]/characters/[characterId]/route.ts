import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { updateCharacterRequestSchema } from '@/domain/systems/dnd5e-2014';
import { getServerAuthContext } from '@/server/auth/session';
import { assertUuid, handleApiError, parseJsonBody } from '@/server/http';
import {
  deleteCampaignCharacter,
  getCampaignCharacter,
  updateCharacterBase,
} from '@/server/services/character-service';

export const dynamic = 'force-dynamic';

const deleteCharacterRequestSchema = z.object({
  confirmName: z
    .string()
    .trim()
    .min(1, 'Cal escriure el nom exacte del personatge per confirmar-ne l’eliminació.'),
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
    const body = await parseJsonBody(request, updateCharacterRequestSchema);
    const ctx = await getServerAuthContext();
    const db = await getDb();
    const character = await updateCharacterBase(db, ctx, id, characterId, body);
    return NextResponse.json({ character });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; characterId: string }> }
) {
  try {
    const { id, characterId } = await context.params;
    assertUuid(id, 'campanya');
    assertUuid(characterId, 'personatge');
    const body = await parseJsonBody(request, deleteCharacterRequestSchema);
    const ctx = await getServerAuthContext();
    const db = await getDb();
    const result = await deleteCampaignCharacter(db, ctx, id, characterId, body.confirmName);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
