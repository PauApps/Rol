'use client';

import { useState } from 'react';
import { type SheetAccessContext } from '../sheet-permissions';
import type { CharacterSheetDraft, CharacterSheetRecord } from '../types';
import { LevelHistoryCard } from './LevelHistoryCard';
import { LevelUpModal } from './LevelUpModal';
import { MulticlassBreakdownCard } from './MulticlassBreakdownCard';
import { ProgressionSummaryCard } from './ProgressionSummaryCard';

interface ProgressionAndEvolutionTabProps {
  campaignId: string;
  character: CharacterSheetRecord;
  draft: CharacterSheetDraft;
  access: SheetAccessContext;
  hasUnsavedChanges: boolean;
  onUpdateDraft: (updater: (prev: CharacterSheetDraft) => CharacterSheetDraft) => void;
  onLevelUpApplied: (nextCharacter: CharacterSheetRecord, warnings: string[]) => void;
  onSyncFromServer?: () => Promise<void>;
}

export function ProgressionAndEvolutionTab({
  campaignId,
  character,
  draft,
  access,
  hasUnsavedChanges,
  onUpdateDraft,
  onLevelUpApplied,
  onSyncFromServer,
}: ProgressionAndEvolutionTabProps) {
  const [levelUpOpen, setLevelUpOpen] = useState(false);

  return (
    <div
      role="tabpanel"
      id="panel-progression"
      aria-labelledby="tab-progression"
      className="space-y-5"
    >
      <ProgressionSummaryCard
        character={character}
        draft={draft}
        access={access}
        hasUnsavedChanges={hasUnsavedChanges}
        onUpdateDraft={onUpdateDraft}
        onOpenLevelUp={() => setLevelUpOpen(true)}
      />

      <MulticlassBreakdownCard character={character} />

      <LevelHistoryCard draft={draft} access={access} onUpdateDraft={onUpdateDraft} />

      {levelUpOpen && (
        <LevelUpModal
          key={`lvlup-${character.id}-${character.updatedAt}`}
          open={levelUpOpen}
          onClose={() => setLevelUpOpen(false)}
          campaignId={campaignId}
          character={character}
          access={access}
          onApplied={onLevelUpApplied}
          onSyncFromServer={onSyncFromServer}
        />
      )}
    </div>
  );
}
