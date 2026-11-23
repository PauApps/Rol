import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { getServerAuthContext } from '@/server/auth/session';
import { assertUuid, handleApiError, parseJsonBody } from '@/server/http';
import { purgeCampaign } from '@/server/services/campaign-service';

export const dynamic = 'force-dynamic';

const purgeSchema = z.object({
  confirmName: z.string().min(1, 'Cal escriure el nom exacte de la campanya per confirmar.'),
});

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    assertUuid(id, 'campanya');
    const body = await parseJsonBody(request, purgeSchema);
    const ctx = await getServerAuthContext();
    const db = await getDb();
    const result = await purgeCampaign(db, ctx, id, body.confirmName);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
