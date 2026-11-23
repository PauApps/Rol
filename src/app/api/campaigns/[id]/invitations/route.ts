import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { getServerAuthContext } from '@/server/auth/session';
import { assertUuid, getPublicOrigin, handleApiError, parseJsonBody } from '@/server/http';
import { createPlayerInvitation } from '@/server/services/player-invitation-service';

export const dynamic = 'force-dynamic';

const createInviteSchema = z.object({
  label: z.string().max(120).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    assertUuid(id, 'campanya');
    const body = await parseJsonBody(request, createInviteSchema);
    const ctx = await getServerAuthContext();
    const db = await getDb();
    const created = await createPlayerInvitation(db, ctx, id, body);

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
