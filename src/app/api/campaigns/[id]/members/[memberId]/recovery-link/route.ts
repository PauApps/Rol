import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { getServerAuthContext } from '@/server/auth/session';
import { assertUuid, getPublicOrigin, handleApiError } from '@/server/http';
import { createMemberRecoveryLink } from '@/server/services/player-invitation-service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await context.params;
    assertUuid(id, 'campanya');
    assertUuid(memberId, 'jugador');
    const ctx = await getServerAuthContext();
    const db = await getDb();
    const created = await createMemberRecoveryLink(db, ctx, id, memberId);

    return NextResponse.json(
      {
        invitation: created.invitation,
        invitePath: created.invitePath,
        inviteUrl: `${getPublicOrigin(request)}${created.invitePath}`,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
