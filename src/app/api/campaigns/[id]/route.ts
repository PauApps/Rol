import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { getServerAuthContext } from '@/server/auth/session';
import { assertUuid, handleApiError, parseJsonBody } from '@/server/http';
import { getCampaignDetail, updateCampaign } from '@/server/services/campaign-service';

export const dynamic = 'force-dynamic';

const updateCampaignSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['active', 'paused', 'finished']).optional(),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    assertUuid(id, 'campanya');
    const ctx = await getServerAuthContext();
    const db = await getDb();
    const detail = await getCampaignDetail(db, ctx, id);
    return NextResponse.json(detail);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    assertUuid(id, 'campanya');
    const body = await parseJsonBody(request, updateCampaignSchema);
    const ctx = await getServerAuthContext();
    const db = await getDb();
    const campaign = await updateCampaign(db, ctx, id, body);
    return NextResponse.json({ campaign });
  } catch (error) {
    return handleApiError(error);
  }
}
