import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { buildSessionCookieOptions, SESSION_COOKIE_NAME } from '@/server/auth/session';
import { handleApiError, parseJsonBody } from '@/server/http';
import { acceptPlayerInvitation } from '@/server/services/player-invitation-service';

export const dynamic = 'force-dynamic';

const acceptPlayerInviteSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('guest'),
    displayName: z.string().trim().min(2, 'L’àlies ha de tenir almenys 2 caràcters.').max(80),
  }),
  z.object({
    mode: z.literal('register'),
    email: z.string().email('Correu electrònic no vàlid.'),
    displayName: z.string().trim().min(2, 'El nom visible ha de tenir almenys 2 caràcters.').max(80),
    password: z.string().min(8, 'La contrasenya ha de tenir almenys 8 caràcters.').max(128),
  }),
  z.object({
    mode: z.literal('login'),
    email: z.string().email('Correu electrònic no vàlid.'),
    password: z.string().min(1, 'La contrasenya és obligatòria.'),
  }),
  z.object({
    mode: z.literal('recover'),
  }),
]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const body = await parseJsonBody(request, acceptPlayerInviteSchema);
    const db = await getDb();
    const result = await acceptPlayerInvitation(db, token, body);

    const response = NextResponse.json(
      {
        campaignId: result.campaignId,
        memberId: result.memberId,
        accessType: result.accessType,
      },
      { status: 201 }
    );
    response.cookies.set(
      SESSION_COOKIE_NAME,
      result.rawToken,
      buildSessionCookieOptions(result.expiresAt)
    );
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
