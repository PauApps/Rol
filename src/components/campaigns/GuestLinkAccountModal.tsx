'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { InputField } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';

interface GuestLinkAccountModalProps {
  open: boolean;
  onClose: () => void;
  defaultDisplayName: string;
}

export function GuestLinkAccountModal({
  open,
  onClose,
  defaultDisplayName,
}: GuestLinkAccountModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'create' | 'existing'>('create');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const payload =
        mode === 'create'
          ? { mode: 'create', email, displayName, password }
          : { mode: 'existing', email, password };

      const response = await fetch('/api/auth/link-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error?.message ?? 'No s’ha pogut vincular l’accés amb el compte.');
        return;
      }

      onClose();
      router.refresh();
    } catch {
      setError('Error de connexió amb el servidor.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Vincular el teu accés de convidat"
      description="Conservaràs la teva participació i tots els personatges sense perdre ni duplicar dades."
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-1.5 rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)] p-1">
          <button
            type="button"
            onClick={() => {
              setMode('create');
              setError(null);
            }}
            className={`rounded-[var(--rol-radius-sm)] px-3 py-2 text-xs font-semibold cursor-pointer ${
              mode === 'create'
                ? 'bg-[var(--rol-bg-surface)] text-[var(--rol-ink-primary)] shadow-sm border border-[var(--rol-border-strong)]'
                : 'text-[var(--rol-ink-secondary)]'
            }`}
          >
            Crear un compte nou
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('existing');
              setError(null);
            }}
            className={`rounded-[var(--rol-radius-sm)] px-3 py-2 text-xs font-semibold cursor-pointer ${
              mode === 'existing'
                ? 'bg-[var(--rol-bg-surface)] text-[var(--rol-ink-primary)] shadow-sm border border-[var(--rol-border-strong)]'
                : 'text-[var(--rol-ink-secondary)]'
            }`}
          >
            Vincular a un compte existent
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'create' && (
            <InputField
              label="Nom visible del compte"
              htmlFor="link-display-name"
              type="text"
              required
              minLength={2}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          )}

          <InputField
            label="Correu electrònic"
            htmlFor="link-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jugador@exemple.cat"
          />

          <InputField
            label={mode === 'create' ? 'Contrasenya (mínim 8 caràcters)' : 'Contrasenya del compte'}
            htmlFor="link-password"
            type="password"
            required
            minLength={mode === 'create' ? 8 : 1}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel·lar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? 'Vinculant…'
                : mode === 'create'
                  ? 'Crear compte i vincular'
                  : 'Verificar i vincular'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
