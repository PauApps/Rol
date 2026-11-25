'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Minus,
  Package,
  Pencil,
  Plus,
  Shield,
  Sparkles,
  Swords,
  Trash2,
} from 'lucide-react';
import {
  ABILITY_KEYS,
  ABILITY_LABELS_CA,
  ABILITY_SHORT_CA,
  getAllowedOfficialWeaponAbilities,
  type AbilityKey,
  type ArmorType,
  type Dnd5e2014ClassEntry,
  type Dnd5e2014InventoryItem,
  type InventoryCategory,
} from '@/domain/systems/dnd5e-2014';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { canEditSheetField, type SheetAccessContext } from '../sheet-permissions';
import { ARMOR_TYPE_LABELS_CA, INVENTORY_CATEGORY_LABELS_CA } from '../types';

interface InventoryItemsCardProps {
  draftInventory: readonly Dnd5e2014InventoryItem[];
  classes: readonly Dnd5e2014ClassEntry[];
  maxAttunementSlots: number;
  access: SheetAccessContext;
  onChangeInventory: (next: Dnd5e2014InventoryItem[], deletedItemId?: string) => void;
}

const CATEGORIES_ORDER: readonly InventoryCategory[] = [
  'weapon',
  'armor',
  'shield',
  'gear',
  'magic_item',
  'treasure',
  'custom',
];

interface ItemFormState {
  name: string;
  category: InventoryCategory;
  quantity: number;
  weight: string;
  equipped: boolean;
  requiresAttunement: boolean;
  attuned: boolean;
  armorType: ArmorType | '';
  baseAc: string;
  acBonus: string;
  weaponAbility: AbilityKey | '';
  weaponAbilityOverride: AbilityKey | '';
  weaponProficient: boolean;
  damage: string;
  damageType: string;
  weaponRange: string;
  weaponProperties: string;
  notes: string;
}

function emptyItemForm(defaultCat: InventoryCategory = 'gear'): ItemFormState {
  return {
    name: '',
    category: defaultCat,
    quantity: 1,
    weight: '',
    equipped: false,
    requiresAttunement: false,
    attuned: false,
    armorType: defaultCat === 'armor' ? 'light' : '',
    baseAc: defaultCat === 'armor' ? '11' : '',
    acBonus: defaultCat === 'shield' ? '2' : '',
    weaponAbility: '',
    weaponAbilityOverride: '',
    weaponProficient: false,
    damage: '',
    damageType: '',
    weaponRange: '',
    weaponProperties: '',
    notes: '',
  };
}

function formFromItem(item: Dnd5e2014InventoryItem): ItemFormState {
  return {
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    weight: item.weight !== null ? String(item.weight) : '',
    equipped: item.equipped,
    requiresAttunement: item.requiresAttunement,
    attuned: item.attuned,
    armorType: item.armorType ?? '',
    baseAc: item.baseAc !== null ? String(item.baseAc) : '',
    acBonus: item.acBonus !== null ? String(item.acBonus) : '',
    weaponAbility: item.weaponAbility ?? '',
    weaponAbilityOverride: item.weaponAbilityOverride ?? '',
    weaponProficient: item.weaponProficient,
    damage: item.damage ?? '',
    damageType: item.damageType ?? '',
    weaponRange: item.weaponRange ?? '',
    weaponProperties: item.weaponProperties,
    notes: item.notes,
  };
}

export function InventoryItemsCard({
  draftInventory,
  classes,
  maxAttunementSlots,
  access,
  onChangeInventory,
}: InventoryItemsCardProps) {
  const canEditInventory = canEditSheetField('inventory', access);
  const canWeaponProf = canEditSheetField('inventory.weaponProficient', access);
  const canWeaponAbilityOverride = canEditSheetField('inventory.weaponAbilityOverride', access);

  const [categoryFilter, setCategoryFilter] = useState<InventoryCategory | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [attuneNotice, setAttuneNotice] = useState<string | null>(null);
  const [form, setForm] = useState<ItemFormState>(() => emptyItemForm());

  const currentAttunedCount = draftInventory.filter(
    (i) => i.requiresAttunement && i.attuned
  ).length;

  function openNewForm() {
    setEditingId(null);
    setAttuneNotice(null);
    setForm(emptyItemForm(categoryFilter === 'all' ? 'gear' : categoryFilter));
    setFormOpen(true);
  }

  function openEditForm(item: Dnd5e2014InventoryItem) {
    setEditingId(item.id);
    setAttuneNotice(null);
    setForm(formFromItem(item));
    setFormOpen(true);
  }

  function handleSaveItem() {
    const cleanName = form.name.trim();
    if (!cleanName) return;

    const existing = editingId ? draftInventory.find((i) => i.id === editingId) : undefined;
    const id =
      editingId ??
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `item-${crypto.randomUUID().slice(0, 8)}`
        : `item-${Date.now()}`);

    const parsedWeight = form.weight.trim() ? Number(form.weight) : null;
    const safeWeight =
      parsedWeight !== null && Number.isFinite(parsedWeight) && parsedWeight >= 0
        ? Math.min(100000, parsedWeight)
        : null;

    const parsedBaseAc = form.baseAc.trim() ? Math.trunc(Number(form.baseAc)) : null;
    const safeBaseAc =
      form.category === 'armor' && parsedBaseAc !== null && Number.isFinite(parsedBaseAc)
        ? Math.min(25, Math.max(1, parsedBaseAc))
        : null;

    const parsedAcBonus = form.acBonus.trim() ? Math.trunc(Number(form.acBonus)) : null;
    const safeAcBonus =
      (form.category === 'armor' || form.category === 'shield' || form.category === 'magic_item') &&
      parsedAcBonus !== null &&
      Number.isFinite(parsedAcBonus)
        ? Math.min(10, Math.max(-5, parsedAcBonus))
        : null;

    const wantAttuned = form.requiresAttunement && form.attuned;
    if (wantAttuned && !(existing?.attuned)) {
      const otherAttuned = draftInventory.filter(
        (i) => i.id !== editingId && i.requiresAttunement && i.attuned
      ).length;
      if (otherAttuned + 1 > maxAttunementSlots) {
        setAttuneNotice(
          `No es pot sintonitzar "${cleanName}": ja tens ${otherAttuned} de ${maxAttunementSlots} sintonització(ns) actives.`
        );
        return;
      }
    }

    const candidateForAbilities = {
      name: cleanName,
      weaponProperties: form.weaponProperties.trim(),
      weaponRange: form.weaponRange.trim() || null,
    };
    const allowedWeaponAbilities = getAllowedOfficialWeaponAbilities(candidateForAbilities, classes);
    let safeWeaponAbility: AbilityKey | null =
      form.category === 'weapon' && form.weaponAbility
        ? (form.weaponAbility as AbilityKey)
        : null;
    if (safeWeaponAbility !== null && !allowedWeaponAbilities.includes(safeWeaponAbility)) {
      safeWeaponAbility = null;
    }

    const entry: Dnd5e2014InventoryItem = {
      id,
      name: cleanName,
      category: form.category,
      quantity: Math.min(100000, Math.max(0, Number(form.quantity) || 0)),
      weight: safeWeight,
      equipped: form.equipped,
      armorType: form.category === 'armor' && form.armorType ? form.armorType : null,
      baseAc: safeBaseAc,
      acBonus: safeAcBonus,
      requiresAttunement: form.requiresAttunement,
      attuned: wantAttuned,
      weaponAbility: safeWeaponAbility,
      weaponAbilityOverride: canWeaponAbilityOverride
        ? form.category === 'weapon' && form.weaponAbilityOverride
          ? (form.weaponAbilityOverride as AbilityKey)
          : null
        : (existing?.weaponAbilityOverride ?? null),
      weaponProficient: canWeaponProf
        ? form.category === 'weapon'
          ? form.weaponProficient
          : false
        : (existing?.weaponProficient ?? false),
      damage: form.category === 'weapon' ? form.damage.trim() || null : null,
      damageType: form.category === 'weapon' ? form.damageType.trim() || null : null,
      weaponRange: form.category === 'weapon' ? form.weaponRange.trim() || null : null,
      weaponProperties: form.category === 'weapon' ? form.weaponProperties.trim() : '',
      notes: form.notes.trim(),
    };

    setAttuneNotice(null);
    if (editingId) {
      onChangeInventory(draftInventory.map((i) => (i.id === editingId ? entry : i)));
    } else {
      onChangeInventory([...draftInventory, entry]);
    }
    setFormOpen(false);
    setEditingId(null);
  }

  function handleToggleEquipped(item: Dnd5e2014InventoryItem) {
    if (!canEditInventory) return;
    setAttuneNotice(null);
    onChangeInventory(
      draftInventory.map((i) => (i.id === item.id ? { ...i, equipped: !i.equipped } : i))
    );
  }

  function handleToggleAttuned(item: Dnd5e2014InventoryItem) {
    if (!canEditInventory || !item.requiresAttunement) return;
    const nextAttuned = !item.attuned;
    if (nextAttuned && currentAttunedCount >= maxAttunementSlots) {
      setAttuneNotice(
        `No pots sintonitzar "${item.name}": ja has assolit el límit de ${maxAttunementSlots} objecte(s).`
      );
      return;
    }
    setAttuneNotice(null);
    onChangeInventory(
      draftInventory.map((i) => (i.id === item.id ? { ...i, attuned: nextAttuned } : i))
    );
  }

  function handleChangeQuantity(item: Dnd5e2014InventoryItem, nextQty: number) {
    if (!canEditInventory) return;
    const clamped = Math.min(100000, Math.max(0, nextQty));
    onChangeInventory(
      draftInventory.map((i) => (i.id === item.id ? { ...i, quantity: clamped } : i))
    );
  }

  function handleDeleteItem(id: string) {
    setAttuneNotice(null);
    onChangeInventory(
      draftInventory.filter((i) => i.id !== id),
      id
    );
    setConfirmDeleteId(null);
  }

  const formAllowedWeaponAbilities = getAllowedOfficialWeaponAbilities(
    {
      name: form.name,
      weaponProperties: form.weaponProperties,
      weaponRange: form.weaponRange.trim() || null,
    },
    classes
  );

  const visibleCategories = CATEGORIES_ORDER.filter((cat) => {
    if (categoryFilter !== 'all' && categoryFilter !== cat) return false;
    return draftInventory.some((i) => i.category === cat);
  });

  return (
    <Card
      title={`Inventari (${draftInventory.length} entrades)`}
      subtitle="Font única d’armes, armadures, escuts i equipament. Les armes equipades generen atacs a «Característiques i combat»."
      actions={
        canEditInventory && (
          <Button size="sm" variant="secondary" onClick={openNewForm}>
            <Plus className="h-3.5 w-3.5" />
            Afegir objecte
          </Button>
        )
      }
    >
      <div className="space-y-4">
        {attuneNotice && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-[var(--rol-radius-md)] border border-[var(--rol-status-danger-border)] bg-[var(--rol-status-danger-bg)] px-3 py-2 text-xs text-[var(--rol-status-danger-ink)]"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{attuneNotice}</span>
          </div>
        )}

        {/* Formulari d'afegir / editar objecte */}
        {formOpen && canEditInventory && (
          <div className="rounded-[var(--rol-radius-md)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface-alt)]/55 p-3.5 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--rol-ink-primary)]">
              {editingId ? 'Editar objecte d’inventari' : 'Nou objecte d’inventari'}
            </h4>

            <div className="grid gap-2.5 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <label htmlFor="inv-form-name" className="mb-1 block text-xs font-medium">
                  Nom
                </label>
                <input
                  id="inv-form-name"
                  type="text"
                  maxLength={120}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex. Espasa curta / Cota de malla"
                  className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2.5 py-1.5 text-sm"
                />
              </div>

              <div>
                <label htmlFor="inv-form-category" className="mb-1 block text-xs font-medium">
                  Categoria
                </label>
                <select
                  id="inv-form-category"
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      category: e.target.value as InventoryCategory,
                    }))
                  }
                  className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1.5 text-xs"
                >
                  {CATEGORIES_ORDER.map((cat) => (
                    <option key={cat} value={cat}>
                      {INVENTORY_CATEGORY_LABELS_CA[cat]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="inv-form-qty" className="mb-1 block text-xs font-medium">
                    Quantitat
                  </label>
                  <input
                    id="inv-form-qty"
                    type="number"
                    min={0}
                    max={100000}
                    value={form.quantity}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, quantity: Math.max(0, Number(e.target.value) || 0) }))
                    }
                    className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="inv-form-weight" className="mb-1 block text-xs font-medium">
                    Pes (u.)
                  </label>
                  <input
                    id="inv-form-weight"
                    type="number"
                    min={0}
                    max={100000}
                    step="0.1"
                    placeholder="—"
                    value={form.weight}
                    onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
                    className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-xs">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.equipped}
                  onChange={(e) => setForm((f) => ({ ...f, equipped: e.target.checked }))}
                />
                <span>Equipat</span>
              </label>

              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.requiresAttunement}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      requiresAttunement: e.target.checked,
                      attuned: e.target.checked ? f.attuned : false,
                    }))
                  }
                />
                <span>Requereix sintonització</span>
              </label>

              {form.requiresAttunement && (
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.attuned}
                    onChange={(e) => setForm((f) => ({ ...f, attuned: e.target.checked }))}
                  />
                  <span>Sintonitzat ara</span>
                </label>
              )}
            </div>

            {/* Camps específics d'arma */}
            {form.category === 'weapon' && (
              <div className="rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)]/75 p-2.5 space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--rol-accent-primary)]">
                  Propietats d’arma (D&D 5e)
                </p>
                <div className="grid gap-2 sm:grid-cols-4">
                  <div>
                    <label htmlFor="inv-wpn-damage" className="mb-1 block text-xs">
                      Dany
                    </label>
                    <input
                      id="inv-wpn-damage"
                      type="text"
                      maxLength={80}
                      placeholder="1d6 + 3"
                      value={form.damage}
                      onChange={(e) => setForm((f) => ({ ...f, damage: e.target.value }))}
                      className="w-full rounded border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="inv-wpn-dtype" className="mb-1 block text-xs">
                      Tipus de dany
                    </label>
                    <input
                      id="inv-wpn-dtype"
                      type="text"
                      maxLength={60}
                      placeholder="perforant / tallant"
                      value={form.damageType}
                      onChange={(e) => setForm((f) => ({ ...f, damageType: e.target.value }))}
                      className="w-full rounded border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="inv-wpn-range" className="mb-1 block text-xs">
                      Abast
                    </label>
                    <input
                      id="inv-wpn-range"
                      type="text"
                      maxLength={80}
                      placeholder="1,5 m o 24/96 m"
                      value={form.weaponRange}
                      onChange={(e) => setForm((f) => ({ ...f, weaponRange: e.target.value }))}
                      className="w-full rounded border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="inv-wpn-ability" className="mb-1 block text-xs">
                      Característica oficial
                    </label>
                    <select
                      id="inv-wpn-ability"
                      value={form.weaponAbility}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          weaponAbility: e.target.value as AbilityKey | '',
                        }))
                      }
                      className="w-full rounded border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs"
                    >
                      <option value="">
                        Automàtica ({formAllowedWeaponAbilities.map((a) => ABILITY_SHORT_CA[a]).join(' / ')})
                      </option>
                      {formAllowedWeaponAbilities.map((ab) => (
                        <option key={ab} value={ab}>
                          {ABILITY_LABELS_CA[ab]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="inv-wpn-props" className="mb-1 block text-xs">
                    Propietats (Finesse / Sutil, Llançament, Versàtil, Lleugera…)
                  </label>
                  <input
                    id="inv-wpn-props"
                    type="text"
                    maxLength={300}
                    value={form.weaponProperties}
                    onChange={(e) => setForm((f) => ({ ...f, weaponProperties: e.target.value }))}
                    className="w-full rounded border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs"
                  />
                </div>

                {(canWeaponAbilityOverride || canWeaponProf) && (
                  <div className="flex flex-wrap items-center gap-4 border-t border-[var(--rol-border-subtle)] pt-2 text-xs">
                    {canWeaponAbilityOverride && (
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="inv-wpn-ab-override"
                          className="text-[var(--rol-status-warning-ink)] font-medium"
                        >
                          Override aptitud (GM):
                        </label>
                        <select
                          id="inv-wpn-ab-override"
                          value={form.weaponAbilityOverride}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              weaponAbilityOverride: e.target.value as AbilityKey | '',
                            }))
                          }
                          className="rounded border border-[var(--rol-status-warning-border)] bg-[var(--rol-bg-surface)] px-2 py-0.5 text-xs"
                        >
                          <option value="">Cap</option>
                          {ABILITY_KEYS.map((k) => (
                            <option key={k} value={k}>
                              {ABILITY_LABELS_CA[k]}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {canWeaponProf && (
                      <label className="inline-flex items-center gap-1.5 text-[var(--rol-status-warning-ink)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.weaponProficient}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, weaponProficient: e.target.checked }))
                          }
                        />
                        <span>Competència excepcional GM</span>
                      </label>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Camps específics d'armadura / escut / objecte màgic */}
            {(form.category === 'armor' ||
              form.category === 'shield' ||
              form.category === 'magic_item') && (
              <div className="grid gap-2 sm:grid-cols-3 rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)]/75 p-2.5">
                {form.category === 'armor' && (
                  <>
                    <div>
                      <label htmlFor="inv-armor-type" className="mb-1 block text-xs">
                        Tipus d’armadura
                      </label>
                      <select
                        id="inv-armor-type"
                        value={form.armorType}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, armorType: e.target.value as ArmorType | '' }))
                        }
                        className="w-full rounded border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs"
                      >
                        <option value="">Sense especificar</option>
                        <option value="light">Lleugera</option>
                        <option value="medium">Mitjana</option>
                        <option value="heavy">Pesada</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="inv-armor-base" className="mb-1 block text-xs">
                        CA base
                      </label>
                      <input
                        id="inv-armor-base"
                        type="number"
                        min={1}
                        max={25}
                        placeholder="11..18"
                        value={form.baseAc}
                        onChange={(e) => setForm((f) => ({ ...f, baseAc: e.target.value }))}
                        className="w-full rounded border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs font-mono"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label htmlFor="inv-ac-bonus" className="mb-1 block text-xs">
                    Bonus de CA
                  </label>
                  <input
                    id="inv-ac-bonus"
                    type="number"
                    min={-5}
                    max={10}
                    placeholder={form.category === 'shield' ? '2' : '0'}
                    value={form.acBonus}
                    onChange={(e) => setForm((f) => ({ ...f, acBonus: e.target.value }))}
                    className="w-full rounded border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs font-mono"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="inv-form-notes" className="mb-1 block text-xs font-medium">
                Notes
              </label>
              <textarea
                id="inv-form-notes"
                rows={2}
                maxLength={1000}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFormOpen(false);
                  setEditingId(null);
                }}
              >
                Cancel·lar
              </Button>
              <Button size="sm" disabled={!form.name.trim()} onClick={handleSaveItem}>
                {editingId ? 'Aplicar canvis' : 'Afegir a l’esborrany'}
              </Button>
            </div>
          </div>
        )}

        {/* Filtres de categoria */}
        {draftInventory.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium cursor-pointer ${
                categoryFilter === 'all'
                  ? 'border-[var(--rol-accent-primary)] bg-[var(--rol-accent-primary)] text-[var(--rol-accent-primary-ink)]'
                  : 'border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] text-[var(--rol-ink-secondary)]'
              }`}
            >
              Tot ({draftInventory.length})
            </button>
            {CATEGORIES_ORDER.filter((cat) => draftInventory.some((i) => i.category === cat)).map(
              (cat) => {
                const count = draftInventory.filter((i) => i.category === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium cursor-pointer ${
                      categoryFilter === cat
                        ? 'border-[var(--rol-accent-primary)] bg-[var(--rol-accent-primary)] text-[var(--rol-accent-primary-ink)]'
                        : 'border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] text-[var(--rol-ink-secondary)]'
                    }`}
                  >
                    {INVENTORY_CATEGORY_LABELS_CA[cat]} ({count})
                  </button>
                );
              }
            )}
          </div>
        )}

        {draftInventory.length === 0 ? (
          <p className="text-sm text-[var(--rol-ink-muted)]">
            L’inventari és buit. Afegeix armes, armadures, escuts o objectes d’aventura.
          </p>
        ) : (
          <div className="space-y-4">
            {visibleCategories.map((cat) => {
              const items = draftInventory.filter((i) => i.category === cat);
              return (
                <div key={cat} className="space-y-2">
                  <h3 className="border-b border-[var(--rol-border-subtle)] pb-1 text-xs font-bold uppercase tracking-wider text-[var(--rol-accent-primary)]">
                    {INVENTORY_CATEGORY_LABELS_CA[cat]} ({items.length})
                  </h3>

                  <ul className="space-y-2">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/30 p-3 space-y-1.5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {item.category === 'weapon' ? (
                                <Swords className="h-3.5 w-3.5 shrink-0 text-[var(--rol-accent-primary)]" />
                              ) : item.category === 'armor' || item.category === 'shield' ? (
                                <Shield className="h-3.5 w-3.5 shrink-0 text-[var(--rol-accent-gold)]" />
                              ) : (
                                <Package className="h-3.5 w-3.5 shrink-0 text-[var(--rol-ink-muted)]" />
                              )}

                              <span className="font-semibold text-sm text-[var(--rol-ink-primary)]">
                                {item.name}
                              </span>

                              <Badge tone="neutral">{INVENTORY_CATEGORY_LABELS_CA[item.category]}</Badge>

                              {item.equipped && (
                                <Badge tone="success">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Equipat
                                </Badge>
                              )}
                              {item.requiresAttunement && (
                                <Badge tone={item.attuned ? 'gold' : 'neutral'}>
                                  <Sparkles className="h-3 w-3" />
                                  {item.attuned ? 'Sintonitzat' : 'Req. sintonització'}
                                </Badge>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--rol-ink-secondary)]">
                              {item.weight !== null && (
                                <span>
                                  <strong>Pes:</strong> {item.weight} u.
                                </span>
                              )}
                              {item.category === 'weapon' && item.damage && (
                                <span>
                                  <strong>Dany:</strong> {item.damage}
                                  {item.damageType ? ` ${item.damageType}` : ''}
                                </span>
                              )}
                              {item.category === 'weapon' && item.weaponRange && (
                                <span>
                                  <strong>Abast:</strong> {item.weaponRange}
                                </span>
                              )}
                              {item.category === 'weapon' && item.weaponAbility && (
                                <span>
                                  <strong>Aptitud:</strong> {ABILITY_SHORT_CA[item.weaponAbility]}
                                </span>
                              )}
                              {item.category === 'weapon' && item.weaponAbilityOverride && (
                                <Badge tone="warning">
                                  Aptitud GM: {ABILITY_SHORT_CA[item.weaponAbilityOverride]}
                                </Badge>
                              )}
                              {item.category === 'weapon' && item.weaponProficient && (
                                <Badge tone="warning">Competència GM</Badge>
                              )}
                              {item.category === 'armor' && item.armorType && (
                                <span>
                                  <strong>Tipus:</strong> {ARMOR_TYPE_LABELS_CA[item.armorType]}
                                </span>
                              )}
                              {item.category === 'armor' && item.baseAc !== null && (
                                <span>
                                  <strong>CA base:</strong> {item.baseAc}
                                </span>
                              )}
                              {item.acBonus !== null && item.acBonus !== 0 && (
                                <span>
                                  <strong>Bonus CA:</strong>{' '}
                                  {item.acBonus >= 0 ? `+${item.acBonus}` : item.acBonus}
                                </span>
                              )}
                            </div>

                            {item.weaponProperties && (
                              <p className="text-xs text-[var(--rol-ink-muted)]">
                                Propietats: {item.weaponProperties}
                              </p>
                            )}
                            {item.notes && (
                              <p className="text-xs text-[var(--rol-ink-muted)]">{item.notes}</p>
                            )}
                          </div>

                          {/* Controls d'acció i quantitat */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <div className="flex items-center gap-1 rounded border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] px-1.5 py-0.5 text-xs">
                              <span className="text-[var(--rol-ink-muted)]">Qt:</span>
                              {canEditInventory && (
                                <button
                                  type="button"
                                  disabled={item.quantity <= 0}
                                  aria-label={`Reduir quantitat de ${item.name}`}
                                  onClick={() => handleChangeQuantity(item, item.quantity - 1)}
                                  className="p-0.5 text-[var(--rol-ink-primary)] disabled:opacity-40 cursor-pointer"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                              )}
                              <span className="min-w-[1.25rem] text-center font-mono font-semibold">
                                {item.quantity}
                              </span>
                              {canEditInventory && (
                                <button
                                  type="button"
                                  aria-label={`Augmentar quantitat de ${item.name}`}
                                  onClick={() => handleChangeQuantity(item, item.quantity + 1)}
                                  className="p-0.5 text-[var(--rol-ink-primary)] cursor-pointer"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              )}
                            </div>

                            {canEditInventory && (
                              <>
                                <Button
                                  size="sm"
                                  variant={item.equipped ? 'primary' : 'secondary'}
                                  aria-pressed={item.equipped}
                                  onClick={() => handleToggleEquipped(item)}
                                >
                                  {item.equipped ? 'Equipat' : 'Equipar'}
                                </Button>

                                {item.requiresAttunement && (
                                  <Button
                                    size="sm"
                                    variant={item.attuned ? 'secondary' : 'ghost'}
                                    aria-pressed={item.attuned}
                                    onClick={() => handleToggleAttuned(item)}
                                  >
                                    {item.attuned ? 'Desintonitzar' : 'Sintonitzar'}
                                  </Button>
                                )}

                                <button
                                  type="button"
                                  aria-label={`Editar objecte ${item.name}`}
                                  onClick={() => openEditForm(item)}
                                  className="rounded p-1 text-[var(--rol-ink-secondary)] hover:bg-[var(--rol-bg-surface)] cursor-pointer"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>

                                {confirmDeleteId === item.id ? (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="danger"
                                      onClick={() => handleDeleteItem(item.id)}
                                    >
                                      Confirmar
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setConfirmDeleteId(null)}
                                    >
                                      No
                                    </Button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    aria-label={`Eliminar objecte ${item.name}`}
                                    onClick={() => setConfirmDeleteId(item.id)}
                                    className="rounded p-1 text-[var(--rol-status-danger-ink)] hover:bg-[var(--rol-status-danger-bg)] cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
