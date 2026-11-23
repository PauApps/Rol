import { NextRequest, NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { AppError, badRequest } from '@/domain/errors';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertUuid(value: string, fieldLabel = 'identificador'): string {
  if (!UUID_REGEX.test(value)) {
    throw badRequest('INVALID_UUID', `Format d’${fieldLabel} no vàlid.`);
  }
  return value;
}

export async function parseJsonBody<TSchema extends z.ZodTypeAny>(
  request: NextRequest,
  schema: TSchema
): Promise<z.infer<TSchema>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw badRequest('INVALID_JSON', 'El cos de la petició no és un JSON vàlid.');
  }

  return schema.parse(raw);
}

export function getPublicOrigin(request: NextRequest): string {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  return request.nextUrl.origin;
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues[0]?.message ?? 'Les dades enviades no són vàlides.',
          details: error.issues,
        },
      },
      { status: 400 }
    );
  }

  console.error('Unhandled API error:', error);
  return NextResponse.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'S’ha produït un error intern al servidor.',
      },
    },
    { status: 500 }
  );
}
