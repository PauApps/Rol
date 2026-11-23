import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { getServerAuthContext } from '@/server/auth/session';
import { handleApiError } from '@/server/http';
import { listUsers } from '@/server/services/admin-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ctx = await getServerAuthContext();
    const db = await getDb();
    const users = await listUsers(db, ctx);
    return NextResponse.json({ users });
  } catch (error) {
    return handleApiError(error);
  }
}
