'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  KeyRound,
  Link2,
  ShieldBan,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CopyLinkBox } from '@/components/ui/CopyLinkBox';
import { InputField, SelectField, TextareaField } from '@/components/ui/Field';
import { CampaignStatusBadge, MemberStatusBadge } from '@/components/ui/StatusBadge';
import type { CampaignStatus, MemberStatus, MemberType, PlayerInvitationKind } from '@/db/schema';

export interface CampaignDetailMemberDto {
  id: string;
  displayName: string;
  memberType: MemberType;
  status: MemberStatus;
  joinedAt: string;
}

export interface CampaignDetailInvitationDto {
  id: string;
  kind: PlayerInvitationKind;
  targetMemberId: string | null;
  label: string;
  usedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CampaignActivityDto {
  id: string;
  action: string;
  targetType: string;
  createdAt: string;
}

export interface CampaignCharacterDto {
  id: string;
  name: string;
  systemId: string;
  memberId: string | null;
  createdAt: string;
}

export interface CampaignDetailViewProps {
  canManage: boolean;
  accessRole: 'gm' | 'player' | 'guest';
  campaign: {
    id: string;
    name: string;
    description: string;
    systemId: string;
    status: CampaignStatus;
  };
  system: {
    id: string;
    name: string;
    shortName: string;
  };
  stats: {
    playerCount: number;
    characterCount: number;
  };
  recentActivity: CampaignActivityDto[];
  members?: CampaignDetailMemberDto[];
  invitations?: CampaignDetailInvitationDto[];
  currentMember: CampaignDetailMemberDto | null;
  characters: CampaignCharacterDto[];
}

export function CampaignDetailClient({
  canManage,
  campaign,
  system,
  stats,
  recentActivity,
  members = [],
  invitations = [],
  currentMember,
  characters,
}: CampaignDetailViewProps) {
  const router = useRouter();
  const [name, setName] = useState(campaign.name);
  const [description, setDescription] = useState(campaign.description);
  const [status, setStatus] = useState<CampaignStatus>(campaign.status);
  const [inviteLabel, setInviteLabel] = useState('');
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [generatedInviteNotice, setGeneratedInviteNotice] = useState<string>('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleSaveCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaveMessage(null);
    setSaving(true);
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, status }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error?.message ?? 'No s’han pogut desar els canvis.');
        return;
      }
      setSaveMessage('Canvis desats correctament.');
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleMoveToTrash() {
    setBusyId('trash');
    setError(null);
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/trash`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error?.message ?? 'No s’ha pogut enviar la campanya a la paperera.');
        return;
      }
      router.push('/campaigns?tab=trash');
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreatePlayerInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setGeneratedInviteUrl(null);
    setBusyId('new-invite');

    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: inviteLabel }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error?.message ?? 'No s’ha pogut generar la invitació.');
        return;
      }
      setGeneratedInviteUrl(data.inviteUrl);
      setGeneratedInviteNotice(
        'Enllaç individual sense caducitat automàtica. Només es pot fer servir una vegada i el pots revocar en qualsevol moment.'
      );
      setInviteLabel('');
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevokeInvitation(invitationId: string) {
    setBusyId(invitationId);
    setError(null);
    try {
      const response = await fetch(
        `/api/campaigns/${campaign.id}/invitations/${invitationId}/revoke`,
        { method: 'POST' }
      );
      if (!response.ok) {
        const data = await response.json();
        setError(data?.error?.message ?? 'No s’ha pogut revocar la invitació.');
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleGenerateRecovery(memberId: string, displayName: string) {
    setBusyId(`recover-${memberId}`);
    setError(null);
    setGeneratedInviteUrl(null);
    try {
      const response = await fetch(
        `/api/campaigns/${campaign.id}/members/${memberId}/recovery-link`,
        { method: 'POST' }
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error?.message ?? 'No s’ha pogut generar l’enllaç de recuperació.');
        return;
      }
      setGeneratedInviteUrl(data.inviteUrl);
      setGeneratedInviteNotice(
        `Enllaç exclusiu per recuperar el convidat "${displayName}". Qualsevol sessió perduda prèvia quedarà revocada en obrir-lo.`
      );
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevokeMember(memberId: string) {
    setBusyId(`revoke-${memberId}`);
    setError(null);
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/members/${memberId}/revoke`, {
        method: 'POST',
      });
      if (!response.ok) {
        const data = await response.json();
        setError(data?.error?.message ?? 'No s’ha pogut revocar el jugador.');
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
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

      {/* Indicadors principals de campanya (DOCUMENT_MESTRE.md §4.4) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--rol-ink-muted)]">Estat</p>
          <div className="mt-2">
            <CampaignStatusBadge status={campaign.status} />
          </div>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--rol-ink-muted)]">Sistema</p>
          <p className="mt-1.5 font-semibold text-[var(--rol-ink-primary)]">{system.shortName}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--rol-ink-muted)]">
            Jugadors actius
          </p>
          <p className="rol-heading-flourish mt-1 text-2xl font-bold">{stats.playerCount}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--rol-ink-muted)]">Personatges</p>
          <p className="rol-heading-flourish mt-1 text-2xl font-bold">{stats.characterCount}</p>
        </Card>
      </div>

      {/* Resum per a jugador / convidat */}
      {!canManage && currentMember && (
        <Card
          title="La teva participació"
          subtitle="Informació del teu accés a aquesta campanya."
        >
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              Nom a la taula: <strong>{currentMember.displayName}</strong>
            </span>
            <Badge tone="gold">
              {currentMember.memberType === 'guest' ? 'Convidat' : 'Compte registrat'}
            </Badge>
            <MemberStatusBadge status={currentMember.status} />
          </div>
        </Card>
      )}

      {/* Gestió de campanya i invitacions (només GM) */}
      {canManage && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card
            title="Configuració general"
            subtitle="Canvia el títol, descripció o estat de la campanya."
          >
            <form onSubmit={handleSaveCampaign} className="space-y-4">
              <InputField
                label="Nom de la campanya"
                htmlFor="camp-edit-name"
                type="text"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <SelectField
                label="Estat"
                htmlFor="camp-edit-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as CampaignStatus)}
              >
                <option value="active">Activa</option>
                <option value="paused">Pausada</option>
                <option value="finished">Finalitzada</option>
              </SelectField>
              <TextareaField
                label="Descripció"
                htmlFor="camp-edit-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Notes generals de l’ambientació o horari de partida…"
              />
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Desant…' : 'Desar canvis'}
                  </Button>
                  {saveMessage && (
                    <span className="text-xs font-medium text-[var(--rol-status-success-ink)]">
                      {saveMessage}
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={busyId === 'trash'}
                  onClick={handleMoveToTrash}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Enviar a la paperera (30 dies)
                </Button>
              </div>
            </form>
          </Card>

          <Card
            title="Invitacions de jugadors"
            subtitle="Enllaços individuals sense caducitat automàtica."
          >
            <form onSubmit={handleCreatePlayerInvite} className="space-y-3">
              <InputField
                label="Etiqueta per identificar el jugador (opcional)"
                htmlFor="invite-player-label"
                type="text"
                value={inviteLabel}
                onChange={(e) => setInviteLabel(e.target.value)}
                placeholder="Ex. Laia — Maga elfa"
              />
              <Button type="submit" disabled={busyId === 'new-invite'}>
                <UserPlus className="h-4 w-4" />
                {busyId === 'new-invite' ? 'Generant…' : 'Generar invitació individual'}
              </Button>
            </form>

            {generatedInviteUrl && (
              <div className="mt-4">
                <CopyLinkBox
                  label="Enllaç preparat per compartir"
                  url={generatedInviteUrl}
                  notice={generatedInviteNotice}
                />
              </div>
            )}

            <div className="mt-5 space-y-2 max-h-60 overflow-y-auto pr-1">
              {invitations.length === 0 ? (
                <p className="text-xs text-[var(--rol-ink-muted)]">
                  Cap invitació generada encara.
                </p>
              ) : (
                invitations.map((inv) => {
                  const statusBadge = inv.revokedAt ? (
                    <Badge tone="danger">Revocada</Badge>
                  ) : inv.usedAt ? (
                    <Badge tone="success">Acceptada</Badge>
                  ) : (
                    <Badge tone="warning">Pendent</Badge>
                  );

                  return (
                    <div
                      key={inv.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/50 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[var(--rol-ink-primary)]">
                          {inv.label || 'Invitació sense etiqueta'}
                        </p>
                        <p className="text-[var(--rol-ink-muted)]">
                          {inv.kind === 'recovery' ? 'Recuperació · ' : 'Nou jugador · '}
                          {new Date(inv.createdAt).toLocaleDateString('ca-ES')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {statusBadge}
                        {!inv.usedAt && !inv.revokedAt && (
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={busyId === inv.id}
                            onClick={() => handleRevokeInvitation(inv.id)}
                          >
                            Revocar
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Llista de jugadors (només GM) */}
      {canManage && (
        <Card
          title="Jugadors de la campanya"
          subtitle="Genera un nou enllaç d’accés si un convidat ha perdut el seu dispositiu."
        >
          {members.length === 0 ? (
            <p className="text-sm text-[var(--rol-ink-muted)]">
              Encara no hi ha jugadors vinculats a aquesta campanya.
            </p>
          ) : (
            <div className="space-y-2.5">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/40 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Users className="h-4 w-4 text-[var(--rol-ink-muted)]" />
                    <span className="font-medium">{m.displayName}</span>
                    <Badge tone="gold">
                      {m.memberType === 'guest' ? 'Convidat' : 'Compte registrat'}
                    </Badge>
                    <MemberStatusBadge status={m.status} />
                  </div>

                  {m.status === 'active' && (
                    <div className="flex flex-wrap gap-2">
                      {m.memberType === 'guest' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busyId === `recover-${m.id}`}
                          onClick={() => handleGenerateRecovery(m.id, m.displayName)}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          Nou enllaç d’accés
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busyId === `revoke-${m.id}`}
                        onClick={() => handleRevokeMember(m.id)}
                      >
                        <ShieldBan className="h-3.5 w-3.5" />
                        Revocar accés
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Secció de personatges (base preparada per a Fase 3) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Personatges (Base D&D 5e 2014)"
          subtitle="Model de dades preparat; fitxes i càlculs previstos a la Fase 3."
          actions={<Badge tone="neutral">En preparació — Fase 3</Badge>}
        >
          <p className="text-sm text-[var(--rol-ink-secondary)]">
            El repositori de dades ja inclou l’estructura modular per a personatges de{' '}
            <strong>{system.name}</strong> i el registre de revisions sense càlculs improvisats.
          </p>
          {characters.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm">
              {characters.map((ch) => (
                <li
                  key={ch.id}
                  className="flex items-center justify-between rounded border border-[var(--rol-border-subtle)] px-3 py-1.5"
                >
                  <span className="font-medium">{ch.name}</span>
                  <span className="text-xs text-[var(--rol-ink-muted)]">{ch.systemId}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Activitat recent"
          subtitle="Registre d’esdeveniments d’aquesta campanya."
          actions={<Activity className="h-4 w-4 text-[var(--rol-ink-muted)]" />}
        >
          {recentActivity.length === 0 ? (
            <p className="text-sm text-[var(--rol-ink-muted)]">Sense activitat registrada.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {recentActivity.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/40 px-3 py-2"
                >
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Link2 className="h-3 w-3 text-[var(--rol-accent-gold)]" />
                    {item.action}
                  </span>
                  <span className="text-[var(--rol-ink-muted)]">
                    {new Date(item.createdAt).toLocaleString('ca-ES')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
