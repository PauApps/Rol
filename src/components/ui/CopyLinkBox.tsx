'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from './Button';

interface CopyLinkBoxProps {
  label?: string;
  url: string;
  notice?: string;
}

export function CopyLinkBox({ label, url, notice }: CopyLinkBoxProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: select via input if clipboard API is unavailable
    }
  }

  return (
    <div className="rounded-[var(--rol-radius-md)] border border-[var(--rol-accent-gold)] bg-[var(--rol-accent-gold-soft)]/45 p-3.5 space-y-2">
      {label && (
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--rol-ink-secondary)]">
          {label}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2.5 py-1.5 font-mono text-xs text-[var(--rol-ink-primary)]"
        />
        <Button type="button" size="sm" variant="secondary" onClick={handleCopy} className="shrink-0">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copiat' : 'Copiar enllaç'}
        </Button>
      </div>
      {notice && <p className="text-xs text-[var(--rol-ink-secondary)]">{notice}</p>}
    </div>
  );
}
