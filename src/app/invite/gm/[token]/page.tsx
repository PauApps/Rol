import Link from 'next/link';
import { getDb } from '@/db';
import { AppError } from '@/domain/errors';
import { inspectGmInvitation } from '@/server/services/auth-service';
import { GmInviteAcceptClient } from '@/components/auth/GmInviteAcceptClient';

export const dynamic = 'force-dynamic';

export default async function GmInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = await getDb();

  let invitation: Awaited<ReturnType<typeof inspectGmInvitation>> | null = null;
  let errorMessage: string | null = null;

  try {
    invitation = await inspectGmInvitation(db, token);
  } catch (error) {
    errorMessage =
      error instanceof AppError
        ? error.message
        : 'No s’ha pogut validar aquesta invitació de GM.';
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      {invitation ? (
        <GmInviteAcceptClient
          token={token}
          invitedEmail={invitation.email}
          note={invitation.note}
        />
      ) : (
        <div className="rol-card-surface w-full max-w-md p-6 text-center space-y-4">
          <h1 className="rol-heading-flourish text-2xl font-bold">Invitació no disponible</h1>
          <p className="text-sm text-[var(--rol-ink-secondary)]">{errorMessage}</p>
          <Link
            href="/login"
            className="inline-block text-sm font-medium text-[var(--rol-accent-primary)] underline"
          >
            Tornar a l’inici de sessió
          </Link>
        </div>
      )}
    </main>
  );
}
