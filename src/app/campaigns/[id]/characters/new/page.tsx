import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { AppError } from '@/domain/errors';
import { CharacterCreationWizardClient } from '@/components/characters/creation/CharacterCreationWizardClient';
import { AppShell } from '@/components/layout/AppShell';
import { assertUuid } from '@/server/http';
import { getServerAuthContext } from '@/server/auth/session';
import { getCampaignDetail } from '@/server/services/campaign-service';
import { listCampaignCharacters } from '@/server/services/character-service';

export const dynamic = 'force-dynamic';

export default async function NewCharacterWizardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getServerAuthContext();
  if (!ctx) {
    redirect('/login');
  }

  const { id } = await params;
  const db = await getDb();

  let detail: Awaited<ReturnType<typeof getCampaignDetail>> | null = null;
  let characters: Awaited<ReturnType<typeof listCampaignCharacters>> = [];
  let errorMessage: string | null = null;

  try {
    assertUuid(id, 'campanya');
    detail = await getCampaignDetail(db, ctx, id);
    characters = await listCampaignCharacters(db, ctx, id);
  } catch (error) {
    errorMessage =
      error instanceof AppError
        ? error.message
        : 'No tens permisos o la campanya no està disponible.';
  }

  const actor =
    ctx.kind === 'guest'
      ? {
          kind: 'guest' as const,
          displayName: ctx.member.displayName,
          roleLabel: 'Convidat',
          role: 'guest' as const,
          guestCampaignId: ctx.member.campaignId,
        }
      : {
          kind: 'user' as const,
          displayName: ctx.user.displayName,
          roleLabel:
            ctx.user.role === 'admin'
              ? 'Administrador'
              : ctx.user.role === 'gm'
                ? 'Director de Joc'
                : 'Jugador registrat',
          role: ctx.user.role,
        };

  if (!detail) {
    return (
      <AppShell actor={actor} pageTitle="Creació no disponible">
        <div className="rol-card-surface p-6 space-y-3">
          <p className="text-sm text-[var(--rol-ink-secondary)]">{errorMessage}</p>
          <Link
            href="/"
            className="inline-block text-sm font-medium text-[var(--rol-accent-primary)] underline"
          >
            Tornar a l’inici
          </Link>
        </div>
      </AppShell>
    );
  }

  const myCharacterCount = characters.filter((c) => c.isMine).length;
  const activeMembers = detail.canManage
    ? detail.members
        .filter((m) => m.status === 'active')
        .map((m) => ({ id: m.id, displayName: m.displayName }))
    : [];

  return (
    <AppShell
      actor={actor}
      pageTitle="Assistent de creació de personatge"
      pageSubtitle={`${detail.campaign.name} · ${detail.system?.shortName ?? detail.campaign.systemId}`}
    >
      <CharacterCreationWizardClient
        campaign={{
          id: detail.campaign.id,
          name: detail.campaign.name,
          systemName: detail.system?.shortName ?? detail.campaign.systemId,
          creationConfig: detail.campaign.creationConfig,
          maxCharactersPerPlayer: detail.campaign.maxCharactersPerPlayer,
        }}
        canManage={detail.canManage}
        myCharacterCount={myCharacterCount}
        members={activeMembers}
      />
    </AppShell>
  );
}
