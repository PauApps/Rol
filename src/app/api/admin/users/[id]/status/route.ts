import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { getServerAuthContext } from '@/server/auth/session';
import { assertUuid, handleApiError, parseJsonBody } from '@/server/http';
import { updateUserStatus } from '@/server/services/admin-service';

export const dynamic = 'force-dynamic';

const statusSchema = z.object({
  status: z.enum(['active', 'blocked', 'disabled']),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    assertUuid(id, 'usuari');
    const body = await parseJsonBody(request, statusSchema);
    const ctx = await getServerAuthContext();
    const db = await getDb();
    const user = await updateUserStatus(db, ctx, id, body.status);
    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
