'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Compass, Plus, RotateCcw, Trash2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { InputField, SelectField } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { CampaignStatusBadge } from '@/components/ui/StatusBadge';
import type { CampaignStatus } from '@/db/schema';

export interface CampaignSummaryDto {
  id: string;
  name: string;
  description: string;
  systemId: string;
  systemShortName: string;
  status: CampaignStatus;
  roleInCampaign: 'gm' | 'player' | 'guest';
  playerCount: number;
  characterCount: number;
  deletedAt: string | null;
  purgeEligibleAt: string | null;
  updatedAt: string;
}

export interface GameSystemOption {
  id: string;
  name: string;
  shortName: string;
}

interface CampaignsDashboardClientProps {
  isGm: boolean;
  initialTab: 'active' | 'trash';
  activeCampaigns: CampaignSummaryDto[];
  trashedCampaigns: CampaignSummaryDto[];
  systems: GameSystemOption[];
}

export function CampaignsDashboardClient({
  isGm,
  initialTab,
  activeCampaigns,
  trashedCampaigns,
  systems,
}: CampaignsDashboardClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<'active' | 'trash'>(isGm ? initialTab : 'active');
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (isGm) {
      setTab(initialTab);
    }
  }, [initialTab, isGm]);

  function selectTab(nextTab: 'active' | 'trash') {
    setTab(nextTab);
    router.replace(nextTab === 'trash' ? '/campaigns?tab=trash' : '/campaigns');
  }
  const [newName, setNewName] = useState('');
  const [newSystemId, setNewSystemId] = useState(systems[0]?.id ?? 'dnd5e-2014');
  const [purgeTarget, setPurgeTarget] = useState<CampaignSummaryDto | null>(null);
  const [confirmPurgeName, setConfirmPurgeName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleCreateCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          systemId: newSystemId,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error?.message ?? 'No s’ha pogut crear la campanya.');
        return;
      }

      setCreateOpen(false);
      setNewName('');
      router.push(`/campaigns/${data.campaign.id}`);
      router.refresh();
    } catch {
      setError('Error de connexió en crear la campanya.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRestore(campaignId: string) {
    setBusyId(campaignId);
    setError(null);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/restore`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error?.message ?? 'No s’ha pogut recuperar la campanya.');
        return;
      }
      setTab('active');
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handlePurge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!purgeTarget) return;
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch(`/api/campaigns/${purgeTarget.id}/purge`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmName: confirmPurgeName }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error?.message ?? 'No s’ha pogut eliminar definitivament.');
        return;
      }
      setPurgeTarget(null);
      setConfirmPurgeName('');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-[var(--rol-radius-md)] border border-[var(--rol-status-danger-border)] bg-[var(--rol-status-danger-bg)] px-4 py-3 text-sm text-[var(--rol-status-danger-ink)]"
        >
          {error}
        </div>
      )}

      {isGm && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)] p-1">
            <button
              type="button"
              onClick={() => selectTab('active')}
              className={`rounded-[var(--rol-radius-sm)] px-3.5 py-1.5 text-sm font-medium cursor-pointer ${
                tab === 'active'
                  ? 'bg-[var(--rol-bg-surface)] text-[var(--rol-ink-primary)] shadow-sm border border-[var(--rol-border-strong)]'
                  : 'text-[var(--rol-ink-secondary)]'
              }`}
            >
              Campanyes ({activeCampaigns.length})
            </button>
            <button
              type="button"
              onClick={() => selectTab('trash')}
              className={`rounded-[var(--rol-radius-sm)] px-3.5 py-1.5 text-sm font-medium cursor-pointer ${
                tab === 'trash'
                  ? 'bg-[var(--rol-bg-surface)] text-[var(--rol-ink-primary)] shadow-sm border border-[var(--rol-border-strong)]'
                  : 'text-[var(--rol-ink-secondary)]'
              }`}
            >
              Paperera 30 dies ({trashedCampaigns.length})
            </button>
          </div>

          {activeCampaigns.length > 0 && (
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Nova campanya
            </Button>
          )}
        </div>
      )}

      {tab === 'active' ? (
        activeCampaigns.length === 0 ? (
          <EmptyState
            icon={<Compass className="h-7 w-7" />}
            title={
              isGm
                ? 'Encara no has creat cap campanya'
                : 'Encara no participes en cap campanya'
            }
            description={
              isGm
                ? 'Comença en segons indicant només el nom de la campanya i el sistema de rol. La resta de detalls els configuraràs després.'
                : 'Quan un Director de Joc t’enviï una invitació individual, la campanya apareixerà aquí.'
            }
            action={
              isGm ? (
                <Button type="button" size="lg" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-5 w-5" />
                  Crear la primera campanya
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeCampaigns.map((c) => (
              <Link key={c.id} href={`/campaigns/${c.id}`} className="group block">
                <Card className="h-full transition-colors group-hover:border-[var(--rol-accent-gold)]">
                  <div className="flex items-start justify-between gap-2">
                    <Badge tone="gold">{c.systemShortName}</Badge>
                    <CampaignStatusBadge status={c.status} />
                  </div>
                  <h3 className="rol-heading-flourish mt-3 text-xl font-semibold text-[var(--rol-ink-primary)] group-hover:text-[var(--rol-accent-primary)]">
                    {c.name}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-sm text-[var(--rol-ink-secondary)]">
                    {c.description || 'Sense descripció encara.'}
                  </p>
                  <div className="mt-5 flex items-center justify-between border-t border-[var(--rol-border-subtle)] pt-3 text-xs text-[var(--rol-ink-muted)]">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> {c.playerCount} jugadors
                    </span>
                    <span>{c.characterCount} personatges</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )
      ) : trashedCampaigns.length === 0 ? (
        <EmptyState
          icon={<Trash2 className="h-7 w-7" />}
          title="La paperera és buida"
          description="Les campanyes eliminades es conserven aquí durant 30 dies abans de poder-se eliminar definitivament."
        />
      ) : (
        <div className="space-y-3">
          {trashedCampaigns.map((c) => {
            const purgeDate = c.purgeEligibleAt
              ? new Date(c.purgeEligibleAt).toLocaleDateString('ca-ES')
              : '';
            return (
              <Card key={c.id}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="rol-heading-flourish text-lg font-semibold">{c.name}</h3>
                      <Badge tone="gold">{c.systemShortName}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-[var(--rol-ink-secondary)]">
                      A la paperera des del{' '}
                      {c.deletedAt ? new Date(c.deletedAt).toLocaleDateString('ca-ES') : ''} ·
                      Recuperable fins al {purgeDate}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busyId === c.id}
                      onClick={() => handleRestore(c.id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Recuperar
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setPurgeTarget(c);
                        setConfirmPurgeName('');
                        setError(null);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Eliminar definitivament
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de creació ràpida (nom + sistema únicament) */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Crear una nova campanya"
        description="Només cal el nom i el sistema de rol. La resta es configura dins del panell."
      >
        <form onSubmit={handleCreateCampaign} className="space-y-4">
          <InputField
            label="Nom de la campanya"
            htmlFor="create-campaign-name"
            type="text"
            required
            minLength={2}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ex. Les Cròniques de Phandalin"
          />

          <SelectField
            label="Sistema de rol"
            htmlFor="create-campaign-system"
            value={newSystemId}
            onChange={(e) => setNewSystemId(e.target.value)}
          >
            {systems.map((sys) => (
              <option key={sys.id} value={sys.id}>
                {sys.name}
              </option>
            ))}
          </SelectField>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel·lar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creant…' : 'Crear campanya'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal d'eliminació definitiva amb confirmació explícita */}
      <Modal
        open={Boolean(purgeTarget)}
        onClose={() => setPurgeTarget(null)}
        title="Eliminar campanya definitivament"
        description="Aquesta acció és irreversible i esborrarà totes les dades, invitacions i personatges associats."
      >
        {purgeTarget && (
          <form onSubmit={handlePurge} className="space-y-4">
            <InputField
              label={`Escriu "${purgeTarget.name}" per confirmar`}
              htmlFor="purge-confirm-name"
              type="text"
              required
              value={confirmPurgeName}
              onChange={(e) => setConfirmPurgeName(e.target.value)}
              placeholder={purgeTarget.name}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setPurgeTarget(null)}>
                Cancel·lar
              </Button>
              <Button
                type="submit"
                variant="danger"
                disabled={submitting || confirmPurgeName.trim() !== purgeTarget.name.trim()}
              >
                {submitting ? 'Eliminant…' : 'Eliminar definitivament'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
