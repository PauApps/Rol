'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Eye,
  KeyRound,
  Link2,
  Pencil,
  Plus,
  ShieldBan,
  SlidersHorizontal,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CopyLinkBox } from '@/components/ui/CopyLinkBox';
import { InputField, SelectField, TextareaField } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { CampaignStatusBadge, MemberStatusBadge } from '@/components/ui/StatusBadge';
import { CampaignCreationConfigCard } from './CampaignCreationConfigCard';
import { GuestLinkAccountModal } from './GuestLinkAccountModal';
import { DeleteCharacterModal } from '@/components/characters/DeleteCharacterModal';
import type { CampaignCreationConfig } from '@/domain/campaigns/creation-config';
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
  ownerDisplayName: string | null;
  isMine: boolean;
  canEdit: boolean;
  createdAt: string;
}

interface CharacterInspectionDetail {
  id: string;
  name: string;
  ownerDisplayName: string | null;
  isMine: boolean;
  canEdit: boolean;
  editableFields: string[];
  sheetData: Record<string, unknown>;
  gmNotes?: string;
  fieldPermissions?: {
    playerEditableFields: string[];
    gmOnlyFields: string[];
  };
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
    creationConfig: CampaignCreationConfig;
    maxCharactersPerPlayer: number | null;
    virtualDiceEnabled: boolean;
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

function readNestedText(obj: Record<string, unknown>, section: string, field: string): string {
  const sec = obj[section];
  if (!sec || typeof sec !== 'object') return '';
  const val = (sec as Record<string, unknown>)[field];
  return typeof val === 'string' ? val : '';
}

function readStartingLevel(obj: Record<string, unknown>): string {
  const prog = obj.progression;
  if (!prog || typeof prog !== 'object') return '—';
  const lvl = (prog as Record<string, unknown>).totalLevel;
  return typeof lvl === 'number' ? `Nivell ${lvl}` : '—';
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

  // Vinculació d'identitat de convidat
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  // Personatges base (creació i inspecció/edició controlada)
  const [newCharName, setNewCharName] = useState('');
  const [newCharMemberId, setNewCharMemberId] = useState<string>('');
  const [creatingChar, setCreatingChar] = useState(false);
  const [charError, setCharError] = useState<string | null>(null);
  const [charSuccess, setCharSuccess] = useState<string | null>(null);
  const [deleteCharTarget, setDeleteCharTarget] = useState<CampaignCharacterDto | null>(null);

  const [inspectedChar, setInspectedChar] = useState<CharacterInspectionDetail | null>(null);
  const [charModalLoading, setCharModalLoading] = useState(false);
  const [charSaving, setCharSaving] = useState(false);
  const [charModalError, setCharModalError] = useState<string | null>(null);
  const [editCharName, setEditCharName] = useState('');
  const [editAppearance, setEditAppearance] = useState('');
  const [editBackstory, setEditBackstory] = useState('');
  const [editGmNotes, setEditGmNotes] = useState('');
  const [editEditableFields, setEditEditableFields] = useState<string[]>([]);

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

  async function handleCreateCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCharError(null);
    setCreatingChar(true);
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCharName,
          memberId: canManage ? (newCharMemberId || null) : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setCharError(data?.error?.message ?? 'No s’ha pogut crear el personatge.');
        return;
      }
      setNewCharName('');
      router.refresh();
    } catch {
      setCharError('Error de connexió en crear el personatge.');
    } finally {
      setCreatingChar(false);
    }
  }

  async function handleInspectCharacter(characterId: string) {
    setCharModalError(null);
    setCharModalLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/characters/${characterId}`);
      const data = await response.json();
      if (!response.ok) {
        setCharError(data?.error?.message ?? 'No s’ha pogut carregar el personatge.');
        return;
      }
      const ch = data.character as CharacterInspectionDetail;
      setInspectedChar(ch);
      setEditCharName(ch.name);
      setEditAppearance(readNestedText(ch.sheetData, 'generalInfo', 'appearanceNotes'));
      setEditBackstory(readNestedText(ch.sheetData, 'background', 'backstory'));
      setEditGmNotes(ch.gmNotes ?? '');
      setEditEditableFields(ch.fieldPermissions?.playerEditableFields ?? []);
    } finally {
      setCharModalLoading(false);
    }
  }

  async function handleUpdateCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inspectedChar) return;
    setCharModalError(null);
    setCharSaving(true);

    try {
      const payload: Record<string, unknown> = {};
      if (canManage || inspectedChar.editableFields.includes('name')) {
        payload.name = editCharName;
      }
      const sheetFields: Record<string, string> = {};
      if (canManage || inspectedChar.editableFields.includes('generalInfo.appearanceNotes')) {
        sheetFields['generalInfo.appearanceNotes'] = editAppearance;
      }
      if (canManage || inspectedChar.editableFields.includes('background.backstory')) {
        sheetFields['background.backstory'] = editBackstory;
      }
      if (Object.keys(sheetFields).length > 0) {
        payload.sheetFields = sheetFields;
      }
      if (canManage) {
        payload.gmNotes = editGmNotes;
        payload.fieldPermissions = {
          playerEditableFields: editEditableFields,
          gmOnlyFields: inspectedChar.fieldPermissions?.gmOnlyFields ?? [],
        };
      }

      const response = await fetch(
        `/api/campaigns/${campaign.id}/characters/${inspectedChar.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        setCharModalError(data?.error?.message ?? 'No s’ha pogut actualitzar el personatge.');
        return;
      }
      setInspectedChar(null);
      router.refresh();
    } catch {
      setCharModalError('Error de connexió en desar el personatge.');
    } finally {
      setCharSaving(false);
    }
  }

  const activeMembers = members.filter((m) => m.status === 'active');

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

      {/* Resum per a jugador / convidat + vinculació d'identitat */}
      {!canManage && currentMember && (
        <Card
          title="La teva participació"
          subtitle="Informació del teu accés a aquesta campanya."
          actions={
            currentMember.memberType === 'guest' ? (
              <Button size="sm" variant="secondary" onClick={() => setLinkModalOpen(true)}>
                <UserCheck className="h-3.5 w-3.5" />
                Vincular a un compte
              </Button>
            ) : undefined
          }
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
          {currentMember.memberType === 'guest' && (
            <p className="mt-2.5 text-xs text-[var(--rol-ink-secondary)]">
              Pots vincular aquest accés de convidat a un compte nou o a un compte existent per
              conservar tots els teus personatges i participar en més campanyes.
            </p>
          )}
        </Card>
      )}

      {/* Configuració de creació de personatges, límit per jugador i dau virtual */}
      <CampaignCreationConfigCard
        campaignId={campaign.id}
        canManage={canManage}
        initialConfig={campaign.creationConfig}
        initialMaxCharactersPerPlayer={campaign.maxCharactersPerPlayer}
        initialVirtualDiceEnabled={campaign.virtualDiceEnabled}
      />

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

      {/* Secció de personatges (visibilitat de campanya i base estructural Fase 3) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Personatges de la campanya"
          subtitle="Tots els membres poden consultar les fitxes del grup; només el propietari autoritzat o el GM les poden editar."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="gold">Fitxa D&D 5e</Badge>
              <Link
                href={`/campaigns/${campaign.id}/characters/new`}
                className="inline-flex items-center justify-center gap-1.5 rounded-[var(--rol-radius-md)] bg-[var(--rol-accent-primary)] px-3 py-1.5 text-xs font-medium text-[var(--rol-accent-primary-ink)] shadow-sm transition-colors hover:bg-[var(--rol-accent-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rol-accent-gold)]"
              >
                <Plus className="h-3.5 w-3.5" />
                Creació guiada (6 passos)
              </Link>
            </div>
          }
        >
          <form onSubmit={handleCreateCharacter} className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-end">
            <div className="flex-1">
              <InputField
                label="Nou personatge base"
                htmlFor="new-char-name"
                type="text"
                required
                value={newCharName}
                onChange={(e) => setNewCharName(e.target.value)}
                placeholder="Ex. Pim Bramble"
              />
            </div>

            {canManage && activeMembers.length > 0 && (
              <div className="sm:w-44">
                <SelectField
                  label="Assignar a"
                  htmlFor="new-char-owner"
                  value={newCharMemberId}
                  onChange={(e) => setNewCharMemberId(e.target.value)}
                >
                  <option value="">Sense jugador (GM)</option>
                  {activeMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                    </option>
                  ))}
                </SelectField>
              </div>
            )}

            <Button type="submit" disabled={creatingChar} className="shrink-0">
              <Plus className="h-4 w-4" />
              {creatingChar ? 'Creant…' : 'Afegir'}
            </Button>
          </form>

          {charError && (
            <div
              role="alert"
              className="mb-3 rounded-[var(--rol-radius-md)] border border-[var(--rol-status-danger-border)] bg-[var(--rol-status-danger-bg)] px-3 py-2 text-xs text-[var(--rol-status-danger-ink)]"
            >
              {charError}
            </div>
          )}

          {charSuccess && (
            <div
              role="status"
              className="mb-3 rounded-[var(--rol-radius-md)] border border-[var(--rol-status-success-border)] bg-[var(--rol-status-success-bg)] px-3 py-2 text-xs text-[var(--rol-status-success-ink)]"
            >
              {charSuccess}
            </div>
          )}

          {characters.length === 0 ? (
            <p className="text-sm text-[var(--rol-ink-muted)]">
              Encara no hi ha cap personatge creat en aquesta campanya.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {characters.map((ch) => (
                <li
                  key={ch.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/40 px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/campaigns/${campaign.id}/characters/${ch.id}`}
                        className="font-semibold text-[var(--rol-ink-primary)] hover:text-[var(--rol-accent-primary)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rol-accent-gold)]"
                      >
                        {ch.name}
                      </Link>
                      {ch.isMine && <Badge tone="gold">El teu</Badge>}
                      {!canManage && !ch.canEdit && <Badge tone="neutral">Només lectura</Badge>}
                    </div>
                    <p className="text-xs text-[var(--rol-ink-muted)]">
                      {ch.ownerDisplayName ? `Jugador: ${ch.ownerDisplayName}` : 'Personatge del GM'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/campaigns/${campaign.id}/characters/${ch.id}`}
                      className="inline-flex items-center justify-center gap-1.5 rounded-[var(--rol-radius-md)] bg-[var(--rol-accent-primary)] px-3 py-1.5 text-xs font-medium text-[var(--rol-accent-primary-ink)] shadow-sm transition-colors hover:bg-[var(--rol-accent-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rol-accent-gold)]"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {ch.canEdit ? 'Obrir fitxa' : 'Consultar fitxa'}
                    </Link>
                    {(canManage || ch.canEdit) && (
                      <>
                        <Link
                          href={`/campaigns/${campaign.id}/characters/${ch.id}?edit=1`}
                          className="inline-flex items-center justify-center gap-1.5 rounded-[var(--rol-radius-md)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--rol-ink-primary)] shadow-sm transition-colors hover:bg-[var(--rol-bg-surface-alt)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rol-accent-gold)]"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </Link>
                        {canManage && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={charModalLoading}
                            onClick={() => handleInspectCharacter(ch.id)}
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            Gestió GM
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            setCharError(null);
                            setCharSuccess(null);
                            setDeleteCharTarget(ch);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Eliminar
                        </Button>
                      </>
                    )}
                  </div>
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

      {/* Modal de vinculació d'identitat per a convidats */}
      {!canManage && currentMember?.memberType === 'guest' && (
        <GuestLinkAccountModal
          open={linkModalOpen}
          onClose={() => setLinkModalOpen(false)}
          defaultDisplayName={currentMember.displayName}
        />
      )}

      {/* Modal d'inspecció i edició controlada de personatge base */}
      <Modal
        open={Boolean(inspectedChar)}
        onClose={() => setInspectedChar(null)}
        title={inspectedChar?.name ?? 'Personatge'}
        description={`Gestió ràpida de notes privades del GM, permisos de camps i resum (${readStartingLevel(inspectedChar?.sheetData ?? {})}).`}
      >
        {inspectedChar && (
          <form onSubmit={handleUpdateCharacter} className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge tone="gold">
                {inspectedChar.ownerDisplayName
                  ? `Jugador: ${inspectedChar.ownerDisplayName}`
                  : 'Personatge del GM'}
              </Badge>
              <Badge tone={inspectedChar.canEdit ? 'success' : 'neutral'}>
                {inspectedChar.canEdit ? 'Edició autoritzada' : 'Només consulta'}
              </Badge>
            </div>

            <InputField
              label="Nom del personatge"
              htmlFor="char-modal-name"
              type="text"
              value={editCharName}
              onChange={(e) => setEditCharName(e.target.value)}
              disabled={
                !canManage &&
                (!inspectedChar.canEdit || !inspectedChar.editableFields.includes('name'))
              }
            />

            <TextareaField
              label="Descripció i aspecte"
              htmlFor="char-modal-appearance"
              rows={2}
              value={editAppearance}
              onChange={(e) => setEditAppearance(e.target.value)}
              disabled={
                !canManage &&
                (!inspectedChar.canEdit ||
                  !inspectedChar.editableFields.includes('generalInfo.appearanceNotes'))
              }
            />

            <TextareaField
              label="Història personal"
              htmlFor="char-modal-backstory"
              rows={3}
              value={editBackstory}
              onChange={(e) => setEditBackstory(e.target.value)}
              disabled={
                !canManage &&
                (!inspectedChar.canEdit ||
                  !inspectedChar.editableFields.includes('background.backstory'))
              }
            />

            {canManage && (
              <>
                <TextareaField
                  label="Notes privades del GM (invisibles per als jugadors)"
                  htmlFor="char-modal-gm-notes"
                  rows={2}
                  value={editGmNotes}
                  onChange={(e) => setEditGmNotes(e.target.value)}
                  placeholder="Secrets, trames o recordatoris interns del GM…"
                />

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-[var(--rol-ink-primary)]">
                    Camps que el jugador propietari pot editar
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {(
                      [
                        { path: 'name', label: 'Nom' },
                        { path: 'generalInfo.appearanceNotes', label: 'Aspecte' },
                        { path: 'background.backstory', label: 'Història' },
                      ] as const
                    ).map((opt) => {
                      const active = editEditableFields.includes(opt.path);
                      return (
                        <label
                          key={opt.path}
                          className="inline-flex items-center gap-1.5 rounded border border-[var(--rol-border-subtle)] px-2.5 py-1 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() =>
                              setEditEditableFields((prev) =>
                                prev.includes(opt.path)
                                  ? prev.filter((p) => p !== opt.path)
                                  : [...prev, opt.path]
                              )
                            }
                          />
                          <span>{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {charModalError && (
              <div
                role="alert"
                className="rounded-[var(--rol-radius-md)] border border-[var(--rol-status-danger-border)] bg-[var(--rol-status-danger-bg)] px-3.5 py-2.5 text-sm text-[var(--rol-status-danger-ink)]"
              >
                {charModalError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setInspectedChar(null)}>
                Tancar
              </Button>
              {inspectedChar.canEdit && (
                <Button type="submit" disabled={charSaving}>
                  {charSaving ? 'Desant…' : 'Desar canvis'}
                </Button>
              )}
            </div>
          </form>
        )}
      </Modal>

      {/* Modal d'eliminació definitiva de personatge amb doble confirmació */}
      {deleteCharTarget && (
        <DeleteCharacterModal
          key={`del-list-${deleteCharTarget.id}`}
          open={Boolean(deleteCharTarget)}
          onClose={() => setDeleteCharTarget(null)}
          campaignId={campaign.id}
          characterId={deleteCharTarget.id}
          characterName={deleteCharTarget.name}
          onDeleted={() => {
            const deletedName = deleteCharTarget.name;
            setDeleteCharTarget(null);
            setCharSuccess(`S’ha eliminat el personatge "${deletedName}".`);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
