import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/server/auth/session';
import { handleApiError } from '@/server/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ctx = await getServerAuthContext();
    if (!ctx) {
      return NextResponse.json({ authenticated: false, actor: null });
    }

    return NextResponse.json({
      authenticated: true,
      actor:
        ctx.kind === 'user'
          ? { kind: 'user', user: ctx.user }
          : { kind: 'guest', member: ctx.member },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
