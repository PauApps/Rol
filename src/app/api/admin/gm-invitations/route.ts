import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { getServerAuthContext } from '@/server/auth/session';
import { getPublicOrigin, handleApiError, parseJsonBody } from '@/server/http';
import { createGmInvitation, listGmInvitations } from '@/server/services/admin-service';

export const dynamic = 'force-dynamic';

const createGmInviteSchema = z.object({
  email: z.string().email('Introdueix un correu electrònic vàlid.'),
  note: z.string().max(240).optional(),
});

export async function GET() {
  try {
    const ctx = await getServerAuthContext();
    const db = await getDb();
    const invitations = await listGmInvitations(db, ctx);
    return NextResponse.json({ invitations });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getServerAuthContext();
    const body = await parseJsonBody(request, createGmInviteSchema);
    const db = await getDb();
    const created = await createGmInvitation(db, ctx, body);

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
