import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { getServerAuthContext } from '@/server/auth/session';
import { assertUuid, handleApiError } from '@/server/http';
import { revokePlayerInvitation } from '@/server/services/player-invitation-service';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string; invitationId: string }> }
) {
  try {
    const { id, invitationId } = await context.params;
    assertUuid(id, 'campanya');
    assertUuid(invitationId, 'invitació');
    const ctx = await getServerAuthContext();
    const db = await getDb();
    const invitation = await revokePlayerInvitation(db, ctx, id, invitationId);
    return NextResponse.json({ invitation });
  } catch (error) {
    return handleApiError(error);
  }
}
