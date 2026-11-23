import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { getServerAuthContext, SESSION_COOKIE_NAME } from '@/server/auth/session';
import { handleApiError } from '@/server/http';
import { logoutSession } from '@/server/services/auth-service';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const ctx = await getServerAuthContext();
    const db = await getDb();
    await logoutSession(db, ctx);

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: new Date(0),
    });
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
