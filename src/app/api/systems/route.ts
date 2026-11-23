import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { handleApiError } from '@/server/http';
import { listGameSystems } from '@/server/services/campaign-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getDb();
    const systems = await listGameSystems(db);
    return NextResponse.json({ systems });
  } catch (error) {
    return handleApiError(error);
  }
}
