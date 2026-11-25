'use client';

import type { SheetAccessContext } from '../sheet-permissions';
import type { CharacterSheetDraft, CharacterSheetRecord } from '../types';
import { CurrencyCard } from './CurrencyCard';
import { InventoryItemsCard } from './InventoryItemsCard';
import { InventorySummaryBar } from './InventorySummaryBar';

interface InventoryTabProps {
  character: CharacterSheetRecord;
  draft: CharacterSheetDraft;
  access: SheetAccessContext;
  onUpdateDraft: (updater: (prev: CharacterSheetDraft) => CharacterSheetDraft) => void;
}

export function InventoryTab({
  character,
  draft,
  access,
  onUpdateDraft,
}: InventoryTabProps) {
  const { computed, sheetData } = character;
  const maxAttunementSlots =
    draft.attunement.limitOverride ?? computed.inventorySummary.attunement.maxSlots;

  return (
    <div
      role="tabpanel"
      id="panel-inventory"
      aria-labelledby="tab-inventory"
      className="space-y-6"
    >
      <InventorySummaryBar
        computedInventory={computed.inventorySummary}
        computedArmorClass={computed.combat.armorClass}
        draftInventory={draft.inventory}
        draftLimitOverride={draft.attunement.limitOverride}
        access={access}
        onChangeLimitOverride={(next) =>
          onUpdateDraft((prev) => ({
            ...prev,
            attunement: { limitOverride: next },
          }))
        }
      />

      <CurrencyCard
        draftCurrency={draft.currency}
        access={access}
        onChangeCoin={(coin, value) =>
          onUpdateDraft((prev) => ({
            ...prev,
            currency: { ...prev.currency, [coin]: value },
          }))
        }
      />

      <InventoryItemsCard
        draftInventory={draft.inventory}
        classes={sheetData.raceAndClass.classes}
        maxAttunementSlots={maxAttunementSlots}
        access={access}
        onChangeInventory={(nextInventory, deletedItemId) =>
          onUpdateDraft((prev) => ({
            ...prev,
            inventory: nextInventory,
            attacks: deletedItemId
              ? prev.attacks.filter((atk) => atk.inventoryItemId !== deletedItemId)
              : prev.attacks,
          }))
        }
      />
    </div>
  );
}
