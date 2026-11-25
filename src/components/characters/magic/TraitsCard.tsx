'use client';

import { useState } from 'react';
import { Pencil, Plus, Scroll, Trash2 } from 'lucide-react';
import type { Dnd5e2014TraitEntry } from '@/domain/systems/dnd5e-2014';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { canEditSheetField, type SheetAccessContext } from '../sheet-permissions';

interface TraitsCardProps {
  draftTraits: readonly Dnd5e2014TraitEntry[];
  access: SheetAccessContext;
  onChangeTraits: (next: Dnd5e2014TraitEntry[]) => void;
}

function classifyTraitTone(source: string | null): BadgeTone {
  if (!source) return 'neutral';
  const norm = source.toLowerCase();
  if (norm.includes('raç') || norm.includes('race') || norm.includes('llinatge')) return 'success';
  if (norm.includes('subclasse') || norm.includes('domini') || norm.includes('cercle') || norm.includes('escola')) {
    return 'gold';
  }
  if (norm.includes('dot') || norm.includes('feat')) return 'warning';
  if (norm.includes('classe') || norm.includes('class')) return 'gold';
  return 'neutral';
}

export function TraitsCard({ draftTraits, access, onChangeTraits }: TraitsCardProps) {
  const canEditTraits = canEditSheetField('traitsAndFeatures', access);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [source, setSource] = useState('');
  const [levelUnlocked, setLevelUnlocked] = useState<string>('');
  const [description, setDescription] = useState('');

  function openNew() {
    setEditingId(null);
    setName('');
    setSource('');
    setLevelUnlocked('');
    setDescription('');
    setFormOpen(true);
  }

  function openEdit(trait: Dnd5e2014TraitEntry) {
    setEditingId(trait.id);
    setName(trait.name);
    setSource(trait.source ?? '');
    setLevelUnlocked(trait.levelUnlocked !== null ? String(trait.levelUnlocked) : '');
    setDescription(trait.description);
    setFormOpen(true);
  }

  function handleSaveTrait() {
    const cleanName = name.trim();
    if (!cleanName) return;

    const id =
      editingId ??
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `trait-${crypto.randomUUID().slice(0, 8)}`
        : `trait-${Date.now()}`);

    const parsedLvl = levelUnlocked.trim() ? Math.trunc(Number(levelUnlocked)) : null;
    const safeLvl =
      parsedLvl !== null && Number.isFinite(parsedLvl)
        ? Math.min(20, Math.max(1, parsedLvl))
        : null;

    const entry: Dnd5e2014TraitEntry = {
      id,
      name: cleanName,
      source: source.trim() || null,
      levelUnlocked: safeLvl,
      description: description.trim(),
    };

    if (editingId) {
      onChangeTraits(draftTraits.map((t) => (t.id === editingId ? entry : t)));
    } else {
      onChangeTraits([...draftTraits, entry]);
    }
    setFormOpen(false);
    setEditingId(null);
  }

  return (
    <Card
      title={`Trets i aptituds (${draftTraits.length})`}
      subtitle="Trets racials, de classe, subclasse, dots i aptituds especials."
      actions={
        canEditTraits && (
          <Button size="sm" variant="secondary" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" />
            Nou tret
          </Button>
        )
      }
    >
      <div className="space-y-4">
        {formOpen && canEditTraits && (
          <div className="rounded-[var(--rol-radius-md)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface-alt)]/55 p-3.5 space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--rol-ink-primary)]">
              {editingId ? 'Editar tret o aptitud' : 'Afegir tret o aptitud'}
            </h4>

            <div className="grid gap-2.5 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <label htmlFor="trait-form-name" className="mb-1 block text-xs font-medium">
                  Nom
                </label>
                <input
                  id="trait-form-name"
                  type="text"
                  maxLength={140}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex. Visió en la foscor / Dot Alert"
                  className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2.5 py-1.5 text-sm"
                />
              </div>

              <div>
                <label htmlFor="trait-form-source" className="mb-1 block text-xs font-medium">
                  Procedència
                </label>
                <input
                  id="trait-form-source"
                  type="text"
                  maxLength={100}
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Raça, Classe, Subclasse, Dot…"
                  className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1.5 text-xs"
                />
              </div>

              <div>
                <label htmlFor="trait-form-level" className="mb-1 block text-xs font-medium">
                  Nivell (opcional)
                </label>
                <input
                  id="trait-form-level"
                  type="number"
                  min={1}
                  max={20}
                  value={levelUnlocked}
                  onChange={(e) => setLevelUnlocked(e.target.value)}
                  placeholder="—"
                  className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1.5 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label htmlFor="trait-form-desc" className="mb-1 block text-xs font-medium">
                Descripció
              </label>
              <textarea
                id="trait-form-desc"
                rows={2}
                maxLength={4000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] px-2.5 py-1.5 text-xs"
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
              <Button size="sm" disabled={!name.trim()} onClick={handleSaveTrait}>
                {editingId ? 'Aplicar canvis' : 'Afegir a l’esborrany'}
              </Button>
            </div>
          </div>
        )}

        {draftTraits.length === 0 ? (
          <p className="text-sm text-[var(--rol-ink-muted)]">
            No hi ha trets ni aptituds enregistrats en aquesta fitxa encara.
          </p>
        ) : (
          <ul className="space-y-2">
            {draftTraits.map((trait) => (
              <li
                key={trait.id}
                className="rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/30 p-3 space-y-1"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <Scroll className="h-3.5 w-3.5 shrink-0 text-[var(--rol-accent-gold)]" />
                    <span className="font-semibold text-sm text-[var(--rol-ink-primary)]">
                      {trait.name}
                    </span>
                    {trait.source && (
                      <Badge tone={classifyTraitTone(trait.source)}>{trait.source}</Badge>
                    )}
                    {trait.levelUnlocked !== null && (
                      <Badge tone="neutral">Nivell {trait.levelUnlocked}</Badge>
                    )}
                  </div>

                  {canEditTraits && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Editar tret ${trait.name}`}
                        onClick={() => openEdit(trait)}
                        className="rounded p-1 text-[var(--rol-ink-secondary)] hover:bg-[var(--rol-bg-surface)] cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {confirmDeleteId === trait.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              onChangeTraits(draftTraits.filter((t) => t.id !== trait.id));
                              setConfirmDeleteId(null);
                            }}
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
                          aria-label={`Eliminar tret ${trait.name}`}
                          onClick={() => setConfirmDeleteId(trait.id)}
                          className="rounded p-1 text-[var(--rol-status-danger-ink)] hover:bg-[var(--rol-status-danger-bg)] cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {trait.description && (
                  <p className="text-xs text-[var(--rol-ink-secondary)] whitespace-pre-line">
                    {trait.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
