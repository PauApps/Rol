'use client';

import { useMemo, useState, type FormEvent } from 'react';
import {
  ArrowUpDown,
  Calendar,
  Lock,
  Pencil,
  Plus,
  ScrollText,
  Trash2,
} from 'lucide-react';
import {
  SESSION_NOTE_CATEGORIES,
  SESSION_NOTE_CATEGORY_LABELS_CA,
  type Dnd5e2014SessionNote,
  type SessionNoteCategory,
} from '@/domain/systems/dnd5e-2014';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { InputField, SelectField, TextareaField } from '@/components/ui/Field';
import { canEditSheetField, type SheetAccessContext } from '../sheet-permissions';
import type { CharacterSheetDraft, CharacterSheetRecord } from '../types';

interface CharacterJournalCardProps {
  character: CharacterSheetRecord;
  draft: CharacterSheetDraft;
  access: SheetAccessContext;
  onUpdateDraft: (updater: (prev: CharacterSheetDraft) => CharacterSheetDraft) => void;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CharacterJournalCard({
  character,
  draft,
  access,
  onUpdateDraft,
}: CharacterJournalCardProps) {
  const canEditJournal = canEditSheetField('background.sessionNotes', access);
  const journalHiddenByGm =
    !access.isGm && character.sheetData.background?.sessionNotes === undefined;

  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [categoryFilter, setCategoryFilter] = useState<SessionNoteCategory | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayIsoDate);
  const [category, setCategory] = useState<SessionNoteCategory | ''>('');
  const [content, setContent] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const sortedEntries = useMemo(() => {
    const filtered =
      categoryFilter === 'all'
        ? draft.background.sessionNotes
        : draft.background.sessionNotes.filter((n) => (n.category ?? null) === categoryFilter);

    return [...filtered].sort((a, b) => {
      const cmp = (a.date || '').localeCompare(b.date || '');
      if (cmp !== 0) {
        return sortOrder === 'newest' ? -cmp : cmp;
      }
      const uCmp = (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '');
      return sortOrder === 'newest' ? -uCmp : uCmp;
    });
  }, [draft.background.sessionNotes, categoryFilter, sortOrder]);

  function openNewForm() {
    setEditingId(null);
    setTitle('');
    setDate(todayIsoDate());
    setCategory('');
    setContent('');
    setFormError(null);
    setConfirmDeleteId(null);
    setFormOpen(true);
  }

  function openEditForm(note: Dnd5e2014SessionNote) {
    setEditingId(note.id);
    setTitle(note.title);
    setDate(note.date || todayIsoDate());
    setCategory(note.category ?? '');
    setContent(note.content);
    setFormError(null);
    setConfirmDeleteId(null);
    setFormOpen(true);
  }

  function handleSaveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFormError('El títol de l’entrada del diari és obligatori.');
      return;
    }
    const nowIso = new Date().toISOString();
    const entry: Dnd5e2014SessionNote = {
      id: editingId ?? `journal-${Date.now()}`,
      title: cleanTitle,
      date: date.trim() || todayIsoDate(),
      updatedAt: nowIso,
      category: category || null,
      content,
    };

    onUpdateDraft((prev) => {
      const exists = prev.background.sessionNotes.some((n) => n.id === entry.id);
      const nextNotes = exists
        ? prev.background.sessionNotes.map((n) => (n.id === entry.id ? entry : n))
        : [entry, ...prev.background.sessionNotes];
      return {
        ...prev,
        background: {
          ...prev.background,
          sessionNotes: nextNotes,
        },
      };
    });

    setFormOpen(false);
    setEditingId(null);
    setFormError(null);
  }

  function handleConfirmDelete(id: string) {
    onUpdateDraft((prev) => ({
      ...prev,
      background: {
        ...prev.background,
        sessionNotes: prev.background.sessionNotes.filter((n) => n.id !== id),
      },
    }));
    setConfirmDeleteId(null);
  }

  if (journalHiddenByGm) {
    return (
      <Card
        title="Diari del personatge"
        subtitle="Crònica d’esdeveniments, NPCs, llocs, missions i records de sessió."
      >
        <div className="flex items-center gap-2 rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/50 px-3.5 py-3 text-xs text-[var(--rol-ink-muted)]">
          <Lock className="h-4 w-4 shrink-0" />
          <span>El Director de Joc ha marcat el diari com a reservat (`gmOnly`).</span>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Diari del personatge"
      subtitle="Entrades ordenables cronològicament amb categoria opcional (esdeveniments, contactes, llocs, missions…)."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortOrder === 'newest' ? 'Més recents primer' : 'Més antigues primer'}
          </Button>
          {canEditJournal && (
            <Button type="button" size="sm" onClick={openNewForm}>
              <Plus className="h-3.5 w-3.5" />
              Nova entrada
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Filtre per categoria opcional */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors ${
              categoryFilter === 'all'
                ? 'border-[var(--rol-accent-primary)] bg-[var(--rol-accent-primary)] text-[var(--rol-accent-primary-ink)]'
                : 'border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)] text-[var(--rol-ink-secondary)] hover:border-[var(--rol-border-strong)]'
            }`}
          >
            Totes ({draft.background.sessionNotes.length})
          </button>
          {SESSION_NOTE_CATEGORIES.map((cat) => {
            const count = draft.background.sessionNotes.filter((n) => n.category === cat).length;
            const active = categoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors ${
                  active
                    ? 'border-[var(--rol-accent-primary)] bg-[var(--rol-accent-primary)] text-[var(--rol-accent-primary-ink)]'
                    : 'border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)] text-[var(--rol-ink-secondary)] hover:border-[var(--rol-border-strong)]'
                }`}
              >
                {SESSION_NOTE_CATEGORY_LABELS_CA[cat]}
                {count > 0 ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>

        {/* Formulari d'alta / edició */}
        {formOpen && canEditJournal && (
          <form
            onSubmit={handleSaveEntry}
            className="space-y-3 rounded-[var(--rol-radius-md)] border border-[var(--rol-accent-gold)] bg-[var(--rol-bg-surface-alt)]/60 p-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--rol-ink-primary)]">
                {editingId ? 'Editar entrada del diari' : 'Nova entrada del diari'}
              </h3>
              <Badge tone="gold">
                <ScrollText className="h-3 w-3" />
                Diari
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <InputField
                  label="Títol"
                  htmlFor="journal-entry-title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex. Pacte a Phandalin"
                />
              </div>
              <InputField
                label="Data de l’entrada"
                htmlFor="journal-entry-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <SelectField
                label="Categoria (opcional)"
                htmlFor="journal-entry-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as SessionNoteCategory | '')}
              >
                <option value="">Sense categoria</option>
                {SESSION_NOTE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {SESSION_NOTE_CATEGORY_LABELS_CA[cat]}
                  </option>
                ))}
              </SelectField>
            </div>

            <TextareaField
              label="Contingut"
              htmlFor="journal-entry-content"
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Anotacions de la sessió, pistes, tractes o impressions del personatge…"
            />

            {formError && (
              <p role="alert" className="text-xs font-medium text-[var(--rol-status-danger-ink)]">
                {formError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFormOpen(false);
                  setEditingId(null);
                  setFormError(null);
                }}
              >
                Cancel·lar
              </Button>
              <Button type="submit" size="sm">
                {editingId ? 'Aplicar edició' : 'Afegir entrada'}
              </Button>
            </div>
          </form>
        )}

        {/* Llista cronològica d'entrades */}
        {sortedEntries.length === 0 ? (
          <p className="rounded-[var(--rol-radius-md)] border border-dashed border-[var(--rol-border-subtle)] px-4 py-6 text-center text-sm text-[var(--rol-ink-muted)]">
            {draft.background.sessionNotes.length === 0
              ? 'Encara no hi ha cap entrada al diari del personatge.'
              : 'Cap entrada coincideix amb la categoria seleccionada.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {sortedEntries.map((note) => {
              const isConfirming = confirmDeleteId === note.id;
              return (
                <li
                  key={note.id}
                  className="rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/35 p-3.5 space-y-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-[var(--rol-ink-primary)]">{note.title}</h4>
                        {note.category && (
                          <Badge tone="gold">
                            {SESSION_NOTE_CATEGORY_LABELS_CA[note.category] ?? note.category}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--rol-ink-muted)]">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {note.date || 'Sense data'}
                        </span>
                        {note.updatedAt && (
                          <span>
                            Actualitzada:{' '}
                            {new Date(note.updatedAt).toLocaleString('ca-ES', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </span>
                        )}
                      </div>
                    </div>

                    {canEditJournal && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {isConfirming ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="danger"
                              onClick={() => handleConfirmDelete(note.id)}
                            >
                              Confirmar eliminació
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              Cancel·lar
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => openEditForm(note)}
                            >
                              <Pencil className="h-3 w-3" />
                              Editar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="danger"
                              onClick={() => setConfirmDeleteId(note.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                              Eliminar
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {note.content && (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--rol-ink-secondary)]">
                      {note.content}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {draft.background.sessionNotes.length > 0 && canEditJournal && (
          <p className="text-[11px] text-[var(--rol-ink-muted)]">
            Nota: totes les entrades del diari són visibles per als membres de la campanya autoritzats a consultar la fitxa (tret que el GM oculti `background.sessionNotes`). Prem «Desar canvis» per guardar-les al servidor.
          </p>
        )}
      </div>
    </Card>
  );
}
