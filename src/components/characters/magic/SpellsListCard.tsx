'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  BookMarked,
  CheckCircle2,
  Circle,
  Lock,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  DND5E_CLASSES,
  type ComputedSpellcasting,
  type ComputedSpellcastingSource,
  type Dnd5e2014SpellEntry,
  type SpellSourceType,
} from '@/domain/systems/dnd5e-2014';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { canEditSheetField, type SheetAccessContext } from '../sheet-permissions';
import { SPELL_SOURCE_TYPE_LABELS_CA } from '../types';

interface SpellsListCardProps {
  computedSpellcasting: ComputedSpellcasting | null;
  draftSpells: readonly Dnd5e2014SpellEntry[];
  draftUsesSpellbook: boolean;
  access: SheetAccessContext;
  onChangeSpells: (nextSpells: Dnd5e2014SpellEntry[]) => void;
}

const SPELL_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

interface SpellFormState {
  level: number;
  name: string;
  school: string;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  sourceType: SpellSourceType;
  sourceClassId: string;
  alwaysPrepared: boolean;
  prepared: boolean;
  inSpellbook: boolean;
  ritual: boolean;
  concentration: boolean;
  notes: string;
}

function emptySpellForm(defaultClassId: string, defaultSpellbook: boolean): SpellFormState {
  return {
    level: 1,
    name: '',
    school: '',
    castingTime: '1 acció',
    range: '18 m',
    components: 'V, S',
    duration: 'Instantània',
    sourceType: 'class',
    sourceClassId: defaultClassId,
    alwaysPrepared: false,
    prepared: false,
    inSpellbook: defaultSpellbook,
    ritual: false,
    concentration: false,
    notes: '',
  };
}

function formFromSpell(spell: Dnd5e2014SpellEntry): SpellFormState {
  return {
    level: spell.level,
    name: spell.name,
    school: spell.school ?? '',
    castingTime: spell.castingTime,
    range: spell.range,
    components: spell.components,
    duration: spell.duration,
    sourceType: spell.sourceType,
    sourceClassId: spell.sourceClassId ?? '',
    alwaysPrepared: spell.alwaysPrepared,
    prepared: spell.prepared,
    inSpellbook: spell.inSpellbook,
    ritual: spell.ritual,
    concentration: spell.concentration,
    notes: spell.notes,
  };
}

function resolveSpellTargetSource(
  spell: Pick<Dnd5e2014SpellEntry, 'sourceType' | 'sourceClassId' | 'inSpellbook'>,
  sources: readonly ComputedSpellcastingSource[]
): ComputedSpellcastingSource | undefined {
  if (spell.sourceType !== 'class' && spell.sourceType !== 'pact') {
    return undefined;
  }
  if (spell.sourceClassId) {
    const matched = sources.find((s) => s.classId === spell.sourceClassId);
    if (matched) return matched;
  }
  if (spell.sourceType === 'pact') {
    const warlock = sources.find((s) => s.progression === 'pact');
    if (warlock) return warlock;
  }
  if (sources.length === 1) {
    return sources[0];
  }
  if (spell.inSpellbook) {
    const sb = sources.find((s) => s.usesSpellbook);
    if (sb) return sb;
  }
  return sources[0];
}

export function SpellsListCard({
  computedSpellcasting,
  draftSpells,
  draftUsesSpellbook,
  access,
  onChangeSpells,
}: SpellsListCardProps) {
  const canEditSpells = canEditSheetField('spells', access);
  const sources = computedSpellcasting?.sources ?? [];
  const hasSpellbook =
    draftUsesSpellbook ||
    Boolean(computedSpellcasting?.usesSpellbook) ||
    draftSpells.some((s) => s.inSpellbook);

  const [levelFilter, setLevelFilter] = useState<number | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [limitNotice, setLimitNotice] = useState<string | null>(null);
  const [form, setForm] = useState<SpellFormState>(() =>
    emptySpellForm(sources[0]?.classId ?? '', false)
  );

  // Compute draft prepared counts grouped by server-defined source (using server's preparedLimit)
  const draftPreparedByClass = new Map<string, number>();
  for (const sp of draftSpells) {
    if (sp.level < 1 || sp.alwaysPrepared || !sp.prepared) continue;
    const target = resolveSpellTargetSource(sp, sources);
    if (target) {
      draftPreparedByClass.set(
        target.classId,
        (draftPreparedByClass.get(target.classId) ?? 0) + 1
      );
    }
  }

  function wouldExceedPlayerLimit(candidate: Pick<Dnd5e2014SpellEntry, 'level' | 'alwaysPrepared' | 'prepared' | 'sourceType' | 'sourceClassId' | 'inSpellbook'>, excludeId: string | null): string | null {
    if (access.isGm) return null;
    if (candidate.level < 1 || candidate.alwaysPrepared || !candidate.prepared) return null;
    const target = resolveSpellTargetSource(candidate, sources);
    if (!target || target.preparedLimit === null) return null;

    let countWithoutCandidate = 0;
    for (const sp of draftSpells) {
      if (sp.id === excludeId) continue;
      if (sp.level < 1 || sp.alwaysPrepared || !sp.prepared) continue;
      const spTarget = resolveSpellTargetSource(sp, sources);
      if (spTarget?.classId === target.classId) {
        countWithoutCandidate += 1;
      }
    }

    if (countWithoutCandidate + 1 > target.preparedLimit) {
      return `Has assolit el límit oficial de ${target.preparedLimit} conjur(s) preparats de ${target.classLabelCa}. Desmarca un altre conjur abans de preparar-ne un de nou.`;
    }
    return null;
  }

  function openNewForm() {
    setEditingId(null);
    setLimitNotice(null);
    setForm(emptySpellForm(sources[0]?.classId ?? '', hasSpellbook));
    setFormOpen(true);
  }

  function openEditForm(sp: Dnd5e2014SpellEntry) {
    setEditingId(sp.id);
    setLimitNotice(null);
    setForm(formFromSpell(sp));
    setFormOpen(true);
  }

  function handleSaveSpellForm() {
    const cleanName = form.name.trim();
    if (!cleanName) return;

    const existing = editingId ? draftSpells.find((s) => s.id === editingId) : undefined;
    const id =
      editingId ??
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `spell-${crypto.randomUUID().slice(0, 8)}`
        : `spell-${Date.now()}`);

    const entry: Dnd5e2014SpellEntry = {
      id,
      level: Math.min(9, Math.max(0, Math.trunc(form.level))),
      name: cleanName,
      castingTime: form.castingTime.trim(),
      range: form.range.trim(),
      components: form.components.trim(),
      duration: form.duration.trim(),
      school: form.school.trim() || null,
      sourceType: form.sourceType,
      sourceClassId:
        form.sourceType === 'class' || form.sourceType === 'pact'
          ? form.sourceClassId.trim() || null
          : null,
      alwaysPrepared: access.isGm ? form.alwaysPrepared : (existing?.alwaysPrepared ?? false),
      prepared: form.level >= 1 ? form.prepared : false,
      inSpellbook: form.inSpellbook,
      ritual: form.ritual,
      concentration: form.concentration,
      notes: form.notes.trim(),
    };

    const err = wouldExceedPlayerLimit(entry, editingId);
    if (err) {
      setLimitNotice(err);
      return;
    }

    setLimitNotice(null);
    if (editingId) {
      onChangeSpells(draftSpells.map((s) => (s.id === editingId ? entry : s)));
    } else {
      onChangeSpells([...draftSpells, entry]);
    }
    setFormOpen(false);
    setEditingId(null);
  }

  function handleTogglePrepared(sp: Dnd5e2014SpellEntry) {
    if (!canEditSpells || sp.level < 1 || sp.alwaysPrepared) return;
    const nextPrepared = !sp.prepared;
    const candidate = { ...sp, prepared: nextPrepared };
    const err = wouldExceedPlayerLimit(candidate, sp.id);
    if (err) {
      setLimitNotice(err);
      return;
    }
    setLimitNotice(null);
    onChangeSpells(draftSpells.map((item) => (item.id === sp.id ? candidate : item)));
  }

  function handleToggleSpellbook(sp: Dnd5e2014SpellEntry) {
    if (!canEditSpells) return;
    setLimitNotice(null);
    onChangeSpells(
      draftSpells.map((item) =>
        item.id === sp.id ? { ...item, inSpellbook: !item.inSpellbook } : item
      )
    );
  }

  function handleDeleteSpell(id: string) {
    setLimitNotice(null);
    onChangeSpells(draftSpells.filter((s) => s.id !== id));
    setConfirmDeleteId(null);
  }

  const classLabelById = new Map(DND5E_CLASSES.map((c) => [c.id, c.labelCa]));
  const visibleLevels = SPELL_LEVELS.filter((lvl) => {
    if (levelFilter !== 'all' && levelFilter !== lvl) return false;
    return draftSpells.some((s) => s.level === lvl);
  });

  return (
    <Card
      title={`Llista de conjurs (${draftSpells.length})`}
      subtitle="Conjurs organitzats per nivell amb control de preparats, grimori i sempre preparats."
      actions={
        canEditSpells && (
          <Button size="sm" variant="secondary" onClick={openNewForm}>
            <Plus className="h-3.5 w-3.5" />
            Afegir conjur
          </Button>
        )
      }
    >
      <div className="space-y-4">
        {/* Indicadors de límit de preparació per classe */}
        {sources.some((s) => s.preparedLimit !== null) && (
          <div className="flex flex-wrap gap-2">
            {sources
              .filter((s) => s.preparedLimit !== null)
              .map((src) => {
                const draftCount = draftPreparedByClass.get(src.classId) ?? 0;
                const limit = src.preparedLimit!;
                const atOrAbove = draftCount >= limit;
                const over = draftCount > limit;
                return (
                  <div
                    key={src.classId}
                    className={`inline-flex items-center gap-2 rounded-[var(--rol-radius-md)] border px-3 py-1.5 text-xs ${
                      over
                        ? 'border-[var(--rol-status-danger-border)] bg-[var(--rol-status-danger-bg)] text-[var(--rol-status-danger-ink)]'
                        : atOrAbove
                          ? 'border-[var(--rol-status-warning-border)] bg-[var(--rol-status-warning-bg)] text-[var(--rol-status-warning-ink)]'
                          : 'border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/50 text-[var(--rol-ink-primary)]'
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      <strong>{src.classLabelCa}:</strong> {draftCount} / {limit} preparats
                      {src.alwaysPreparedCount > 0 && ` (+${src.alwaysPreparedCount} fixos)`}
                    </span>
                  </div>
                );
              })}
          </div>
        )}

        {limitNotice && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-[var(--rol-radius-md)] border border-[var(--rol-status-danger-border)] bg-[var(--rol-status-danger-bg)] px-3 py-2 text-xs text-[var(--rol-status-danger-ink)]"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{limitNotice}</span>
          </div>
        )}

        {/* Formulari d'afegir / editar conjur */}
        {formOpen && canEditSpells && (
          <div className="rounded-[var(--rol-radius-md)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface-alt)]/55 p-3.5 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--rol-ink-primary)]">
              {editingId ? 'Editar conjur' : 'Nou conjur manual'}
            </h4>

            <div className="grid gap-2.5 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label htmlFor="spell-form-name" className="mb-1 block text-xs font-medium">
                  Nom del conjur
                </label>
                <input
                  id="spell-form-name"
                  type="text"
                  maxLength={140}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex. Bola de foc / Curar ferides"
                  className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2.5 py-1.5 text-sm"
                />
              </div>

              <div>
                <label htmlFor="spell-form-level" className="mb-1 block text-xs font-medium">
                  Cercle / Nivell
                </label>
                <select
                  id="spell-form-level"
                  value={form.level}
                  onChange={(e) => {
                    const lvl = Number(e.target.value);
                    setForm((f) => ({
                      ...f,
                      level: lvl,
                      prepared: lvl >= 1 ? f.prepared : false,
                    }));
                  }}
                  className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2.5 py-1.5 text-sm"
                >
                  <option value={0}>0 (Truc / Cantrip)</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => (
                    <option key={l} value={l}>
                      Nivell {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
              <div>
                <label htmlFor="spell-form-school" className="mb-1 block text-xs font-medium">
                  Escola
                </label>
                <input
                  id="spell-form-school"
                  type="text"
                  maxLength={80}
                  value={form.school}
                  onChange={(e) => setForm((f) => ({ ...f, school: e.target.value }))}
                  placeholder="Evocació, Abjuració…"
                  className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label htmlFor="spell-form-source" className="mb-1 block text-xs font-medium">
                  Origen
                </label>
                <select
                  id="spell-form-source"
                  value={form.sourceType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sourceType: e.target.value as SpellSourceType }))
                  }
                  className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs"
                >
                  {Object.entries(SPELL_SOURCE_TYPE_LABELS_CA).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </div>
              {(form.sourceType === 'class' || form.sourceType === 'pact') && (
                <div>
                  <label htmlFor="spell-form-class" className="mb-1 block text-xs font-medium">
                    Classe associada
                  </label>
                  <select
                    id="spell-form-class"
                    value={form.sourceClassId}
                    onChange={(e) => setForm((f) => ({ ...f, sourceClassId: e.target.value }))}
                    className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs"
                  >
                    <option value="">Automàtica</option>
                    {DND5E_CLASSES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.labelCa}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid gap-2.5 sm:grid-cols-4">
              <div>
                <label htmlFor="spell-form-casting" className="mb-1 block text-xs font-medium">
                  Temps de llançament
                </label>
                <input
                  id="spell-form-casting"
                  type="text"
                  maxLength={100}
                  value={form.castingTime}
                  onChange={(e) => setForm((f) => ({ ...f, castingTime: e.target.value }))}
                  className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label htmlFor="spell-form-range" className="mb-1 block text-xs font-medium">
                  Abast
                </label>
                <input
                  id="spell-form-range"
                  type="text"
                  maxLength={100}
                  value={form.range}
                  onChange={(e) => setForm((f) => ({ ...f, range: e.target.value }))}
                  className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label htmlFor="spell-form-components" className="mb-1 block text-xs font-medium">
                  Components
                </label>
                <input
                  id="spell-form-components"
                  type="text"
                  maxLength={120}
                  value={form.components}
                  onChange={(e) => setForm((f) => ({ ...f, components: e.target.value }))}
                  className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label htmlFor="spell-form-duration" className="mb-1 block text-xs font-medium">
                  Durada
                </label>
                <input
                  id="spell-form-duration"
                  type="text"
                  maxLength={100}
                  value={form.duration}
                  onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                  className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-xs">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.concentration}
                  onChange={(e) => setForm((f) => ({ ...f, concentration: e.target.checked }))}
                />
                <span>Concentració</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.ritual}
                  onChange={(e) => setForm((f) => ({ ...f, ritual: e.target.checked }))}
                />
                <span>Ritual</span>
              </label>
              {form.level >= 1 && (
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.prepared}
                    onChange={(e) => setForm((f) => ({ ...f, prepared: e.target.checked }))}
                  />
                  <span>Preparat</span>
                </label>
              )}
              {hasSpellbook && (
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.inSpellbook}
                    onChange={(e) => setForm((f) => ({ ...f, inSpellbook: e.target.checked }))}
                  />
                  <span>Al grimori</span>
                </label>
              )}
              {access.isGm && (
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-[var(--rol-status-warning-ink)]">
                  <input
                    type="checkbox"
                    checked={form.alwaysPrepared}
                    onChange={(e) => setForm((f) => ({ ...f, alwaysPrepared: e.target.checked }))}
                  />
                  <span>Sempre preparat (GM)</span>
                </label>
              )}
            </div>

            <div>
              <label htmlFor="spell-form-notes" className="mb-1 block text-xs font-medium">
                Notes / efecte
              </label>
              <textarea
                id="spell-form-notes"
                rows={2}
                maxLength={4000}
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
              <Button size="sm" disabled={!form.name.trim()} onClick={handleSaveSpellForm}>
                {editingId ? 'Aplicar canvis' : 'Afegir a l’esborrany'}
              </Button>
            </div>
          </div>
        )}

        {/* Filtre per nivells */}
        {draftSpells.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setLevelFilter('all')}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium cursor-pointer ${
                levelFilter === 'all'
                  ? 'border-[var(--rol-accent-primary)] bg-[var(--rol-accent-primary)] text-[var(--rol-accent-primary-ink)]'
                  : 'border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] text-[var(--rol-ink-secondary)]'
              }`}
            >
              Tots ({draftSpells.length})
            </button>
            {SPELL_LEVELS.filter((lvl) => draftSpells.some((s) => s.level === lvl)).map((lvl) => {
              const count = draftSpells.filter((s) => s.level === lvl).length;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevelFilter(lvl)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium cursor-pointer ${
                    levelFilter === lvl
                      ? 'border-[var(--rol-accent-primary)] bg-[var(--rol-accent-primary)] text-[var(--rol-accent-primary-ink)]'
                      : 'border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] text-[var(--rol-ink-secondary)]'
                  }`}
                >
                  {lvl === 0 ? 'Trucs' : `Niv. ${lvl}`} ({count})
                </button>
              );
            })}
          </div>
        )}

        {draftSpells.length === 0 ? (
          <p className="text-sm text-[var(--rol-ink-muted)]">
            Encara no hi ha cap conjur registrat en aquesta fitxa. Pots afegir conjurs manuals quan
            correspongui.
          </p>
        ) : (
          <div className="space-y-4">
            {visibleLevels.map((lvl) => {
              const group = draftSpells.filter((s) => s.level === lvl);
              return (
                <div key={lvl} className="space-y-2">
                  <h3 className="border-b border-[var(--rol-border-subtle)] pb-1 text-xs font-bold uppercase tracking-wider text-[var(--rol-accent-primary)]">
                    {lvl === 0 ? 'Trucs (Nivell 0)' : `Conjurs de nivell ${lvl}`}
                  </h3>

                  <ul className="space-y-2">
                    {group.map((sp) => {
                      const classLabel = sp.sourceClassId
                        ? classLabelById.get(sp.sourceClassId) ?? sp.sourceClassId
                        : null;
                      const isAlways = sp.alwaysPrepared;
                      const targetSource = resolveSpellTargetSource(sp, sources);

                      return (
                        <li
                          key={sp.id}
                          className="rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/30 p-3 space-y-1.5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                              {sp.level >= 1 && (
                                <>
                                  {isAlways ? (
                                    <span
                                      title="Sempre preparat (no modificable pel jugador)"
                                      className="inline-flex items-center gap-1 text-[var(--rol-accent-gold)]"
                                    >
                                      <Lock className="h-3.5 w-3.5" />
                                    </span>
                                  ) : canEditSpells ? (
                                    <button
                                      type="button"
                                      aria-pressed={sp.prepared}
                                      aria-label={`${sp.prepared ? 'Desmarcar' : 'Marcar'} ${sp.name} com a preparat`}
                                      onClick={() => handleTogglePrepared(sp)}
                                      className="rounded-full p-0.5 text-[var(--rol-accent-primary)] hover:bg-[var(--rol-bg-surface)] cursor-pointer"
                                    >
                                      {sp.prepared ? (
                                        <CheckCircle2 className="h-4 w-4" />
                                      ) : (
                                        <Circle className="h-4 w-4 text-[var(--rol-ink-muted)]" />
                                      )}
                                    </button>
                                  ) : (
                                    <span className="p-0.5 text-[var(--rol-accent-primary)]">
                                      {sp.prepared ? (
                                        <CheckCircle2 className="h-4 w-4" />
                                      ) : (
                                        <Circle className="h-4 w-4 text-[var(--rol-ink-muted)]" />
                                      )}
                                    </span>
                                  )}
                                </>
                              )}

                              <span className="font-semibold text-sm text-[var(--rol-ink-primary)]">
                                {sp.name}
                              </span>

                              {sp.school && <Badge tone="neutral">{sp.school}</Badge>}
                              {sp.concentration && <Badge tone="warning">Concentració</Badge>}
                              {sp.ritual && <Badge tone="gold">Ritual</Badge>}
                              {isAlways && <Badge tone="gold">Sempre preparat</Badge>}
                              {!isAlways && sp.level >= 1 && sp.prepared && (
                                <Badge tone="success">Preparat</Badge>
                              )}
                              {!isAlways &&
                                sp.level >= 1 &&
                                !sp.prepared &&
                                targetSource?.model === 'known' && (
                                  <Badge tone="neutral">Conegut</Badge>
                                )}
                              {!isAlways &&
                                sp.level >= 1 &&
                                !sp.prepared &&
                                targetSource?.model === 'pact' && (
                                  <Badge tone="neutral">Conegut (Pacte)</Badge>
                                )}
                              {sp.inSpellbook && (
                                <Badge tone="neutral">
                                  <BookMarked className="h-3 w-3" />
                                  Grimori
                                </Badge>
                              )}
                            </div>

                            {canEditSpells && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {hasSpellbook && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSpellbook(sp)}
                                    aria-label={`${sp.inSpellbook ? 'Treure del grimori' : 'Desar al grimori'}: ${sp.name}`}
                                    className="rounded border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] px-2 py-0.5 text-[11px] text-[var(--rol-ink-secondary)] hover:text-[var(--rol-ink-primary)] cursor-pointer"
                                  >
                                    {sp.inSpellbook ? 'Al grimori' : '+ Grimori'}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  aria-label={`Editar conjur ${sp.name}`}
                                  onClick={() => openEditForm(sp)}
                                  className="rounded p-1 text-[var(--rol-ink-secondary)] hover:bg-[var(--rol-bg-surface)] hover:text-[var(--rol-ink-primary)] cursor-pointer"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>

                                {confirmDeleteId === sp.id ? (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="danger"
                                      onClick={() => handleDeleteSpell(sp.id)}
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
                                    aria-label={`Eliminar conjur ${sp.name}`}
                                    onClick={() => setConfirmDeleteId(sp.id)}
                                    className="rounded p-1 text-[var(--rol-status-danger-ink)] hover:bg-[var(--rol-status-danger-bg)] cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--rol-ink-secondary)]">
                            {sp.castingTime && (
                              <span>
                                <strong>Llançament:</strong> {sp.castingTime}
                              </span>
                            )}
                            {sp.range && (
                              <span>
                                <strong>Abast:</strong> {sp.range}
                              </span>
                            )}
                            {sp.components && (
                              <span>
                                <strong>Comp.:</strong> {sp.components}
                              </span>
                            )}
                            {sp.duration && (
                              <span>
                                <strong>Durada:</strong> {sp.duration}
                              </span>
                            )}
                            <span>
                              <strong>Procedència:</strong> {SPELL_SOURCE_TYPE_LABELS_CA[sp.sourceType]}
                              {classLabel ? ` (${classLabel})` : ''}
                            </span>
                          </div>

                          {sp.notes && (
                            <p className="text-xs text-[var(--rol-ink-muted)]">{sp.notes}</p>
                          )}
                        </li>
                      );
                    })}
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
