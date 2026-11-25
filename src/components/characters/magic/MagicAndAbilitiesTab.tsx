'use client';

import type { SheetAccessContext } from '../sheet-permissions';
import type { CharacterSheetDraft, CharacterSheetRecord } from '../types';
import { ResourcesCard } from './ResourcesCard';
import { SpellSlotsCard } from './SpellSlotsCard';
import { SpellcastingSummaryCard } from './SpellcastingSummaryCard';
import { SpellsListCard } from './SpellsListCard';
import { TraitsCard } from './TraitsCard';

interface MagicAndAbilitiesTabProps {
  character: CharacterSheetRecord;
  draft: CharacterSheetDraft;
  access: SheetAccessContext;
  onUpdateDraft: (updater: (prev: CharacterSheetDraft) => CharacterSheetDraft) => void;
}

export function MagicAndAbilitiesTab({
  character,
  draft,
  access,
  onUpdateDraft,
}: MagicAndAbilitiesTabProps) {
  const { computed, sheetData } = character;

  return (
    <div
      role="tabpanel"
      id="panel-magic"
      aria-labelledby="tab-magic"
      className="space-y-6"
    >
      <SpellcastingSummaryCard
        computedSpellcasting={computed.spellcasting}
        classes={sheetData.raceAndClass.classes}
        draftSpellcasting={draft.spellcasting}
        access={access}
        onChangeSpellcasting={(patch) =>
          onUpdateDraft((prev) => ({
            ...prev,
            spellcasting: { ...prev.spellcasting, ...patch },
          }))
        }
      />

      <SpellSlotsCard
        computedSpellcasting={computed.spellcasting}
        draftSlotsUsed={draft.spellSlotsUsed}
        draftSlotOverrides={draft.spellSlotOverrides}
        access={access}
        onChangeSlotUsed={(slotKey, nextUsed) =>
          onUpdateDraft((prev) => ({
            ...prev,
            spellSlotsUsed: { ...prev.spellSlotsUsed, [slotKey]: nextUsed },
          }))
        }
        onChangeSlotOverride={(slotKey, nextTotal) =>
          onUpdateDraft((prev) => {
            const nextOverrides = { ...prev.spellSlotOverrides };
            if (nextTotal === null) {
              delete nextOverrides[slotKey];
            } else {
              nextOverrides[slotKey] = nextTotal;
            }
            return { ...prev, spellSlotOverrides: nextOverrides };
          })
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-7">
          <SpellsListCard
            computedSpellcasting={computed.spellcasting}
            draftSpells={draft.spells}
            draftUsesSpellbook={draft.spellcasting.usesSpellbook}
            access={access}
            onChangeSpells={(nextSpells) =>
              onUpdateDraft((prev) => ({ ...prev, spells: nextSpells }))
            }
          />
        </div>

        <div className="space-y-6 lg:col-span-5">
          <ResourcesCard
            computedResources={computed.resources}
            draftResourceUsage={draft.resourceUsage}
            draftCustomResources={draft.customResources}
            access={access}
            onChangeUsage={(usageKey, nextUsed) =>
              onUpdateDraft((prev) => ({
                ...prev,
                resourceUsage: { ...prev.resourceUsage, [usageKey]: nextUsed },
              }))
            }
            onChangeCustomResources={(next) =>
              onUpdateDraft((prev) => ({ ...prev, customResources: next }))
            }
          />

          <TraitsCard
            draftTraits={draft.traitsAndFeatures}
            access={access}
            onChangeTraits={(next) =>
              onUpdateDraft((prev) => ({ ...prev, traitsAndFeatures: next }))
            }
          />
        </div>
      </div>
    </div>
  );
}
