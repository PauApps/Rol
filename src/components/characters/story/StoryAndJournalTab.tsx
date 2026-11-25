'use client';

import { type SheetAccessContext } from '../sheet-permissions';
import type { CharacterSheetDraft, CharacterSheetRecord } from '../types';
import { CharacterJournalCard } from './CharacterJournalCard';
import { CharacterStoryCard } from './CharacterStoryCard';

interface StoryAndJournalTabProps {
  character: CharacterSheetRecord;
  draft: CharacterSheetDraft;
  access: SheetAccessContext;
  onUpdateDraft: (updater: (prev: CharacterSheetDraft) => CharacterSheetDraft) => void;
}

export function StoryAndJournalTab({
  character,
  draft,
  access,
  onUpdateDraft,
}: StoryAndJournalTabProps) {
  return (
    <div
      role="tabpanel"
      id="panel-story"
      aria-labelledby="tab-story"
      className="space-y-5"
    >
      <CharacterStoryCard
        character={character}
        draft={draft}
        access={access}
        onUpdateDraft={onUpdateDraft}
      />
      <CharacterJournalCard
        character={character}
        draft={draft}
        access={access}
        onUpdateDraft={onUpdateDraft}
      />
    </div>
  );
}
