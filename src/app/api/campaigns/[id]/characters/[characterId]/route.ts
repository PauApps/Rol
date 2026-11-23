import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { updateCharacterRequestSchema } from '@/domain/systems/dnd5e-2014';
import { getServerAuthContext } from '@/server/auth/session';
import { assertUuid, handleApiError, parseJsonBody } from '@/server/http';
import {
  getCampaignCharacter,
  updateCharacterBase,
} from '@/server/services/character-service';

export const dynamic = 'force-dynamic';

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
