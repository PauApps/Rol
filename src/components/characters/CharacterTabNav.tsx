'use client';

import { useRef, type KeyboardEvent } from 'react';
import { Backpack, BookOpen, Sparkles, Swords, TrendingUp } from 'lucide-react';
import { CHARACTER_TABS, type CharacterTabId } from './types';

interface CharacterTabNavProps {
  activeTab: CharacterTabId;
  onSelectTab: (tabId: CharacterTabId) => void;
}

const TAB_ICONS: Record<CharacterTabId, typeof Swords> = {
  combat: Swords,
  magic: Sparkles,
  inventory: Backpack,
  story: BookOpen,
  progression: TrendingUp,
};

export function CharacterTabNav({ activeTab, onSelectTab }: CharacterTabNavProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') {
      nextIndex = (index + 1) % CHARACTER_TABS.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + CHARACTER_TABS.length) % CHARACTER_TABS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = CHARACTER_TABS.length - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      const targetTab = CHARACTER_TABS[nextIndex];
      onSelectTab(targetTab.id);
      tabRefs.current[nextIndex]?.focus();
    }
  }

  return (
    <div className="border-b-2 border-[var(--rol-accent-primary)]">
      <div
        role="tablist"
        aria-label="Seccions de la fitxa de personatge"
        className="flex gap-1.5 overflow-x-auto pb-px"
      >
        {CHARACTER_TABS.map((tab, index) => {
          const Icon = TAB_ICONS[tab.id];
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelectTab(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-t-[var(--rol-radius-md)] border border-b-0 px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rol-accent-gold)] ${
                selected
                  ? 'border-[var(--rol-accent-primary)] bg-[var(--rol-accent-primary)] text-[var(--rol-accent-primary-ink)]'
                  : 'border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/75 text-[var(--rol-ink-secondary)] hover:bg-[var(--rol-bg-surface)] hover:text-[var(--rol-ink-primary)]'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{tab.label}</span>
              {tab.plannedIncrement && (
                <span
                  className={`hidden rounded px-1.5 py-0.5 text-[10px] sm:inline-block ${
                    selected
                      ? 'bg-black/20 text-[var(--rol-accent-primary-ink)]'
                      : 'bg-[var(--rol-bg-surface)] text-[var(--rol-ink-muted)]'
                  }`}
                >
                  {tab.plannedIncrement.replace('Increment ', '')}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
