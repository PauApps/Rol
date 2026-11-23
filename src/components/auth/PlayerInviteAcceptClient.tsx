'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Compass, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { InputField } from '@/components/ui/Field';

interface PlayerInviteAcceptClientProps {
  token: string;
  kind: 'join' | 'recovery';
  campaignId: string;
  campaignName: string;
  systemName: string;
  label: string;
  targetDisplayName: string | null;
}

type JoinTab = 'guest' | 'register' | 'login';

export function PlayerInviteAcceptClient({
  token,
  kind,
  campaignId,
  campaignName,
  systemName,
  label,
  targetDisplayName,
}: PlayerInviteAcceptClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<JoinTab>('guest');
  const [alias, setAlias] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submitAccept(payload: Record<string, unknown>) {
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch(`/api/invitations/player/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data?.error?.message ?? 'No s’ha pogut completar l’accés a la campanya.');
        return;
      }

      router.push(`/campaigns/${data.campaignId ?? campaignId}`);
      router.refresh();
    } catch {
      setError('Error de connexió amb el servidor.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleJoinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (tab === 'guest') {
      await submitAccept({ mode: 'guest', displayName: alias });
    } else if (tab === 'register') {
      await submitAccept({ mode: 'register', email, displayName, password });
    } else {
      await submitAccept({ mode: 'login', email, password });
    }
  }

  if (kind === 'recovery') {
    return (
      <div className="rol-card-surface w-full max-w-md p-6 sm:p-8 space-y-5">
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--rol-accent-gold)] bg-[var(--rol-accent-primary)] text-[var(--rol-accent-primary-ink)]">
            <KeyRound className="h-6 w-6" />
          </div>
          <Badge tone="gold" className="mb-2">
            {systemName}
          </Badge>
          <h1 className="rol-heading-flourish text-2xl font-bold">Recuperació d’accés</h1>
          <p className="mt-1 text-sm text-[var(--rol-ink-secondary)]">
            Campanya: <strong className="text-[var(--rol-ink-primary)]">{campaignName}</strong>
          </p>
        </div>

        <div className="rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)] p-4 text-sm text-[var(--rol-ink-secondary)]">
          Estàs recuperant l’accés de convidat com a{' '}
          <strong className="text-[var(--rol-ink-primary)]">{targetDisplayName}</strong>. Les
          sessions anteriors d’aquest enllaç perdut quedaran revocades automàticament.
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-[var(--rol-radius-md)] border border-[var(--rol-status-danger-border)] bg-[var(--rol-status-danger-bg)] px-3.5 py-2.5 text-sm text-[var(--rol-status-danger-ink)]"
          >
            {error}
          </div>
        )}

        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={submitting}
          onClick={() => submitAccept({ mode: 'recover' })}
        >
          {submitting ? 'Restaurant accés…' : 'Recuperar l’accés ara'}
        </Button>
      </div>
    );
  }

  return (
    <div className="rol-card-surface w-full max-w-lg p-6 sm:p-8 space-y-5">
      <div className="flex flex-col items-center text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--rol-accent-gold)] bg-[var(--rol-accent-primary)] text-[var(--rol-accent-primary-ink)]">
          <Compass className="h-6 w-6" />
        </div>
        <Badge tone="gold" className="mb-2">
          {systemName}
        </Badge>
        <h1 className="rol-heading-flourish text-2xl font-bold">{campaignName}</h1>
        <p className="mt-1 text-sm text-[var(--rol-ink-secondary)]">
          T’han convidat a unir-te a aquesta campanya. Tria com vols accedir-hi.
        </p>
        {label && (
          <p className="mt-1 text-xs text-[var(--rol-ink-muted)]">Invitació: {label}</p>
        )}
      </div>

      {/* Pestanyes de modalitat d'accés */}
      <div className="grid grid-cols-3 gap-1.5 rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)] p-1">
        {(
          [
            { id: 'guest', label: 'Convidat' },
            { id: 'register', label: 'Crear compte' },
            { id: 'login', label: 'Ja tinc compte' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id);
              setError(null);
            }}
            className={`rounded-[var(--rol-radius-sm)] px-2 py-2 text-xs font-semibold transition-colors cursor-pointer sm:text-sm ${
              tab === item.id
                ? 'bg-[var(--rol-bg-surface)] text-[var(--rol-ink-primary)] shadow-sm border border-[var(--rol-border-strong)]'
                : 'text-[var(--rol-ink-secondary)] hover:text-[var(--rol-ink-primary)]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleJoinSubmit} className="space-y-4">
        {tab === 'guest' && (
          <InputField
            label="Nom o àlies a la taula"
            htmlFor="guest-alias"
            type="text"
            required
            minLength={2}
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="Ex. Pim Bramble"
            hint="No cal contrasenya. Si perds aquest navegador, el GM et podrà generar un nou enllaç."
          />
        )}

        {tab === 'register' && (
          <>
            <InputField
              label="Nom visible"
              htmlFor="player-register-name"
              type="text"
              required
              minLength={2}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="El teu nom"
            />
            <InputField
              label="Correu electrònic"
              htmlFor="player-register-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@exemple.cat"
            />
            <InputField
              label="Contrasenya"
              htmlFor="player-register-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint="Mínim 8 caràcters."
              placeholder="••••••••"
            />
          </>
        )}

        {tab === 'login' && (
          <>
            <InputField
              label="Correu electrònic del teu compte"
              htmlFor="player-login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@exemple.cat"
            />
            <InputField
              label="Contrasenya"
              htmlFor="player-login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-[var(--rol-radius-md)] border border-[var(--rol-status-danger-border)] bg-[var(--rol-status-danger-bg)] px-3.5 py-2.5 text-sm text-[var(--rol-status-danger-ink)]"
          >
            {error}
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting
            ? 'Accedint…'
            : tab === 'guest'
              ? 'Entrar com a convidat'
              : tab === 'register'
                ? 'Crear compte i unir-me'
                : 'Iniciar sessió i unir-me'}
        </Button>
      </form>
    </div>
  );
}
