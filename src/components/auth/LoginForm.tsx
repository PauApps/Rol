'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ScrollText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { InputField } from '@/components/ui/Field';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data?.error?.message ?? 'No s’ha pogut iniciar sessió.');
        return;
      }

      if (data?.user?.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/campaigns');
      }
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
          <ScrollText className="h-6 w-6" />
        </div>
        <h1 className="rol-heading-flourish text-2xl font-bold">Rol</h1>
        <p className="mt-1 text-sm text-[var(--rol-ink-secondary)]">
          Accés per a Directors de Joc, jugadors registrats i administració
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <InputField
          label="Correu electrònic"
          htmlFor="login-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nom@exemple.cat"
        />

        <InputField
          label="Contrasenya"
          htmlFor="login-password"
          type="password"
          autoComplete="current-password"
          required
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

        <Button type="submit" disabled={submitting} className="w-full" size="lg">
          {submitting ? 'Accedint…' : 'Entrar'}
        </Button>
      </form>

      <div className="mt-6 rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)] p-3.5 text-xs text-[var(--rol-ink-secondary)]">
        <p className="font-medium text-[var(--rol-ink-primary)]">Accés per invitació</p>
        <p className="mt-1">
          El registre de Directors de Joc (GM) és tancat i requereix una invitació individual de
          l’administrador principal. Els jugadors poden entrar des de l’enllaç de la seva campanya.
        </p>
      </div>
    </div>
  );
}
