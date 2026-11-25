'use client';

import { BookOpen, Clock, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { CharacterTabId } from './types';

interface TabPlaceholderProps {
  tabId: Extract<CharacterTabId, 'story' | 'progression'>;
}

const PLACEHOLDER_META: Record<
  Extract<CharacterTabId, 'story' | 'progression'>,
  {
    title: string;
    subtitle: string;
    incrementLabel: string;
    details: string[];
    icon: typeof BookOpen;
  }
> = {
  story: {
    title: 'Història i diari',
    subtitle: 'Identitat narrativa, rerefons i notes de sessió.',
    incrementLabel: 'Planificat per a l’Increment 3C.3',
    details: [
      'Rerefons, alineament, fe, edat, aspecte físic, trets de personalitat, ideals, vincles i defectes.',
      'Diari cronològic de sessions i notes ampliades del personatge.',
      'Gestió de camps personalitzats del GM a partir de l’Increment 3C.4.',
    ],
    icon: BookOpen,
  },
  progression: {
    title: 'Progressió i evolució',
    subtitle: 'Classes, subclasses, experiència i registre nivell a nivell.',
    incrementLabel: 'Planificat per a l’Increment 3C.3',
    details: [
      'Gestió de multiclasse fins al nivell 20 oficial i seguiment de punts d’experiència.',
      'Fites properes (competència, subclasses, ASI, cercles màgics i trets clau de classe).',
      'Historial d’evolució nivell a nivell (`levelHistory`) i millores de característica.',
    ],
    icon: TrendingUp,
  },
};

export function TabPlaceholder({ tabId }: TabPlaceholderProps) {
  const meta = PLACEHOLDER_META[tabId];
  const Icon = meta.icon;

  return (
    <div role="tabpanel" id={`panel-${tabId}`} aria-labelledby={`tab-${tabId}`}>
      <Card
        title={meta.title}
        subtitle={meta.subtitle}
        actions={
          <Badge tone="gold">
            <Clock className="h-3 w-3" />
            {meta.incrementLabel}
          </Badge>
        }
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface-alt)] text-[var(--rol-accent-primary)]">
            <Icon className="h-6 w-6" />
          </div>
          <div className="space-y-2.5 text-sm text-[var(--rol-ink-secondary)]">
            <p className="font-medium text-[var(--rol-ink-primary)]">
              Aquesta secció s’incorporarà en els propers increments de la Fase 3C sense perdre les
              dades existents de la fitxa.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-xs sm:text-sm">
              {meta.details.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
