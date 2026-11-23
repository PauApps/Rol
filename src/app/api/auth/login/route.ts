import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { buildSessionCookieOptions, SESSION_COOKIE_NAME } from '@/server/auth/session';
import { handleApiError, parseJsonBody } from '@/server/http';
import { loginWithPassword } from '@/server/services/auth-service';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().email('Introdueix un correu electrònic vàlid.'),
  password: z.string().min(1, 'La contrasenya és obligatòria.'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBody(request, loginSchema);
    const db = await getDb();
    const result = await loginWithPassword(db, body);

    const response = NextResponse.json({ user: result.user });
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
