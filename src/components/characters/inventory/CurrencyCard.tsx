'use client';

import { Coins } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { canEditSheetField, type SheetAccessContext } from '../sheet-permissions';
import type { CharacterSheetDraft } from '../types';

interface CurrencyCardProps {
  draftCurrency: CharacterSheetDraft['currency'];
  access: SheetAccessContext;
  onChangeCoin: (coin: keyof CharacterSheetDraft['currency'], value: number) => void;
}

const COINS: ReadonlyArray<{
  key: keyof CharacterSheetDraft['currency'];
  abbr: string;
  label: string;
  accentClass: string;
}> = [
  { key: 'cp', abbr: 'PC', label: 'Coure', accentClass: 'text-[#8c4a27]' },
  { key: 'sp', abbr: 'PP', label: 'Plata', accentClass: 'text-[#5b6470]' },
  { key: 'ep', abbr: 'PE', label: 'Electre', accentClass: 'text-[#4e6d73]' },
  { key: 'gp', abbr: 'PO', label: 'Or', accentClass: 'text-[var(--rol-accent-gold)]' },
  { key: 'pp', abbr: 'PPt', label: 'Platí', accentClass: 'text-[#46495c]' },
];

export function CurrencyCard({ draftCurrency, access, onChangeCoin }: CurrencyCardProps) {
  return (
    <Card
      title="Monedes"
      subtitle="Quantitats individuals per tipus de moneda sense conversions automàtiques."
      actions={<Coins className="h-4 w-4 text-[var(--rol-accent-gold)]" />}
    >
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {COINS.map((coin) => {
          const editable = canEditSheetField(`currency.${coin.key}`, access);
          return (
            <div key={coin.key} className="rol-stat-plaque p-2.5 text-center space-y-1">
              <label
                htmlFor={`currency-${coin.key}`}
                className="block text-xs font-semibold text-[var(--rol-ink-primary)]"
              >
                <span className={`font-bold ${coin.accentClass}`}>{coin.abbr}</span> · {coin.label}
              </label>
              <input
                id={`currency-${coin.key}`}
                type="number"
                min={0}
                max={100000000}
                step={1}
                disabled={!editable}
                value={draftCurrency[coin.key]}
                onChange={(e) => {
                  const n = Math.trunc(Number(e.target.value) || 0);
                  onChangeCoin(coin.key, Math.min(100000000, Math.max(0, n)));
                }}
                className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface-alt)]/50 px-2 py-1 text-center font-mono text-sm font-bold text-[var(--rol-ink-primary)] disabled:opacity-70 disabled:cursor-not-allowed"
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
