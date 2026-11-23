import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { assertAuthenticated } from '@/server/auth/policies';
import { getServerAuthContext } from '@/server/auth/session';
import { handleApiError, parseJsonBody } from '@/server/http';
import { createCampaign, listCampaignsForActor } from '@/server/services/campaign-service';

export const dynamic = 'force-dynamic';

const createCampaignSchema = z.object({
  name: z.string().trim().min(2, 'El nom de la campanya ha de tenir almenys 2 caràcters.').max(120),
  systemId: z.string().trim().min(1, 'Has de seleccionar un sistema de rol.'),
});

export async function GET(request: NextRequest) {
  try {
    const ctx = assertAuthenticated(await getServerAuthContext());
    const includeTrash = request.nextUrl.searchParams.get('trash') === '1';
    const db = await getDb();
    const campaigns = await listCampaignsForActor(db, ctx, { includeTrash });
    return NextResponse.json({ campaigns });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getServerAuthContext();
    const body = await parseJsonBody(request, createCampaignSchema);
    const db = await getDb();
    const campaign = await createCampaign(db, ctx, body);
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
