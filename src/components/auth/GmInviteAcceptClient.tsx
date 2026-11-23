'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { InputField } from '@/components/ui/Field';

interface GmInviteAcceptClientProps {
  token: string;
  invitedEmail: string;
  note: string;
}

export function GmInviteAcceptClient({
  token,
  invitedEmail,
  note,
}: GmInviteAcceptClientProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch(`/api/invitations/gm/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: invitedEmail,
          displayName,
          password,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data?.error?.message ?? 'No s’ha pogut completar el registre de GM.');
        return;
      }

      router.push('/campaigns');
      router.refresh();
    } catch {
      setError('Error de connexió amb el servidor.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rol-card-surface w-full max-w-md p-6 sm:p-8">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--rol-accent-gold)] bg-[var(--rol-accent-primary)] text-[var(--rol-accent-primary-ink)]">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="rol-heading-flourish text-2xl font-bold">Invitació de Director de Joc</h1>
        <p className="mt-1 text-sm text-[var(--rol-ink-secondary)]">
          Activa el teu compte de GM per crear i gestionar campanyes presencials.
        </p>
      </div>

      {note && (
        <div className="mb-4 rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)] px-3.5 py-2.5 text-xs text-[var(--rol-ink-secondary)]">
          <span className="font-semibold text-[var(--rol-ink-primary)]">Nota de l’administrador: </span>
          {note}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <InputField
          label="Correu electrònic autoritzat"
          htmlFor="gm-invite-email"
          type="email"
          value={invitedEmail}
          readOnly
          className="bg-[var(--rol-bg-surface-alt)] opacity-85"
        />

        <InputField
          label="Nom visible de GM"
          htmlFor="gm-invite-name"
          type="text"
          required
          minLength={2}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Ex. Marc — Master"
        />

        <InputField
          label="Contrasenya"
          htmlFor="gm-invite-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="Mínim 8 caràcters."
          placeholder="••••••••"
        />

        {error && (
          <div
            role="alert"
            className="rounded-[var(--rol-radius-md)] border border-[var(--rol-status-danger-border)] bg-[var(--rol-status-danger-bg)] px-3.5 py-2.5 text-sm text-[var(--rol-status-danger-ink)]"
          >
            {error}
          </div>
        )}

        <Button type="submit" disabled={submitting} className="w-full" size="lg">
          {submitting ? 'Creant compte…' : 'Crear compte de GM'}
        </Button>
      </form>
    </div>
  );
}
