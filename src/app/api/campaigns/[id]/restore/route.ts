import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { getServerAuthContext } from '@/server/auth/session';
import { assertUuid, handleApiError } from '@/server/http';
import { restoreCampaign } from '@/server/services/campaign-service';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    assertUuid(id, 'campanya');
    const ctx = await getServerAuthContext();
    const db = await getDb();
    const campaign = await restoreCampaign(db, ctx, id);
    return NextResponse.json({ campaign });
  } catch (error) {
    return handleApiError(error);
  }
}
