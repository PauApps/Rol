'use client';

import { useState } from 'react';
import { CheckCircle2, Coins, Plus, Shield, Swords, Trash2 } from 'lucide-react';
import {
  getBackgroundEntry,
  getClassCreationRule,
  type Dnd5e2014InventoryItem,
  type InventoryCategory,
} from '@/domain/systems/dnd5e-2014';
import type { CampaignCreationConfig } from '@/domain/campaigns/creation-config';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { INVENTORY_CATEGORY_LABELS_CA } from '../types';
import {
  buildPreviewFromWizard,
  buildStarterInventoryList,
  type CharacterWizardState,
} from './wizard-state';

interface StepEquipmentProps {
  state: CharacterWizardState;
  config: CampaignCreationConfig;
  isGm: boolean;
  onChange: (updater: (prev: CharacterWizardState) => CharacterWizardState) => void;
}

export function StepEquipment({
  state,
  config,
  isGm,
  onChange,
}: StepEquipmentProps) {
  const [extraName, setExtraName] = useState('');
  const [extraCategory, setExtraCategory] = useState<InventoryCategory>('gear');
  const [extraDamage, setExtraDamage] = useState('');

  const classRule = state.classMode === 'official' ? getClassCreationRule(state.classId) : undefined;
  const bg = state.backgroundMode === 'catalog' ? getBackgroundEntry(state.backgroundId) : undefined;
  const defaultGold = (bg?.startingGold ?? 0) + (classRule?.startingGoldDefault ?? 0);
  const currentGold = state.startingGoldOverride ?? defaultGold;

  const { computed } = buildPreviewFromWizard(state, config, isGm);

  function handleSelectEquipmentOption(groupId: string, optionId: string) {
    onChange((prev) => {
      const nextSelections = { ...prev.equipmentSelections, [groupId]: optionId };
      return {
        ...prev,
        equipmentSelections: nextSelections,
        starterInventory: buildStarterInventoryList({
          classId: prev.classId,
          classMode: prev.classMode,
          equipmentSelections: nextSelections,
          backgroundId: prev.backgroundId,
          backgroundMode: prev.backgroundMode,
          previousStarter: prev.starterInventory,
        }),
      };
    });
  }

  function handleToggleEquipped(itemId: string, isCustom: boolean) {
    onChange((prev) => ({
      ...prev,
      starterInventory: isCustom
        ? prev.starterInventory
        : prev.starterInventory.map((i) =>
            i.id === itemId ? { ...i, equipped: !i.equipped } : i
          ),
      customInventory: isCustom
        ? prev.customInventory.map((i) =>
            i.id === itemId ? { ...i, equipped: !i.equipped } : i
          )
        : prev.customInventory,
    }));
  }

  function handleAddExtraItem() {
    const clean = extraName.trim();
    if (!clean) return;
    const item: Dnd5e2014InventoryItem = {
      id: `custom-${state.customInventory.length + 1}-${Date.now().toString(36)}`,
      name: clean,
      category: extraCategory,
      quantity: 1,
      weight: null,
      equipped: extraCategory === 'weapon' || extraCategory === 'armor' || extraCategory === 'shield',
      armorType: null,
      baseAc: null,
      acBonus: extraCategory === 'shield' ? 2 : null,
      requiresAttunement: false,
      attuned: false,
      weaponAbility: null,
      weaponAbilityOverride: null,
      weaponProficient: false,
      damage: extraCategory === 'weapon' ? extraDamage.trim() || null : null,
      damageType: null,
      weaponRange: null,
      weaponProperties: '',
      notes: '',
    };
    onChange((prev) => ({
      ...prev,
      customInventory: [...prev.customInventory, item],
    }));
    setExtraName('');
    setExtraDamage('');
  }

  return (
    <Card
      title="Pas 5 · Equipament inicial i monedes"
      subtitle="Selecciona els paquets d’equipament oficials de classe i trasfons. Les armes equipades generen atacs automàticament."
    >
      <div className="space-y-5">
        {/* Eleccions oficials d'equipament de classe */}
        {classRule && classRule.startingEquipmentChoices.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
              Paquets d’equipament de classe (PHB 2014)
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {classRule.startingEquipmentChoices.map((group) => {
                const selectedId = state.equipmentSelections[group.id] ?? group.options[0]?.id;
                return (
                  <div
                    key={group.id}
                    className="rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/35 p-3 space-y-2"
                  >
                    <p className="text-xs font-semibold text-[var(--rol-ink-primary)]">
                      {group.labelCa}
                    </p>
                    <div className="space-y-1.5">
                      {group.options.map((opt) => (
                        <label
                          key={opt.id}
                          className={`flex items-center gap-2 rounded border px-2.5 py-1.5 text-xs cursor-pointer ${
                            selectedId === opt.id
                              ? 'border-[var(--rol-accent-primary)] bg-[var(--rol-accent-primary)]/10 font-semibold text-[var(--rol-ink-primary)]'
                              : 'border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] text-[var(--rol-ink-secondary)]'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`eq-choice-${group.id}`}
                            checked={selectedId === opt.id}
                            onChange={() => handleSelectEquipmentOption(group.id, opt.id)}
                          />
                          <span>{opt.labelCa}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Previsualització de CA i atacs calculats pel motor */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rol-stat-plaque p-3 space-y-1">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
              <Shield className="h-3.5 w-3.5 text-[var(--rol-accent-gold)]" />
              CA resultant prevista
            </span>
            <p className="rol-heading-flourish text-xl font-bold text-[var(--rol-ink-primary)]">
              CA {computed.combat.armorClass.value}
            </p>
            <p className="text-xs text-[var(--rol-ink-secondary)]">
              {computed.combat.armorClass.sourceDescription}
            </p>
          </div>

          <div className="rol-stat-plaque p-3 space-y-1">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
              <Swords className="h-3.5 w-3.5 text-[var(--rol-accent-primary)]" />
              Atacs generats automàticament ({computed.combat.attacks.length})
            </span>
            {computed.combat.attacks.length === 0 ? (
              <p className="text-xs text-[var(--rol-ink-muted)]">Cap arma equipada actualment.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {computed.combat.attacks.map((atk) => (
                  <Badge key={atk.id} tone="gold">
                    {atk.name}: {atk.attackBonusDisplay}
                    {atk.damage ? ` (${atk.damage})` : ''}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Llista d'equipament resultant (amb toggle d'equipat) */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
            Equipament inclòs ({state.starterInventory.length + state.customInventory.length} entrades)
          </h3>
          <ul className="space-y-1.5 text-xs">
            {[
              ...state.starterInventory.map((item) => ({ item, isCustom: false })),
              ...state.customInventory.map((item) => ({ item, isCustom: true })),
            ].map(({ item, isCustom }) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] px-3 py-1.5"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-[var(--rol-ink-primary)]">
                    {item.name}
                    {item.quantity > 1 ? ` ×${item.quantity}` : ''}
                  </span>
                  <Badge tone="neutral">{INVENTORY_CATEGORY_LABELS_CA[item.category]}</Badge>
                  {item.equipped && (
                    <Badge tone="success">
                      <CheckCircle2 className="h-3 w-3" />
                      Equipat
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {(item.category === 'weapon' ||
                    item.category === 'armor' ||
                    item.category === 'shield') && (
                    <Button
                      size="sm"
                      variant={item.equipped ? 'primary' : 'secondary'}
                      onClick={() => handleToggleEquipped(item.id, isCustom)}
                    >
                      {item.equipped ? 'Equipat' : 'Equipar'}
                    </Button>
                  )}
                  {isCustom && (
                    <button
                      type="button"
                      aria-label={`Eliminar objecte ${item.name}`}
                      onClick={() =>
                        onChange((prev) => ({
                          ...prev,
                          customInventory: prev.customInventory.filter((c) => c.id !== item.id),
                        }))
                      }
                      className="rounded p-1 text-[var(--rol-status-danger-ink)] hover:bg-[var(--rol-status-danger-bg)] cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Afegir objecte extra + or inicial */}
        <div className="grid gap-4 border-t border-[var(--rol-border-subtle)] pt-4 sm:grid-cols-3">
          <div className="sm:col-span-2 flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[140px]">
              <label htmlFor="wizard-extra-item" className="mb-1 block text-xs font-medium">
                Afegir objecte addicional (opcional)
              </label>
              <input
                id="wizard-extra-item"
                type="text"
                value={extraName}
                onChange={(e) => setExtraName(e.target.value)}
                placeholder="Ex. Torxa / Poció de curació"
                className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2.5 py-1.5 text-xs"
              />
            </div>
            <div>
              <label htmlFor="wizard-extra-cat" className="mb-1 block text-xs font-medium">
                Categoria
              </label>
              <select
                id="wizard-extra-cat"
                value={extraCategory}
                onChange={(e) => setExtraCategory(e.target.value as InventoryCategory)}
                className="rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1.5 text-xs"
              >
                {Object.entries(INVENTORY_CATEGORY_LABELS_CA).map(([k, lbl]) => (
                  <option key={k} value={k}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>
            {extraCategory === 'weapon' && (
              <div>
                <label htmlFor="wizard-extra-dmg" className="mb-1 block text-xs font-medium">
                  Dany
                </label>
                <input
                  id="wizard-extra-dmg"
                  type="text"
                  value={extraDamage}
                  onChange={(e) => setExtraDamage(e.target.value)}
                  placeholder="1d6"
                  className="w-20 rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1.5 text-xs"
                />
              </div>
            )}
            <Button size="sm" variant="secondary" disabled={!extraName.trim()} onClick={handleAddExtraItem}>
              <Plus className="h-3.5 w-3.5" />
              Afegir
            </Button>
          </div>

          <div>
            <label
              htmlFor="wizard-starting-gold"
              className="mb-1 flex items-center gap-1.5 text-xs font-medium"
            >
              <Coins className="h-3.5 w-3.5 text-[var(--rol-accent-gold)]" />
              Or inicial (PO)
            </label>
            <input
              id="wizard-starting-gold"
              type="number"
              min={0}
              max={100000}
              value={currentGold}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  startingGoldOverride: Math.max(0, Math.trunc(Number(e.target.value) || 0)),
                }))
              }
              className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2.5 py-1.5 font-mono text-xs font-bold"
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
