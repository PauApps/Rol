import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import {
  buildSessionCookieOptions,
  getServerAuthContext,
  SESSION_COOKIE_NAME,
} from '@/server/auth/session';
import { handleApiError, parseJsonBody } from '@/server/http';
import {
  linkGuestToExistingAccount,
  linkGuestToNewAccount,
} from '@/server/services/identity-linking-service';

export const dynamic = 'force-dynamic';

const linkAccountSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('create'),
    email: z.string().email('Introdueix un correu electrònic vàlid.'),
    displayName: z
      .string()
      .trim()
      .min(2, 'El nom visible ha de tenir almenys 2 caràcters.')
      .max(80)
      .optional(),
    password: z
      .string()
      .min(8, 'La contrasenya ha de tenir almenys 8 caràcters.')
      .max(128),
  }),
  z.object({
    mode: z.literal('existing'),
    email: z.string().email('Introdueix un correu electrònic vàlid.'),
    password: z.string().min(1, 'La contrasenya és obligatòria.'),
  }),
]);

export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBody(request, linkAccountSchema);
    const ctx = await getServerAuthContext();
    const db = await getDb();

    const result =
      body.mode === 'create'
        ? await linkGuestToNewAccount(db, ctx, {
            email: body.email,
            displayName: body.displayName,
            password: body.password,
          })
        : await linkGuestToExistingAccount(db, ctx, {
            email: body.email,
            password: body.password,
          });

    const response = NextResponse.json({
      user: result.user,
      campaignId: result.campaignId,
      memberId: result.memberId,
      merged: result.merged,
    });
    response.cookies.set(
      SESSION_COOKIE_NAME,
      result.rawToken,
      buildSessionCookieOptions(result.expiresAt)
    );
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
