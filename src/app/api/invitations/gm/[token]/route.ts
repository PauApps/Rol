import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { handleApiError } from '@/server/http';
import { inspectGmInvitation } from '@/server/services/auth-service';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const db = await getDb();
    const invitation = await inspectGmInvitation(db, token);
    return NextResponse.json({ invitation });
  } catch (error) {
    return handleApiError(error);
  }
}
