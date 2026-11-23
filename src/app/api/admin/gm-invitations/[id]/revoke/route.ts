import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { getServerAuthContext } from '@/server/auth/session';
import { assertUuid, handleApiError } from '@/server/http';
import { revokeGmInvitation } from '@/server/services/admin-service';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    assertUuid(id, 'invitació');
    const ctx = await getServerAuthContext();
    const db = await getDb();
    const invitation = await revokeGmInvitation(db, ctx, id);
    return NextResponse.json({ invitation });
  } catch (error) {
    return handleApiError(error);
  }
}
