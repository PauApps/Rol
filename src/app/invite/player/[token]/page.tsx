import Link from 'next/link';
import { getDb } from '@/db';
import { AppError } from '@/domain/errors';
import { inspectPlayerInvitation } from '@/server/services/player-invitation-service';
import { PlayerInviteAcceptClient } from '@/components/auth/PlayerInviteAcceptClient';

export const dynamic = 'force-dynamic';

export default async function PlayerInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = await getDb();

  let invitation: Awaited<ReturnType<typeof inspectPlayerInvitation>> | null = null;
  let errorMessage: string | null = null;

  try {
    invitation = await inspectPlayerInvitation(db, token);
  } catch (error) {
    errorMessage =
      error instanceof AppError
        ? error.message
        : 'No s’ha pogut validar aquesta invitació.';
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      {invitation ? (
        <PlayerInviteAcceptClient
          token={token}
          kind={invitation.kind}
          campaignId={invitation.campaignId}
          campaignName={invitation.campaignName}
          systemName={invitation.systemName}
          label={invitation.label}
          targetDisplayName={invitation.targetDisplayName}
        />
      ) : (
        <div className="rol-card-surface w-full max-w-md p-6 text-center space-y-4">
          <h1 className="rol-heading-flourish text-2xl font-bold">Enllaç no disponible</h1>
          <p className="text-sm text-[var(--rol-ink-secondary)]">{errorMessage}</p>
          <Link
            href="/login"
            className="inline-block text-sm font-medium text-[var(--rol-accent-primary)] underline"
          >
            Anar a l’inici de sessió
          </Link>
        </div>
      )}
    </main>
  );
}
