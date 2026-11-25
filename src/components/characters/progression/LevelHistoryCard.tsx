'use client';

import { useState, type FormEvent } from 'react';
import { History, Plus, Trash2 } from 'lucide-react';
import {
  DND5E_CLASSES,
  DND5E_SUBCLASSES,
  getClassEntry,
  getSubclassEntry,
  type Dnd5e2014LevelHistoryEntry,
} from '@/domain/systems/dnd5e-2014';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { InputField, SelectField } from '@/components/ui/Field';
import { canEditSheetField, type SheetAccessContext } from '../sheet-permissions';
import type { CharacterSheetDraft } from '../types';

interface LevelHistoryCardProps {
  draft: CharacterSheetDraft;
  access: SheetAccessContext;
  onUpdateDraft: (updater: (prev: CharacterSheetDraft) => CharacterSheetDraft) => void;
}

export function LevelHistoryCard({ draft, access, onUpdateDraft }: LevelHistoryCardProps) {
  const canEditHistory = canEditSheetField('progression.levelHistory', access);
  const canEditAsiNotes = canEditSheetField('progression.abilityScoreImprovements', access);

  const [addingHistory, setAddingHistory] = useState(false);
  const [hLevel, setHLevel] = useState(1);
  const [hClassId, setHClassId] = useState(DND5E_CLASSES[0]?.id ?? 'fighter');
  const [hCustomClass, setHCustomClass] = useState('');
  const [hSubclassId, setHSubclassId] = useState('');
  const [hHpGain, setHHpGain] = useState('6');
  const [hDate, setHDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hNotes, setHNotes] = useState('');

  const [newAsiLevel, setNewAsiLevel] = useState('4');
  const [newAsiNotes, setNewAsiNotes] = useState('');

  const sortedHistory = [...draft.progression.levelHistory].sort((a, b) => a.level - b.level);
  const availableSubclasses = DND5E_SUBCLASSES.filter((s) => s.classId === hClassId);

  function handleAddHistory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEditHistory) return;
    const hpParsed = hHpGain.trim() === '' ? null : Math.max(0, Math.min(50, Math.trunc(Number(hHpGain))));
    const entry: Dnd5e2014LevelHistoryEntry = {
      id: `lh-${hLevel}-${Date.now()}`,
      level: Math.min(20, Math.max(1, Math.trunc(hLevel))),
      classId: hClassId,
      customClassName: hClassId === 'custom' ? (hCustomClass.trim() || 'Classe personalitzada') : null,
      subclassId: hSubclassId || null,
      hpGain: hpParsed !== null && Number.isFinite(hpParsed) ? hpParsed : null,
      notes: hNotes.trim(),
      date: hDate.trim(),
    };
    onUpdateDraft((prev) => ({
      ...prev,
      progression: {
        ...prev.progression,
        levelHistory: [...prev.progression.levelHistory, entry].sort((a, b) => a.level - b.level),
      },
    }));
    setAddingHistory(false);
    setHNotes('');
  }

  function handleAddAsiNote() {
    if (!canEditAsiNotes || !newAsiNotes.trim()) return;
    const lvl = Math.min(20, Math.max(1, Math.trunc(Number(newAsiLevel) || 4)));
    onUpdateDraft((prev) => ({
      ...prev,
      progression: {
        ...prev.progression,
        abilityScoreImprovements: [
          ...prev.progression.abilityScoreImprovements,
          { level: lvl, notes: newAsiNotes.trim() },
        ].sort((a, b) => a.level - b.level),
      },
    }));
    setNewAsiNotes('');
  }

  return (
    <Card
      title="Historial d’evolució i millores (ASI / Dots)"
      subtitle="Registre cronològic nivell a nivell (`levelHistory`) i resum de millores de característica o dots."
      actions={
        canEditHistory && !addingHistory ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => setAddingHistory(true)}>
            <Plus className="h-3.5 w-3.5" />
            Afegir registre
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        {addingHistory && canEditHistory && (
          <form
            onSubmit={handleAddHistory}
            className="space-y-3 rounded-[var(--rol-radius-md)] border border-[var(--rol-accent-gold)] bg-[var(--rol-bg-surface-alt)]/50 p-3.5"
          >
            <div className="grid gap-3 sm:grid-cols-4">
              <InputField
                label="Nivell assolit"
                htmlFor="lh-level"
                type="number"
                min={1}
                max={20}
                value={hLevel}
                onChange={(e) => setHLevel(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
              />
              <SelectField
                label="Classe"
                htmlFor="lh-class"
                value={hClassId}
                onChange={(e) => {
                  setHClassId(e.target.value);
                  setHSubclassId('');
                }}
              >
                {DND5E_CLASSES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.labelCa}
                  </option>
                ))}
                <option value="custom">Personalitzada</option>
              </SelectField>
              {hClassId === 'custom' ? (
                <InputField
                  label="Nom classe pers."
                  htmlFor="lh-custom-cls"
                  value={hCustomClass}
                  onChange={(e) => setHCustomClass(e.target.value)}
                />
              ) : (
                <SelectField
                  label="Subclasse (opc.)"
                  htmlFor="lh-subclass"
                  value={hSubclassId}
                  onChange={(e) => setHSubclassId(e.target.value)}
                >
                  <option value="">Cap</option>
                  {availableSubclasses.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.labelCa}
                    </option>
                  ))}
                </SelectField>
              )}
              <InputField
                label="PV guanyats"
                htmlFor="lh-hpgain"
                type="number"
                min={0}
                max={50}
                value={hHpGain}
                onChange={(e) => setHHpGain(e.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <InputField
                label="Data"
                htmlFor="lh-date"
                type="date"
                value={hDate}
                onChange={(e) => setHDate(e.target.value)}
              />
              <div className="sm:col-span-2">
                <InputField
                  label="Notes del nivell"
                  htmlFor="lh-notes"
                  value={hNotes}
                  onChange={(e) => setHNotes(e.target.value)}
                  placeholder="ASI, dot, conjurs apresos…"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setAddingHistory(false)}>
                Cancel·lar
              </Button>
              <Button type="submit" size="sm">
                Afegir a l’esborrany
              </Button>
            </div>
          </form>
        )}

        {/* Llista de levelHistory */}
        {sortedHistory.length === 0 ? (
          <p className="text-sm text-[var(--rol-ink-muted)]">
            Encara no hi ha cap registre històric nivell a nivell. En fer servir «Pujar de nivell (+1)» s’hi afegirà automàticament.
          </p>
        ) : (
          <ul className="space-y-2 text-xs">
            {sortedHistory.map((item) => {
              const clsLabel =
                item.customClassName?.trim() ||
                getClassEntry(item.classId)?.labelCa ||
                item.classId;
              const subLabel = getSubclassEntry(item.subclassId)?.labelCa;
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/30 px-3 py-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="gold">
                        <History className="h-3 w-3" />
                        Nivell {item.level}
                      </Badge>
                      <span className="font-semibold text-[var(--rol-ink-primary)]">
                        {clsLabel}
                        {subLabel ? ` (${subLabel})` : ''}
                      </span>
                      {item.hpGain !== null && (
                        <span className="font-mono text-[var(--rol-status-success-ink)]">
                          +{item.hpGain} PV
                        </span>
                      )}
                      {item.date && (
                        <span className="text-[var(--rol-ink-muted)]">· {item.date}</span>
                      )}
                    </div>
                    {item.notes && <p className="text-[var(--rol-ink-secondary)]">{item.notes}</p>}
                  </div>
                  {canEditHistory && (
                    <button
                      type="button"
                      aria-label={`Eliminar registre nivell ${item.level}`}
                      onClick={() =>
                        onUpdateDraft((prev) => ({
                          ...prev,
                          progression: {
                            ...prev.progression,
                            levelHistory: prev.progression.levelHistory.filter(
                              (h) => h.id !== item.id
                            ),
                          },
                        }))
                      }
                      className="rounded p-1 text-[var(--rol-status-danger-ink)] hover:bg-[var(--rol-status-danger-bg)] cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Registre de millores de característica / dots */}
        <div className="border-t border-[var(--rol-border-subtle)] pt-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--rol-ink-primary)]">
            Resum de millores (ASI i dots)
          </p>
          {draft.progression.abilityScoreImprovements.length === 0 ? (
            <p className="text-xs text-[var(--rol-ink-muted)]">
              Sense anotacions d’ASI o dots registrades encara.
            </p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {draft.progression.abilityScoreImprovements.map((asi, idx) => (
                <li
                  key={`${asi.level}-${idx}`}
                  className="flex items-center justify-between gap-2 rounded border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/30 px-2.5 py-1.5"
                >
                  <span>
                    <strong>Nivell {asi.level}:</strong> {asi.notes}
                  </span>
                  {canEditAsiNotes && (
                    <button
                      type="button"
                      aria-label="Eliminar nota ASI"
                      onClick={() =>
                        onUpdateDraft((prev) => ({
                          ...prev,
                          progression: {
                            ...prev.progression,
                            abilityScoreImprovements: prev.progression.abilityScoreImprovements.filter(
                              (_, i) => i !== idx
                            ),
                          },
                        }))
                      }
                      className="rounded p-0.5 text-[var(--rol-status-danger-ink)] hover:bg-[var(--rol-status-danger-bg)] cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canEditAsiNotes && (
            <div className="flex flex-wrap items-end gap-2 pt-1">
              <div className="w-24">
                <InputField
                  label="Nivell"
                  htmlFor="asi-note-level"
                  type="number"
                  min={1}
                  max={20}
                  value={newAsiLevel}
                  onChange={(e) => setNewAsiLevel(e.target.value)}
                />
              </div>
              <div className="min-w-[200px] flex-1">
                <InputField
                  label="Nota ASI / Dot"
                  htmlFor="asi-note-text"
                  value={newAsiNotes}
                  onChange={(e) => setNewAsiNotes(e.target.value)}
                  placeholder="Ex. +2 SAV o Dot: Mestre d’armadures"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!newAsiNotes.trim()}
                onClick={handleAddAsiNote}
              >
                Afegir nota
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
