'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CopyLinkBox } from '@/components/ui/CopyLinkBox';
import { InputField } from '@/components/ui/Field';
import { UserStatusBadge } from '@/components/ui/StatusBadge';
import type { UserRole, UserStatus } from '@/db/schema';

export interface AdminInviteItem {
  id: string;
  email: string;
  note: string;
  usedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface AdminUserItem {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export interface AdminAuditItem {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

interface AdminDashboardClientProps {
  currentAdminId: string;
  initialInvitations: AdminInviteItem[];
  initialUsers: AdminUserItem[];
  initialLogs: AdminAuditItem[];
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  gm: 'GM',
  player: 'Jugador',
};

export function AdminDashboardClient({
  currentAdminId,
  initialInvitations,
  initialUsers,
  initialLogs,
}: AdminDashboardClientProps) {
  const router = useRouter();
  const [invitations, setInvitations] = useState(initialInvitations);
  const [users, setUsers] = useState(initialUsers);
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleCreateInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setGeneratedUrl(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/admin/gm-invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, note }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error?.message ?? 'No s’ha pogut crear la invitació.');
        return;
      }

      setGeneratedUrl(data.inviteUrl);
      setInvitations((prev) => [
        {
          id: data.invitation.id,
          email: data.invitation.email,
          note: data.invitation.note,
          usedAt: null,
          revokedAt: null,
          createdAt: new Date(data.invitation.createdAt).toISOString(),
        },
        ...prev,
      ]);
      setEmail('');
      setNote('');
      router.refresh();
    } catch {
      setError('Error de connexió en generar la invitació.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevokeInvite(id: string) {
    setBusyId(id);
    try {
      const response = await fetch(`/api/admin/gm-invitations/${id}/revoke`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error?.message ?? 'No s’ha pogut revocar la invitació.');
        return;
      }
      setInvitations((prev) =>
        prev.map((inv) =>
          inv.id === id ? { ...inv, revokedAt: new Date().toISOString() } : inv
        )
      );
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleUpdateUserStatus(userId: string, status: UserStatus) {
    setBusyId(userId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error?.message ?? 'No s’ha pogut actualitzar l’estat del compte.');
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status } : u)));
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Convidar un nou GM"
          subtitle="Només l’administrador principal pot autoritzar nous Directors de Joc."
        >
          <form onSubmit={handleCreateInvite} className="space-y-4">
            <InputField
              label="Correu del nou GM"
              htmlFor="admin-gm-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="master@exemple.cat"
            />
            <InputField
              label="Nota interna (opcional)"
              htmlFor="admin-gm-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex. Grup de dijous"
            />
            <Button type="submit" disabled={submitting}>
              <UserPlus className="h-4 w-4" />
              {submitting ? 'Generant…' : 'Generar invitació de GM'}
            </Button>
          </form>

          {generatedUrl && (
            <div className="mt-4">
              <CopyLinkBox
                label="Enllaç únic d’invitació de GM"
                url={generatedUrl}
                notice="Comparteix aquest enllaç de manera privada. El token només es mostra en aquest moment i no es desa en text pla."
              />
            </div>
          )}
        </Card>

        <Card
          title="Invitacions de GM"
          subtitle="Estat de les invitacions emeses (d’un sol ús, revocables)."
        >
          {invitations.length === 0 ? (
            <p className="text-sm text-[var(--rol-ink-muted)]">
              Encara no s’ha generat cap invitació de GM.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {invitations.map((inv) => {
                const statusBadge = inv.revokedAt ? (
                  <Badge tone="danger">Revocada</Badge>
                ) : inv.usedAt ? (
                  <Badge tone="success">Utilitzada</Badge>
                ) : (
                  <Badge tone="warning">Pendent</Badge>
                );

                return (
                  <div
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/50 px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--rol-ink-primary)]">
                        {inv.email}
                      </p>
                      <p className="text-xs text-[var(--rol-ink-muted)]">
                        {inv.note ? `${inv.note} · ` : ''}
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
                          onClick={() => handleRevokeInvite(inv.id)}
                        >
                          Revocar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card
        title="Comptes registrats"
        subtitle="Bloquejar o desactivar un compte revoca immediatament totes les seves sessions."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--rol-border-subtle)] text-xs uppercase text-[var(--rol-ink-muted)]">
                <th className="py-2.5 pr-4">Nom</th>
                <th className="py-2.5 pr-4">Correu</th>
                <th className="py-2.5 pr-4">Rol</th>
                <th className="py-2.5 pr-4">Estat</th>
                <th className="py-2.5 text-right">Accions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rol-border-subtle)]">
              {users.map((u) => {
                const isSelf = u.id === currentAdminId;
                return (
                  <tr key={u.id}>
                    <td className="py-3 pr-4 font-medium">{u.displayName}</td>
                    <td className="py-3 pr-4 text-[var(--rol-ink-secondary)]">{u.email}</td>
                    <td className="py-3 pr-4">
                      <Badge tone={u.role === 'admin' ? 'gold' : 'neutral'}>
                        {ROLE_LABELS[u.role]}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <UserStatusBadge status={u.status} />
                    </td>
                    <td className="py-3 text-right">
                      {isSelf ? (
                        <span className="inline-flex items-center gap-1 text-xs text-[var(--rol-ink-muted)]">
                          <ShieldAlert className="h-3.5 w-3.5" /> Compte actual
                        </span>
                      ) : (
                        <div className="inline-flex flex-wrap justify-end gap-1.5">
                          {u.status !== 'active' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busyId === u.id}
                              onClick={() => handleUpdateUserStatus(u.id, 'active')}
                            >
                              Reactivar
                            </Button>
                          )}
                          {u.status !== 'blocked' && (
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={busyId === u.id}
                              onClick={() => handleUpdateUserStatus(u.id, 'blocked')}
                            >
                              Bloquejar
                            </Button>
                          )}
                          {u.status !== 'disabled' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busyId === u.id}
                              onClick={() => handleUpdateUserStatus(u.id, 'disabled')}
                            >
                              Desactivar
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="Registre recent d’auditoria"
        subtitle="Operacions sensibles enregistrades de manera immutable al servidor."
      >
        {initialLogs.length === 0 ? (
          <p className="text-sm text-[var(--rol-ink-muted)]">Encara no hi ha registres.</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1 text-xs">
            {initialLogs.map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/40 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">{log.action}</Badge>
                  <span className="text-[var(--rol-ink-secondary)]">
                    {log.targetType}
                    {log.targetId ? ` · ${log.targetId.slice(0, 8)}` : ''}
                  </span>
                </div>
                <span className="text-[var(--rol-ink-muted)]">
                  {new Date(log.createdAt).toLocaleString('ca-ES')}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
