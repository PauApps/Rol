'use client';

import { BookOpen, Lock } from 'lucide-react';
import { DND5E_ALIGNMENTS_CA, DND5E_BACKGROUNDS } from '@/domain/systems/dnd5e-2014';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { InputField, SelectField, TextareaField } from '@/components/ui/Field';
import { canEditSheetField, type SheetAccessContext } from '../sheet-permissions';
import type { CharacterSheetDraft, CharacterSheetRecord } from '../types';

interface CharacterStoryCardProps {
  character: CharacterSheetRecord;
  draft: CharacterSheetDraft;
  access: SheetAccessContext;
  onUpdateDraft: (updater: (prev: CharacterSheetDraft) => CharacterSheetDraft) => void;
}

export function CharacterStoryCard({
  character,
  draft,
  access,
  onUpdateDraft,
}: CharacterStoryCardProps) {
  const canBgName = canEditSheetField('background.backgroundName', access);
  const canAlignment = canEditSheetField('generalInfo.alignment', access);
  const canFaith = canEditSheetField('generalInfo.faith', access);
  const canAge = canEditSheetField('generalInfo.age', access);
  const canSize = canEditSheetField('generalInfo.size', access);
  const canSenses = canEditSheetField('generalInfo.senses', access);
  const canAppearance = canEditSheetField('generalInfo.appearanceNotes', access);
  const canPersonality = canEditSheetField('background.personalityTraits', access);
  const canIdeals = canEditSheetField('background.ideals', access);
  const canBonds = canEditSheetField('background.bonds', access);
  const canFlaws = canEditSheetField('background.flaws', access);
  const canBackstory = canEditSheetField('background.backstory', access);
  const canAdditionalNotes = canEditSheetField('background.additionalNotes', access);

  const appearanceHiddenByGm =
    !access.isGm && character.sheetData.generalInfo?.appearanceNotes === undefined;
  const backstoryHiddenByGm =
    !access.isGm && character.sheetData.background?.backstory === undefined;
  const additionalHiddenByGm =
    !access.isGm && character.sheetData.background?.additionalNotes === undefined;

  return (
    <Card
      title="Història i identitat narrativa"
      subtitle="Rerefons, trets personals, aspecte físic, objectius i història sincronitzada amb la configuració del personatge."
      actions={
        <Badge tone="gold">
          <BookOpen className="h-3 w-3" />
          Relat del personatge
        </Badge>
      }
    >
      <div className="space-y-4">
        {/* Dades d'origen i identitat física */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <InputField
              label="Antecedent / Origen"
              htmlFor="story-bg-name"
              list="story-bg-datalist"
              disabled={!canBgName}
              value={draft.background.backgroundName ?? ''}
              onChange={(e) => {
                const val = e.target.value.trim() ? e.target.value : null;
                onUpdateDraft((prev) => ({
                  ...prev,
                  background: { ...prev.background, backgroundName: val },
                }));
              }}
              placeholder="Ex. Soldat, Erudit, Acòlit…"
            />
            <datalist id="story-bg-datalist">
              {DND5E_BACKGROUNDS.map((b) => (
                <option key={b.id} value={b.labelCa} />
              ))}
            </datalist>
          </div>

          <SelectField
            label="Alineament"
            htmlFor="story-alignment"
            disabled={!canAlignment}
            value={draft.generalInfo.alignment ?? ''}
            onChange={(e) => {
              const val = e.target.value.trim() ? e.target.value : null;
              onUpdateDraft((prev) => ({
                ...prev,
                generalInfo: { ...prev.generalInfo, alignment: val },
              }));
            }}
          >
            <option value="">Sense especificar</option>
            {DND5E_ALIGNMENTS_CA.map((al) => (
              <option key={al} value={al}>
                {al}
              </option>
            ))}
          </SelectField>

          <InputField
            label="Fe / Deïtat"
            htmlFor="story-faith"
            disabled={!canFaith}
            value={draft.generalInfo.faith ?? ''}
            onChange={(e) => {
              const val = e.target.value.trim() ? e.target.value : null;
              onUpdateDraft((prev) => ({
                ...prev,
                generalInfo: { ...prev.generalInfo, faith: val },
              }));
            }}
            placeholder="Deïtat, filosofia o ordre"
          />

          <InputField
            label="Edat"
            htmlFor="story-age"
            disabled={!canAge}
            value={draft.generalInfo.age ?? ''}
            onChange={(e) => {
              const val = e.target.value.trim() ? e.target.value : null;
              onUpdateDraft((prev) => ({
                ...prev,
                generalInfo: { ...prev.generalInfo, age: val },
              }));
            }}
            placeholder="Ex. 28 anys"
          />

          <InputField
            label="Mida"
            htmlFor="story-size"
            disabled={!canSize}
            value={draft.generalInfo.size ?? ''}
            onChange={(e) => {
              const val = e.target.value.trim() ? e.target.value : null;
              onUpdateDraft((prev) => ({
                ...prev,
                generalInfo: { ...prev.generalInfo, size: val },
              }));
            }}
            placeholder="Mitjana / Petita"
          />

          <InputField
            label="Sentits especials"
            htmlFor="story-senses"
            disabled={!canSenses}
            value={draft.generalInfo.senses ?? ''}
            onChange={(e) => {
              const val = e.target.value.trim() ? e.target.value : null;
              onUpdateDraft((prev) => ({
                ...prev,
                generalInfo: { ...prev.generalInfo, senses: val },
              }));
            }}
            placeholder="Ex. Visió en la foscor 18 m"
          />
        </div>

        {/* Aspecte i descripció física */}
        {appearanceHiddenByGm ? (
          <div className="flex items-center gap-2 rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/50 px-3 py-2 text-xs text-[var(--rol-ink-muted)]">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            <span>La descripció física està reservada al Director de Joc.</span>
          </div>
        ) : (
          <TextareaField
            label="Descripció física i aspecte"
            htmlFor="story-appearance"
            rows={3}
            disabled={!canAppearance}
            value={draft.generalInfo.appearanceNotes}
            onChange={(e) =>
              onUpdateDraft((prev) => ({
                ...prev,
                generalInfo: { ...prev.generalInfo, appearanceNotes: e.target.value },
              }))
            }
            placeholder="Estaturam, trets distintius, vestimenta, cicatrius o gestos habituals…"
          />
        )}

        {/* Trets de personalitat, ideals, vincles i defectes */}
        <div className="grid gap-3 sm:grid-cols-2">
          <TextareaField
            label="Trets de personalitat"
            htmlFor="story-personality"
            rows={3}
            disabled={!canPersonality}
            value={draft.background.personalityTraits}
            onChange={(e) =>
              onUpdateDraft((prev) => ({
                ...prev,
                background: { ...prev.background, personalityTraits: e.target.value },
              }))
            }
            placeholder="Com es comporta i expressa el personatge habitualment…"
          />
          <TextareaField
            label="Ideals"
            htmlFor="story-ideals"
            rows={3}
            disabled={!canIdeals}
            value={draft.background.ideals}
            onChange={(e) =>
              onUpdateDraft((prev) => ({
                ...prev,
                background: { ...prev.background, ideals: e.target.value },
              }))
            }
            placeholder="Principis morals o conviccions que el guien…"
          />
          <TextareaField
            label="Vincles"
            htmlFor="story-bonds"
            rows={3}
            disabled={!canBonds}
            value={draft.background.bonds}
            onChange={(e) =>
              onUpdateDraft((prev) => ({
                ...prev,
                background: { ...prev.background, bonds: e.target.value },
              }))
            }
            placeholder="Persones, llocs, objectes o promeses importants…"
          />
          <TextareaField
            label="Defectes"
            htmlFor="story-flaws"
            rows={3}
            disabled={!canFlaws}
            value={draft.background.flaws}
            onChange={(e) =>
              onUpdateDraft((prev) => ({
                ...prev,
                background: { ...prev.background, flaws: e.target.value },
              }))
            }
            placeholder="Debilitats, pors o vicis aprofitables en escena…"
          />
        </div>

        {/* Història personal compartida amb Editar personatge */}
        {backstoryHiddenByGm ? (
          <div className="flex items-center gap-2 rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/50 px-3 py-2 text-xs text-[var(--rol-ink-muted)]">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            <span>La història personal està reservada al Director de Joc.</span>
          </div>
        ) : (
          <div className="space-y-1">
            <TextareaField
              label="Història personal"
              htmlFor="story-backstory"
              rows={6}
              disabled={!canBackstory}
              value={draft.background.backstory}
              onChange={(e) =>
                onUpdateDraft((prev) => ({
                  ...prev,
                  background: { ...prev.background, backstory: e.target.value },
                }))
              }
              placeholder="Orígens, passat abans de l’aventura i esdeveniments que van marcar el personatge…"
            />
            <p className="text-[11px] text-[var(--rol-ink-muted)]">
              Camp compartit amb el modal «Editar personatge»: recorda prèmer «Desar canvis» per persistir les modificacions.
            </p>
          </div>
        )}

        {/* Objectius personals i notes narratives addicionals */}
        {additionalHiddenByGm ? (
          <div className="flex items-center gap-2 rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/50 px-3 py-2 text-xs text-[var(--rol-ink-muted)]">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            <span>Les notes narratives addicionals són visibles només per al GM (`gmOnly`).</span>
          </div>
        ) : (
          <TextareaField
            label="Objectius personals i altres notes narratives"
            htmlFor="story-additional-notes"
            rows={4}
            disabled={!canAdditionalNotes}
            value={draft.background.additionalNotes}
            onChange={(e) =>
              onUpdateDraft((prev) => ({
                ...prev,
                background: { ...prev.background, additionalNotes: e.target.value },
              }))
            }
            placeholder="Metes personals, aliats, contactes, pistes obertes o detall de rerefons…"
          />
        )}
      </div>
    </Card>
  );
}
