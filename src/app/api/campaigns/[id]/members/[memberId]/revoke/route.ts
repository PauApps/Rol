import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { getServerAuthContext } from '@/server/auth/session';
import { assertUuid, handleApiError } from '@/server/http';
import { revokeCampaignMember } from '@/server/services/player-invitation-service';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await context.params;
    assertUuid(id, 'campanya');
    assertUuid(memberId, 'jugador');
    const ctx = await getServerAuthContext();
    const db = await getDb();
    const member = await revokeCampaignMember(db, ctx, id, memberId);
    return NextResponse.json({ member });
  } catch (error) {
    return handleApiError(error);
  }
}
