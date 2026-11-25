import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { AppError } from '@/domain/errors';
import { CharacterSheetClient } from '@/components/characters/CharacterSheetClient';
import type { CharacterSheetRecord } from '@/components/characters/types';
import { AppShell } from '@/components/layout/AppShell';
import { assertUuid } from '@/server/http';
import { getServerAuthContext } from '@/server/auth/session';
import { getCampaignDetail } from '@/server/services/campaign-service';
import { getCampaignCharacter } from '@/server/services/character-service';

export const dynamic = 'force-dynamic';

export default async function CharacterSheetPage({
  params,
}: {
  params: Promise<{ id: string; characterId: string }>;
}) {
  const ctx = await getServerAuthContext();
  if (!ctx) {
    redirect('/login');
  }

  const { id, characterId } = await params;
  const db = await getDb();

  let detail: Awaited<ReturnType<typeof getCampaignDetail>> | null = null;
  let character: Awaited<ReturnType<typeof getCampaignCharacter>> | null = null;
  let errorMessage: string | null = null;

  try {
    assertUuid(id, 'campanya');
    assertUuid(characterId, 'personatge');
    detail = await getCampaignDetail(db, ctx, id);
    character = await getCampaignCharacter(db, ctx, id, characterId);
  } catch (error) {
    errorMessage =
      error instanceof AppError
        ? error.message
        : 'No tens permisos o la fitxa del personatge no està disponible.';
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

  if (!detail || !character) {
    return (
      <AppShell actor={actor} pageTitle="Fitxa no disponible">
        <div className="rol-card-surface p-6 space-y-3">
          <p className="text-sm text-[var(--rol-ink-secondary)]">{errorMessage}</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link
              href={`/campaigns/${id}`}
              className="font-medium text-[var(--rol-accent-primary)] underline"
            >
              Tornar a la campanya
            </Link>
            <Link
              href="/"
              className="font-medium text-[var(--rol-ink-secondary)] underline"
            >
              Tornar a l’inici
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const serializedCharacter: CharacterSheetRecord = {
    id: character.id,
    campaignId: character.campaignId,
    memberId: character.memberId,
    ownerDisplayName: character.ownerDisplayName,
    systemId: character.systemId,
    name: character.name,
    schemaVersion: character.schemaVersion,
    sheetData: character.sheetData as CharacterSheetRecord['sheetData'],
    computed: character.computed,
    customFields: character.customFields,
    isMine: character.isMine,
    canEdit: character.canEdit,
    editableFields: character.editableFields,
    authorizedOverrideFields: character.authorizedOverrideFields,
    createdAt: character.createdAt.toISOString(),
    updatedAt: character.updatedAt.toISOString(),
    ...(detail.canManage
      ? {
          gmNotes: 'gmNotes' in character ? character.gmNotes : undefined,
          fieldPermissions:
            'fieldPermissions' in character ? character.fieldPermissions : undefined,
        }
      : {}),
  };

  return (
    <AppShell actor={actor}>
      <CharacterSheetClient
        campaign={{
          id: detail.campaign.id,
          name: detail.campaign.name,
          systemId: detail.campaign.systemId,
          systemName: detail.system?.shortName ?? detail.campaign.systemId,
          virtualDiceEnabled: detail.campaign.virtualDiceEnabled,
          canManage: detail.canManage,
          accessRole: detail.accessRole,
        }}
        initialCharacter={serializedCharacter}
      />
    </AppShell>
  );
}
