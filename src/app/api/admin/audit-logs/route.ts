import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { getServerAuthContext } from '@/server/auth/session';
import { handleApiError } from '@/server/http';
import { listAuditLogs } from '@/server/services/admin-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const ctx = await getServerAuthContext();
    const db = await getDb();
    const rawLimit = Number(request.nextUrl.searchParams.get('limit') ?? '40');
    const logs = await listAuditLogs(db, ctx, Number.isFinite(rawLimit) ? rawLimit : 40);
    return NextResponse.json({ logs });
  } catch (error) {
    return handleApiError(error);
  }
}
