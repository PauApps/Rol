import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { buildSessionCookieOptions, SESSION_COOKIE_NAME } from '@/server/auth/session';
import { handleApiError, parseJsonBody } from '@/server/http';
import { registerGmWithInvitation } from '@/server/services/auth-service';

export const dynamic = 'force-dynamic';

const acceptGmSchema = z.object({
  email: z.string().email('Correu electrònic no vàlid.'),
  displayName: z.string().trim().min(2, 'El nom visible ha de tenir almenys 2 caràcters.').max(80),
  password: z.string().min(8, 'La contrasenya ha de tenir almenys 8 caràcters.').max(128),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const body = await parseJsonBody(request, acceptGmSchema);
    const db = await getDb();
    const result = await registerGmWithInvitation(db, {
      rawToken: token,
      ...body,
    });

    const response = NextResponse.json({ user: result.user }, { status: 201 });
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
