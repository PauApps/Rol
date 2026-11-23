import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { AppError } from '@/domain/errors';
import { AppShell } from '@/components/layout/AppShell';
import { CampaignDetailClient } from '@/components/campaigns/CampaignDetailClient';
import { assertUuid } from '@/server/http';
import { getServerAuthContext } from '@/server/auth/session';
import { getCampaignDetail } from '@/server/services/campaign-service';
import { listCampaignCharacters } from '@/server/services/character-service';

export const dynamic = 'force-dynamic';

export default async function CampaignDetailPage({
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
      <AppShell actor={actor} pageTitle="Accés restringit">
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

  return (
    <AppShell
      actor={actor}
      pageTitle={detail.campaign.name}
      pageSubtitle={
        detail.campaign.description ||
        `Panell de campanya · ${detail.system?.name ?? detail.campaign.systemId}`
      }
    >
      <CampaignDetailClient
        canManage={detail.canManage}
        accessRole={detail.accessRole}
        campaign={{
          id: detail.campaign.id,
          name: detail.campaign.name,
          description: detail.campaign.description,
          systemId: detail.campaign.systemId,
          status: detail.campaign.status,
          creationConfig: detail.campaign.creationConfig,
          maxCharactersPerPlayer: detail.campaign.maxCharactersPerPlayer,
          virtualDiceEnabled: detail.campaign.virtualDiceEnabled,
        }}
        system={{
          id: detail.system?.id ?? detail.campaign.systemId,
          name: detail.system?.name ?? detail.campaign.systemId,
          shortName: detail.system?.shortName ?? detail.campaign.systemId,
        }}
        stats={detail.stats}
        recentActivity={detail.recentActivity.map((item) => ({
          id: item.id,
          action: item.action,
          targetType: item.targetType,
          createdAt: item.createdAt.toISOString(),
        }))}
        members={
          detail.canManage
            ? detail.members.map((m) => ({
                id: m.id,
                displayName: m.displayName,
                memberType: m.memberType,
                status: m.status,
                joinedAt: m.joinedAt.toISOString(),
              }))
            : undefined
        }
        invitations={
          detail.canManage
            ? detail.invitations.map((inv) => ({
                id: inv.id,
                kind: inv.kind,
                targetMemberId: inv.targetMemberId,
                label: inv.label,
                usedAt: inv.usedAt ? inv.usedAt.toISOString() : null,
                revokedAt: inv.revokedAt ? inv.revokedAt.toISOString() : null,
                createdAt: inv.createdAt.toISOString(),
              }))
            : undefined
        }
        currentMember={
          detail.currentMember
            ? {
                id: detail.currentMember.id,
                displayName: detail.currentMember.displayName,
                memberType: detail.currentMember.memberType,
                status: detail.currentMember.status,
                joinedAt: detail.currentMember.joinedAt.toISOString(),
              }
            : null
        }
        characters={characters.map((ch) => ({
          id: ch.id,
          name: ch.name,
          systemId: ch.systemId,
          memberId: ch.memberId,
          ownerDisplayName: ch.ownerDisplayName,
          isMine: ch.isMine,
          canEdit: ch.canEdit,
          createdAt: ch.createdAt.toISOString(),
        }))}
      />
    </AppShell>
  );
}
