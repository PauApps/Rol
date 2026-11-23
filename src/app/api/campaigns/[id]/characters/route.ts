import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { createCharacterRequestSchema } from '@/domain/systems/dnd5e-2014';
import { getServerAuthContext } from '@/server/auth/session';
import { assertUuid, handleApiError, parseJsonBody } from '@/server/http';
import { createCharacterBase, listCampaignCharacters } from '@/server/services/character-service';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    assertUuid(id, 'campanya');
    const ctx = await getServerAuthContext();
    const db = await getDb();
    const characters = await listCampaignCharacters(db, ctx, id);
    return NextResponse.json({ characters });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    assertUuid(id, 'campanya');
    const body = await parseJsonBody(request, createCharacterRequestSchema);
    const ctx = await getServerAuthContext();
    const db = await getDb();
    const character = await createCharacterBase(db, ctx, id, body);
    return NextResponse.json({ character }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
