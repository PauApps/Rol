import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { AppShell } from '@/components/layout/AppShell';
import { CampaignsDashboardClient } from '@/components/campaigns/CampaignsDashboardClient';
import { getServerAuthContext } from '@/server/auth/session';
import {
  listCampaignsForActor,
  listGameSystems,
} from '@/server/services/campaign-service';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const ctx = await getServerAuthContext();
  if (!ctx) {
    redirect('/login');
  }

  if (ctx.kind === 'guest') {
    redirect(`/campaigns/${ctx.member.campaignId}`);
  }

  if (ctx.user.role === 'admin') {
    redirect('/admin');
  }

  const resolvedSearch = await searchParams;
  const isGm = ctx.user.role === 'gm';
  const initialTab = resolvedSearch.tab === 'trash' && isGm ? 'trash' : 'active';

  const db = await getDb();
  const [activeCampaigns, trashedCampaigns, systems] = await Promise.all([
    listCampaignsForActor(db, ctx, { includeTrash: false }),
    isGm ? listCampaignsForActor(db, ctx, { includeTrash: true }) : Promise.resolve([]),
    listGameSystems(db),
  ]);

  const serialize = (items: typeof activeCampaigns) =>
    items.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      systemId: c.systemId,
      systemShortName: c.systemShortName,
      status: c.status,
      roleInCampaign: c.roleInCampaign,
      playerCount: c.playerCount,
      characterCount: c.characterCount,
      deletedAt: c.deletedAt ? c.deletedAt.toISOString() : null,
      purgeEligibleAt: c.purgeEligibleAt ? c.purgeEligibleAt.toISOString() : null,
      updatedAt: c.updatedAt.toISOString(),
    }));

  return (
    <AppShell
      actor={{
        kind: 'user',
        displayName: ctx.user.displayName,
        roleLabel: isGm ? 'Director de Joc' : 'Jugador registrat',
        role: ctx.user.role === 'gm' ? 'gm' : 'player',
      }}
      pageTitle={isGm ? 'Les meves campanyes' : 'Campanyes on participo'}
      pageSubtitle={
        isGm
          ? 'Organitza les teves taules presencials, jugadors i fitxes.'
          : 'Consulta les campanyes actives on tens accés.'
      }
    >
      <CampaignsDashboardClient
        isGm={isGm}
        initialTab={initialTab}
        activeCampaigns={serialize(activeCampaigns)}
        trashedCampaigns={serialize(trashedCampaigns)}
        systems={systems.map((s) => ({ id: s.id, name: s.name, shortName: s.shortName }))}
      />
    </AppShell>
  );
}
