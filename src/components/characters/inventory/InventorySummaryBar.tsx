'use client';

import { AlertTriangle, Backpack, Scale, Shield, Sparkles } from 'lucide-react';
import type { ComputedDnd5e2014Snapshot, Dnd5e2014InventoryItem } from '@/domain/systems/dnd5e-2014';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { canEditSheetField, type SheetAccessContext } from '../sheet-permissions';

interface InventorySummaryBarProps {
  computedInventory: ComputedDnd5e2014Snapshot['inventorySummary'];
  computedArmorClass: ComputedDnd5e2014Snapshot['combat']['armorClass'];
  draftInventory: readonly Dnd5e2014InventoryItem[];
  draftLimitOverride: number | null;
  access: SheetAccessContext;
  onChangeLimitOverride: (next: number | null) => void;
}

export function InventorySummaryBar({
  computedInventory,
  computedArmorClass,
  draftInventory,
  draftLimitOverride,
  access,
  onChangeLimitOverride,
}: InventorySummaryBarProps) {
  const canEditAttuneLimit = canEditSheetField('attunement.limitOverride', access);

  const serverMaxSlots = computedInventory.attunement.maxSlots;
  const effectiveMaxSlots =
    canEditAttuneLimit && draftLimitOverride !== null ? draftLimitOverride : serverMaxSlots;
  const draftAttunedItems = draftInventory.filter((i) => i.requiresAttunement && i.attuned);
  const draftAttunedCount = draftAttunedItems.length;
  const atOrOverLimit = draftAttunedCount >= effectiveMaxSlots && effectiveMaxSlots > 0;
  const overLimit = draftAttunedCount > effectiveMaxSlots;

  return (
    <Card
      title="Resum d’equipament, defensa i sintonització"
      subtitle="Totals calculats pel servidor sobre l’inventari desat. Els canvis es recalculen en desar."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Objectes i pes */}
        <div className="rol-stat-plaque p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
            <Scale className="h-3.5 w-3.5 text-[var(--rol-accent-gold)]" />
            <span>Pes i recompte</span>
          </div>
          <p className="rol-heading-flourish text-xl font-bold text-[var(--rol-ink-primary)]">
            {computedInventory.totalWeight}
          </p>
          <p className="text-xs text-[var(--rol-ink-secondary)]">
            {computedInventory.totalItemsCount} unitats totals a l’inventari desat.
          </p>
          <p className="text-[11px] text-[var(--rol-ink-muted)]">
            Capacitat màxima de càrrega no calculada pel domini actual.
          </p>
        </div>

        {/* Armadura i escut actius -> CA */}
        <div className="rol-stat-plaque p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
            <Shield className="h-3.5 w-3.5 text-[var(--rol-accent-primary)]" />
            <span>CA i protecció activa</span>
          </div>
          <p className="rol-heading-flourish text-xl font-bold text-[var(--rol-ink-primary)]">
            CA {computedArmorClass.value}
          </p>
          <p className="text-xs text-[var(--rol-ink-secondary)]">
            {computedArmorClass.sourceDescription}
          </p>
          <p className="text-[11px] text-[var(--rol-ink-muted)]">
            {computedInventory.equippedArmorName || computedInventory.equippedShieldName
              ? [computedInventory.equippedArmorName, computedInventory.equippedShieldName]
                  .filter(Boolean)
                  .join(' + ')
              : 'Cap armadura ni escut equipat.'}
          </p>
        </div>

        {/* Sintonització màgica */}
        <div className="rol-stat-plaque p-3 space-y-1.5 sm:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
              <Sparkles className="h-3.5 w-3.5 text-[var(--rol-accent-gold)]" />
              Sintonització d’objectes màgics
            </span>
            <Badge tone={overLimit ? 'danger' : atOrOverLimit ? 'warning' : 'gold'}>
              {draftAttunedCount} / {effectiveMaxSlots} sintonitzats
            </Badge>
          </div>

          {draftAttunedItems.length === 0 ? (
            <p className="text-xs text-[var(--rol-ink-muted)]">
              Cap objecte sintonitzat actualment (límit oficial per defecte: 3).
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {draftAttunedItems.map((item) => (
                <Badge key={item.id} tone="neutral">
                  {item.name}
                </Badge>
              ))}
            </div>
          )}

          {atOrOverLimit && (
            <p
              className={`flex items-center gap-1.5 text-xs font-medium ${
                overLimit
                  ? 'text-[var(--rol-status-danger-ink)]'
                  : 'text-[var(--rol-status-warning-ink)]'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {overLimit
                ? `Supera el límit permès de ${effectiveMaxSlots} objecte(s) sintonitzats.`
                : `S’ha assolit el límit actual de ${effectiveMaxSlots} sintonització(ns).`}
            </p>
          )}

          {canEditAttuneLimit && (
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--rol-border-subtle)] pt-1.5 text-xs">
              <label
                htmlFor="attunement-limit-override"
                className="font-medium text-[var(--rol-status-warning-ink)]"
              >
                Límit GM (override):
              </label>
              <input
                id="attunement-limit-override"
                type="number"
                min={0}
                max={10}
                placeholder="3 (oficial)"
                value={draftLimitOverride ?? ''}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  if (!raw) {
                    onChangeLimitOverride(null);
                  } else {
                    const n = Math.trunc(Number(raw));
                    if (Number.isFinite(n)) {
                      onChangeLimitOverride(Math.min(10, Math.max(0, n)));
                    }
                  }
                }}
                className="w-24 rounded border border-[var(--rol-status-warning-border)] bg-[var(--rol-bg-surface)] px-2 py-0.5 font-mono text-xs"
              />
            </div>
          )}

          {!canEditAttuneLimit && computedInventory.attunement.isOverridden && (
            <p className="text-[11px] text-[var(--rol-ink-muted)]">
              <Backpack className="mr-1 inline h-3 w-3" />
              Límit ajustat pel Director de Joc.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
