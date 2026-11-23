import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { getServerAuthContext } from '@/server/auth/session';
import { assertUuid, handleApiError, parseJsonBody } from '@/server/http';
import { createCharacterBase, listCampaignCharacters } from '@/server/services/character-service';

export const dynamic = 'force-dynamic';

const createCharacterSchema = z.object({
  name: z.string().trim().min(1, 'El nom del personatge és obligatori.').max(100),
  memberId: z.string().uuid().nullable().optional(),
});

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
    const body = await parseJsonBody(request, createCharacterSchema);
    const ctx = await getServerAuthContext();
    const db = await getDb();
    const character = await createCharacterBase(db, ctx, id, body);
    return NextResponse.json({ character }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
