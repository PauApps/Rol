'use client';

import { useState } from 'react';
import { Flame, Minus, Plus, Trash2 } from 'lucide-react';
import type {
  ComputedCharacterResource,
  Dnd5e2014CustomResource,
  ResourceRecovery,
} from '@/domain/systems/dnd5e-2014';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { canEditSheetField, type SheetAccessContext } from '../sheet-permissions';
import { RECOVERY_LABELS_CA } from '../types';

interface ResourcesCardProps {
  computedResources: ComputedCharacterResource[];
  draftResourceUsage: Record<string, number>;
  draftCustomResources: readonly Dnd5e2014CustomResource[];
  access: SheetAccessContext;
  onChangeUsage: (usageKey: string, nextUsed: number) => void;
  onChangeCustomResources: (next: Dnd5e2014CustomResource[]) => void;
}

export function ResourcesCard({
  computedResources,
  draftResourceUsage,
  draftCustomResources,
  access,
  onChangeUsage,
  onChangeCustomResources,
}: ResourcesCardProps) {
  const canEditUsage = canEditSheetField('resourceUsage', access);
  const canEditCustom = canEditSheetField('customResources', access);

  const [addingCustom, setAddingCustom] = useState(false);
  const [confirmDeleteCustomId, setConfirmDeleteCustomId] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [customMaxUses, setCustomMaxUses] = useState(1);
  const [customRecovery, setCustomRecovery] = useState<ResourceRecovery>('long_rest');
  const [customDesc, setCustomDesc] = useState('');

  function handleAddCustomResource() {
    const cleanName = customName.trim();
    if (!cleanName) return;
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `res-${crypto.randomUUID().slice(0, 8)}`
        : `res-${Date.now()}`;

    const next: Dnd5e2014CustomResource = {
      id,
      name: cleanName,
      maxUses: Math.min(1000, Math.max(0, Math.trunc(customMaxUses))),
      recovery: customRecovery,
      description: customDesc.trim(),
    };
    onChangeCustomResources([...draftCustomResources, next]);
    setCustomName('');
    setCustomMaxUses(1);
    setCustomRecovery('long_rest');
    setCustomDesc('');
    setAddingCustom(false);
  }

  return (
    <Card
      title={`Recursos especials (${computedResources.length})`}
      subtitle="Recursos calculats de classe, subclasse i personalitzats sense recuperació automàtica."
      actions={
        canEditCustom && (
          <Button size="sm" variant="secondary" onClick={() => setAddingCustom((v) => !v)}>
            <Plus className="h-3.5 w-3.5" />
            {addingCustom ? 'Tancar' : 'Nou recurs (GM)'}
          </Button>
        )
      }
    >
      <div className="space-y-4">
        {addingCustom && canEditCustom && (
          <div className="rounded-[var(--rol-radius-md)] border border-[var(--rol-status-warning-border)] bg-[var(--rol-status-warning-bg)]/35 p-3 space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--rol-status-warning-ink)]">
              Afegir recurs personalitzat (GM / autoritzat)
            </h4>
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <label htmlFor="custom-res-name" className="mb-1 block text-xs font-medium">
                  Nom
                </label>
                <input
                  id="custom-res-name"
                  type="text"
                  maxLength={120}
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full rounded border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label htmlFor="custom-res-max" className="mb-1 block text-xs font-medium">
                  Usos màxims
                </label>
                <input
                  id="custom-res-max"
                  type="number"
                  min={0}
                  max={1000}
                  value={customMaxUses}
                  onChange={(e) => setCustomMaxUses(Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
                  className="w-full rounded border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs font-mono"
                />
              </div>
              <div>
                <label htmlFor="custom-res-recovery" className="mb-1 block text-xs font-medium">
                  Recuperació
                </label>
                <select
                  id="custom-res-recovery"
                  value={customRecovery}
                  onChange={(e) => setCustomRecovery(e.target.value as ResourceRecovery)}
                  className="w-full rounded border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs"
                >
                  {Object.entries(RECOVERY_LABELS_CA).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="custom-res-desc" className="mb-1 block text-xs font-medium">
                Descripció
              </label>
              <input
                id="custom-res-desc"
                type="text"
                maxLength={1000}
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                className="w-full rounded border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setAddingCustom(false)}>
                Cancel·lar
              </Button>
              <Button size="sm" disabled={!customName.trim()} onClick={handleAddCustomResource}>
                Afegir recurs
              </Button>
            </div>
          </div>
        )}

        {computedResources.length === 0 ? (
          <p className="text-sm text-[var(--rol-ink-muted)]">
            Aquest personatge no té recursos especials definits pel domini en aquest nivell.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {computedResources.map((res) => {
              const rawDraftUsed = draftResourceUsage[res.usageKey] ?? res.used;
              const draftUsed = res.unlimited
                ? Math.max(0, rawDraftUsed)
                : Math.min(res.totalUses ?? 0, Math.max(0, rawDraftUsed));
              const maxAllowed = res.unlimited ? 1000 : (res.totalUses ?? 0);

              return (
                <li
                  key={res.key}
                  className="rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/35 p-3 space-y-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Flame className="h-3.5 w-3.5 shrink-0 text-[var(--rol-accent-primary)]" />
                        <span className="font-semibold text-sm text-[var(--rol-ink-primary)]">
                          {res.name}
                        </span>
                        <Badge tone={res.isCustom ? 'warning' : 'gold'}>{res.source}</Badge>
                        <Badge tone="neutral">{RECOVERY_LABELS_CA[res.recovery]}</Badge>
                      </div>
                      {res.description && (
                        <p className="text-xs text-[var(--rol-ink-secondary)]">{res.description}</p>
                      )}
                      {res.usageKey !== res.key && (
                        <p className="text-[11px] text-[var(--rol-ink-muted)]">
                          Comparteix reserva d’usos ({res.usageKey}).
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <div className="text-xs font-mono text-[var(--rol-ink-secondary)]">
                        {res.unlimited ? (
                          <span>Il·limitat (gastats: {draftUsed})</span>
                        ) : (
                          <span>
                            Disp: <strong>{res.available}</strong> / Tot:{' '}
                            <strong>{res.totalUses}</strong>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={!canEditUsage || draftUsed <= 0}
                          aria-label={`Reduir usos gastats de ${res.name}`}
                          onClick={() => onChangeUsage(res.usageKey, Math.max(0, draftUsed - 1))}
                          className="rounded border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] p-1 text-[var(--rol-ink-primary)] disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={maxAllowed}
                          disabled={!canEditUsage}
                          aria-label={`Usos gastats de ${res.name}`}
                          value={draftUsed}
                          onChange={(e) => {
                            const n = Math.trunc(Number(e.target.value) || 0);
                            const clamped = res.unlimited
                              ? Math.max(0, n)
                              : Math.min(maxAllowed, Math.max(0, n));
                            onChangeUsage(res.usageKey, clamped);
                          }}
                          className="w-14 rounded border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-1.5 py-0.5 text-center font-mono text-xs font-semibold disabled:opacity-70"
                        />
                        <button
                          type="button"
                          disabled={!canEditUsage || (!res.unlimited && draftUsed >= maxAllowed)}
                          aria-label={`Augmentar usos gastats de ${res.name}`}
                          onClick={() =>
                            onChangeUsage(
                              res.usageKey,
                              res.unlimited ? draftUsed + 1 : Math.min(maxAllowed, draftUsed + 1)
                            )
                          }
                          className="rounded border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] p-1 text-[var(--rol-ink-primary)] disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Gestió de definicions personalitzades (només GM / autoritzat) */}
        {canEditCustom && draftCustomResources.length > 0 && (
          <div className="border-t border-[var(--rol-border-subtle)] pt-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
              Definicions de recursos personalitzats (GM)
            </p>
            <ul className="space-y-1.5 text-xs">
              {draftCustomResources.map((cr) => (
                <li
                  key={cr.id}
                  className="flex items-center justify-between gap-2 rounded border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] px-2.5 py-1.5"
                >
                  <span>
                    <strong>{cr.name}</strong> · {cr.maxUses} usos ({RECOVERY_LABELS_CA[cr.recovery]})
                  </span>
                  {confirmDeleteCustomId === cr.id ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          onChangeCustomResources(draftCustomResources.filter((r) => r.id !== cr.id));
                          setConfirmDeleteCustomId(null);
                        }}
                      >
                        Confirmar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmDeleteCustomId(null)}
                      >
                        No
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Eliminar recurs personalitzat ${cr.name}`}
                      onClick={() => setConfirmDeleteCustomId(cr.id)}
                      className="rounded p-1 text-[var(--rol-status-danger-ink)] hover:bg-[var(--rol-status-danger-bg)] cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
