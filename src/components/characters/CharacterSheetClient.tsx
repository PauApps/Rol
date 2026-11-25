'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, CheckCircle2, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CharacterGmManageModal } from './CharacterGmManageModal';
import { CharacterHeader } from './CharacterHeader';
import { CharacterTabNav } from './CharacterTabNav';
import { TabPlaceholder } from './TabPlaceholder';
import { CombatStatsTab } from './combat/CombatStatsTab';
import { InventoryTab } from './inventory/InventoryTab';
import { MagicAndAbilitiesTab } from './magic/MagicAndAbilitiesTab';
import { buildCharacterSheetPatch, createDraftFromCharacter } from './sheet-patch';
import { buildSheetAccessContext } from './sheet-permissions';
import type {
  CharacterCampaignContext,
  CharacterSheetDraft,
  CharacterSheetRecord,
  CharacterTabId,
} from './types';

interface CharacterSheetClientProps {
  campaign: CharacterCampaignContext;
  initialCharacter: CharacterSheetRecord;
}

export function CharacterSheetClient({
  campaign,
  initialCharacter,
}: CharacterSheetClientProps) {
  const router = useRouter();
  const [character, setCharacter] = useState<CharacterSheetRecord>(initialCharacter);
  const [draft, setDraft] = useState<CharacterSheetDraft>(() =>
    createDraftFromCharacter(initialCharacter)
  );
  const [activeTab, setActiveTab] = useState<CharacterTabId>('combat');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [gmModalOpen, setGmModalOpen] = useState(false);
  const inFlightRef = useRef(false);

  const access = useMemo(
    () => buildSheetAccessContext(character, campaign.canManage),
    [character, campaign.canManage]
  );

  const builtPatch = useMemo(
    () => buildCharacterSheetPatch(character, draft, access),
    [character, draft, access]
  );

  function handleUpdateDraft(updater: (prev: CharacterSheetDraft) => CharacterSheetDraft) {
    setSaveError(null);
    setSaveSuccess(null);
    setDraft(updater);
  }

  function handleDiscard() {
    setDraft(createDraftFromCharacter(character));
    setSaveError(null);
    setSaveSuccess(null);
  }

  async function handleSave() {
    if (inFlightRef.current || !builtPatch.hasChanges || !access.canEdit) {
      return;
    }

    inFlightRef.current = true;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const response = await fetch(
        `/api/campaigns/${campaign.id}/characters/${character.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(builtPatch.payload),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        setSaveError(data?.error?.message ?? 'No s’han pogut desar els canvis de la fitxa.');
        return;
      }

      const updated = data.character as CharacterSheetRecord & { warnings?: string[] };
      setCharacter(updated);
      setDraft(createDraftFromCharacter(updated));
      setWarnings(Array.isArray(updated.warnings) ? updated.warnings : []);
      setSaveSuccess(`Canvis desats (${builtPatch.changedLabels.join(', ')}).`);
      router.refresh();
    } catch {
      setSaveError('Error de connexió en desar els canvis de la fitxa.');
    } finally {
      inFlightRef.current = false;
      setSaving(false);
    }
  }

  function handleGmModalUpdated(nextCharacter: CharacterSheetRecord) {
    setCharacter(nextCharacter);
    if (!builtPatch.hasChanges) {
      setDraft(createDraftFromCharacter(nextCharacter));
    }
    setSaveSuccess('Permisos o notes del GM actualitzats.');
    router.refresh();
  }

  return (
    <div className="space-y-5 pb-10">
      {/* Navegació de retorn a la campanya */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/campaigns/${campaign.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--rol-ink-secondary)] hover:text-[var(--rol-accent-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rol-accent-gold)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Tornar a {campaign.name}
        </Link>
        <span className="text-xs text-[var(--rol-ink-muted)]">
          Darrera actualització: {new Date(character.updatedAt).toLocaleString('ca-ES')}
        </span>
      </div>

      {/* Capçalera persistent */}
      <CharacterHeader
        character={character}
        campaign={campaign}
        access={access}
        draftName={draft.name}
        onChangeName={(nextName) =>
          handleUpdateDraft((prev) => ({
            ...prev,
            name: nextName,
          }))
        }
        onOpenGmManage={campaign.canManage ? () => setGmModalOpen(true) : undefined}
      />

      {/* Barra d'estat i desament explícit */}
      {(access.canEdit || saveError || saveSuccess || warnings.length > 0) && (
        <div className="rol-card-surface flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            {saveError && (
              <div
                role="alert"
                className="flex items-center gap-2 text-sm font-medium text-[var(--rol-status-danger-ink)]"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            {!saveError && saveSuccess && (
              <div
                role="status"
                className="flex items-center gap-2 text-sm font-medium text-[var(--rol-status-success-ink)]"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{saveSuccess}</span>
              </div>
            )}

            {!saveError && !saveSuccess && builtPatch.hasChanges && (
              <p className="text-xs sm:text-sm text-[var(--rol-status-warning-ink)]">
                Canvis sense desar: <strong>{builtPatch.changedLabels.join(', ')}</strong>.
                Es conserven mentre canvies de pestanya.
              </p>
            )}

            {!saveError && !saveSuccess && !builtPatch.hasChanges && access.canEdit && (
              <p className="text-xs text-[var(--rol-ink-muted)]">
                Fitxa sincronitzada amb el servidor. Els modificadors i bonificacions es recalculen en desar.
              </p>
            )}

            {warnings.length > 0 && (
              <p className="text-xs text-[var(--rol-status-warning-ink)]">
                Avís de campanya: {warnings.join(' · ')}
              </p>
            )}
          </div>

          {access.canEdit && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={!builtPatch.hasChanges || saving}
                onClick={handleDiscard}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Descartar
              </Button>
              <Button
                size="sm"
                disabled={!builtPatch.hasChanges || saving}
                onClick={handleSave}
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Desant…' : 'Desar canvis'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Navegació per les 5 pestanyes */}
      <CharacterTabNav activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Contingut actiu */}
      {activeTab === 'combat' ? (
        <CombatStatsTab
          character={character}
          draft={draft}
          access={access}
          onUpdateDraft={handleUpdateDraft}
        />
      ) : activeTab === 'magic' ? (
        <MagicAndAbilitiesTab
          character={character}
          draft={draft}
          access={access}
          onUpdateDraft={handleUpdateDraft}
        />
      ) : activeTab === 'inventory' ? (
        <InventoryTab
          character={character}
          draft={draft}
          access={access}
          onUpdateDraft={handleUpdateDraft}
        />
      ) : (
        <TabPlaceholder tabId={activeTab} />
      )}

      {/* Modal exclusiu de Director de Joc */}
      {campaign.canManage && gmModalOpen && (
        <CharacterGmManageModal
          key={`${character.id}-${character.updatedAt}`}
          open={gmModalOpen}
          onClose={() => setGmModalOpen(false)}
          campaignId={campaign.id}
          character={character}
          onUpdated={handleGmModalUpdated}
        />
      )}
    </div>
  );
}
