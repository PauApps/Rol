'use client';

import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  DND5E_ALIGNMENTS_CA,
  DND5E_BACKGROUNDS,
  DND5E_CLASSES,
  DND5E_LANGUAGES_CA,
  DND5E_RACES,
  DND5E_SUBCLASSES,
  getClassEntry,
  type Dnd5e2014ClassEntry,
} from '@/domain/systems/dnd5e-2014';
import { Button } from '@/components/ui/Button';
import { InputField, SelectField } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { canEditSheetField, type SheetAccessContext } from './sheet-permissions';
import type { CharacterSheetRecord } from './types';

interface CharacterIdentityConfigModalProps {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  character: CharacterSheetRecord;
  access: SheetAccessContext;
  onUpdated: (nextCharacter: CharacterSheetRecord) => void;
}

export function CharacterIdentityConfigModal({
  open,
  onClose,
  campaignId,
  character,
  access,
  onUpdated,
}: CharacterIdentityConfigModalProps) {
  const s = character.sheetData;

  const [name, setName] = useState(character.name);
  const [playerName, setPlayerName] = useState(s.generalInfo.playerName ?? '');
  const [alignment, setAlignment] = useState(s.generalInfo.alignment ?? '');
  const [size, setSize] = useState(s.generalInfo.size ?? '');
  const [senses, setSenses] = useState(s.generalInfo.senses ?? '');
  const [race, setRace] = useState(s.raceAndClass.race ?? '');
  const [subrace, setSubrace] = useState(s.raceAndClass.subrace ?? '');
  const [classes, setClasses] = useState<Dnd5e2014ClassEntry[]>(
    s.raceAndClass.classes.length > 0
      ? s.raceAndClass.classes.map((c) => ({ ...c }))
      : [{ classId: 'fighter', level: 1 }]
  );
  const [backgroundName, setBackgroundName] = useState(s.background.backgroundName ?? '');
  const [armorProfs, setArmorProfs] = useState<string[]>(s.proficiencies.armor);
  const [weaponProfs, setWeaponProfs] = useState<string[]>(s.proficiencies.weapons);
  const [toolProfs, setToolProfs] = useState<string[]>(s.proficiencies.tools);
  const [languages, setLanguages] = useState<string[]>(s.proficiencies.languages);

  const [newProfText, setNewProfText] = useState({ armor: '', weapons: '', tools: '', languages: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEditName = canEditSheetField('name', access);
  const canEditPlayerName = canEditSheetField('generalInfo.playerName', access);
  const canEditAlignment = canEditSheetField('generalInfo.alignment', access);
  const canEditSize = canEditSheetField('generalInfo.size', access);
  const canEditSenses = canEditSheetField('generalInfo.senses', access);
  const canEditRace = canEditSheetField('raceAndClass.race', access);
  const canEditSubrace = canEditSheetField('raceAndClass.subrace', access);
  const canEditClasses = canEditSheetField('raceAndClass.classes', access);
  const canEditBackground = canEditSheetField('background.backgroundName', access);
  const canEditProfs = canEditSheetField('proficiencies', access);

  const totalClassLevel = classes.reduce((sum, c) => sum + c.level, 0);

  function addClassRow() {
    if (totalClassLevel >= 20) return;
    const usedIds = new Set(classes.map((c) => c.classId));
    const nextOfficial = DND5E_CLASSES.find((c) => !usedIds.has(c.id));
    setClasses((prev) => [
      ...prev,
      nextOfficial
        ? { classId: nextOfficial.id, subclassId: null, level: 1 }
        : { classId: 'custom', customClassName: 'Classe personalitzada', level: 1 },
    ]);
  }

  function addTag(
    list: string[],
    setter: (next: string[]) => void,
    raw: string,
    fieldKey: keyof typeof newProfText
  ) {
    const clean = raw.trim();
    if (!clean) return;
    if (!list.includes(clean)) setter([...list, clean]);
    setNewProfText((prev) => ({ ...prev, [fieldKey]: '' }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (totalClassLevel > 20) {
      setError('La suma dels nivells de classe no pot superar el nivell 20 oficial.');
      return;
    }

    const payload: Record<string, unknown> = {};
    const sheetPatch: Record<string, unknown> = {};

    const cleanName = name.trim();
    if (canEditName && cleanName && cleanName !== character.name) {
      payload.name = cleanName;
    }

    const generalInfoPatch: Record<string, unknown> = {};
    if (canEditPlayerName && (playerName.trim() || null) !== s.generalInfo.playerName) {
      generalInfoPatch.playerName = playerName.trim() || null;
    }
    if (canEditAlignment && (alignment.trim() || null) !== s.generalInfo.alignment) {
      generalInfoPatch.alignment = alignment.trim() || null;
    }
    if (canEditSize && (size.trim() || null) !== s.generalInfo.size) {
      generalInfoPatch.size = size.trim() || null;
    }
    if (canEditSenses && (senses.trim() || null) !== s.generalInfo.senses) {
      generalInfoPatch.senses = senses.trim() || null;
    }
    if (Object.keys(generalInfoPatch).length > 0) {
      sheetPatch.generalInfo = generalInfoPatch;
    }

    const raceAndClassPatch: Record<string, unknown> = {};
    if (canEditRace && (race.trim() || null) !== s.raceAndClass.race) {
      raceAndClassPatch.race = race.trim() || null;
    }
    if (canEditSubrace && (subrace.trim() || null) !== s.raceAndClass.subrace) {
      raceAndClassPatch.subrace = subrace.trim() || null;
    }
    if (canEditClasses && JSON.stringify(classes) !== JSON.stringify(s.raceAndClass.classes)) {
      raceAndClassPatch.classes = classes;
    }
    if (Object.keys(raceAndClassPatch).length > 0) {
      sheetPatch.raceAndClass = raceAndClassPatch;
    }

    if (canEditBackground && (backgroundName.trim() || null) !== s.background.backgroundName) {
      sheetPatch.background = { backgroundName: backgroundName.trim() || null };
    }

    if (canEditProfs) {
      const profPatch: Record<string, string[]> = {};
      if (JSON.stringify(armorProfs) !== JSON.stringify(s.proficiencies.armor)) profPatch.armor = armorProfs;
      if (JSON.stringify(weaponProfs) !== JSON.stringify(s.proficiencies.weapons)) profPatch.weapons = weaponProfs;
      if (JSON.stringify(toolProfs) !== JSON.stringify(s.proficiencies.tools)) profPatch.tools = toolProfs;
      if (JSON.stringify(languages) !== JSON.stringify(s.proficiencies.languages)) profPatch.languages = languages;
      if (Object.keys(profPatch).length > 0) {
        sheetPatch.proficiencies = profPatch;
      }
    }

    if (Object.keys(sheetPatch).length > 0) {
      payload.sheetPatch = sheetPatch;
    }

    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/characters/${character.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error?.message ?? 'No s’ha pogut actualitzar la configuració del personatge.');
        return;
      }
      onUpdated(data.character as CharacterSheetRecord);
      onClose();
    } catch {
      setError('Error de connexió en desar la configuració.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Configuració de personatge · ${character.name}`}
      description="Edita identitat, raça, classes, nivells, trasfons i competències respectant les regles de la campanya."
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        <div className="grid gap-3 sm:grid-cols-2">
          <InputField
            label="Nom del personatge"
            htmlFor="cfg-char-name"
            disabled={!canEditName}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <InputField
            label="Nom del jugador"
            htmlFor="cfg-player-name"
            disabled={!canEditPlayerName}
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <InputField
              label="Raça"
              htmlFor="cfg-race"
              list="cfg-race-datalist"
              disabled={!canEditRace}
              value={race}
              onChange={(e) => setRace(e.target.value)}
            />
            <datalist id="cfg-race-datalist">
              {DND5E_RACES.map((r) => (
                <option key={r.id} value={r.labelCa} />
              ))}
            </datalist>
          </div>
          <InputField
            label="Subraça / Llinatge"
            htmlFor="cfg-subrace"
            disabled={!canEditSubrace}
            value={subrace}
            onChange={(e) => setSubrace(e.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <SelectField
            label="Alineament"
            htmlFor="cfg-alignment"
            disabled={!canEditAlignment}
            value={alignment}
            onChange={(e) => setAlignment(e.target.value)}
          >
            <option value="">Sense especificar</option>
            {DND5E_ALIGNMENTS_CA.map((al) => (
              <option key={al} value={al}>
                {al}
              </option>
            ))}
          </SelectField>
          <InputField
            label="Mida"
            htmlFor="cfg-size"
            disabled={!canEditSize}
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder="Mitjana / Petita"
          />
          <InputField
            label="Sentits"
            htmlFor="cfg-senses"
            disabled={!canEditSenses}
            value={senses}
            onChange={(e) => setSenses(e.target.value)}
            placeholder="Visió foscor 18 m"
          />
        </div>

        <div>
          <InputField
            label="Antecedent / Trasfons"
            htmlFor="cfg-background"
            list="cfg-bg-datalist"
            disabled={!canEditBackground}
            value={backgroundName}
            onChange={(e) => setBackgroundName(e.target.value)}
          />
          <datalist id="cfg-bg-datalist">
            {DND5E_BACKGROUNDS.map((b) => (
              <option key={b.id} value={b.labelCa} />
            ))}
          </datalist>
        </div>

        {/* Classes i nivells (multiclasse) */}
        <div className="space-y-2 border-t border-[var(--rol-border-subtle)] pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--rol-ink-primary)]">
              Classes i nivell (Total: {totalClassLevel} / 20)
            </span>
            {canEditClasses && totalClassLevel < 20 && (
              <Button size="sm" variant="secondary" onClick={addClassRow}>
                <Plus className="h-3.5 w-3.5" />
                Afegir classe
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {classes.map((cls, idx) => {
              const meta = getClassEntry(cls.classId);
              const subList = DND5E_SUBCLASSES.filter((sub) => sub.classId === cls.classId);
              const subUnlocked = meta ? cls.level >= meta.subclassLevel : true;

              return (
                <div
                  key={`${cls.classId}-${idx}`}
                  className="grid gap-2 rounded border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/40 p-2 sm:grid-cols-12 sm:items-end"
                >
                  <div className="sm:col-span-5">
                    <label htmlFor={`cfg-cls-${idx}`} className="mb-0.5 block text-[11px] font-medium">
                      Classe
                    </label>
                    <select
                      id={`cfg-cls-${idx}`}
                      disabled={!canEditClasses}
                      value={cls.classId}
                      onChange={(e) =>
                        setClasses((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? { ...item, classId: e.target.value, subclassId: null }
                              : item
                          )
                        )
                      }
                      className="w-full rounded border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs"
                    >
                      {DND5E_CLASSES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.labelCa}
                        </option>
                      ))}
                      <option value="custom">Personalitzada</option>
                    </select>
                  </div>

                  <div className="sm:col-span-4">
                    <label htmlFor={`cfg-sub-${idx}`} className="mb-0.5 block text-[11px] font-medium">
                      Subclasse
                    </label>
                    {cls.classId === 'custom' ? (
                      <input
                        id={`cfg-sub-${idx}`}
                        type="text"
                        disabled={!canEditClasses}
                        placeholder="Classe personalitzada"
                        value={cls.customClassName ?? ''}
                        onChange={(e) =>
                          setClasses((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, customClassName: e.target.value } : item
                            )
                          )
                        }
                        className="w-full rounded border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs"
                      />
                    ) : (
                      <select
                        id={`cfg-sub-${idx}`}
                        disabled={!canEditClasses || !subUnlocked}
                        value={subUnlocked ? (cls.subclassId ?? '') : ''}
                        onChange={(e) =>
                          setClasses((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, subclassId: e.target.value || null } : item
                            )
                          )
                        }
                        className="w-full rounded border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs"
                      >
                        <option value="">
                          {subUnlocked ? 'Sense subclasse' : `Niv. ${meta?.subclassLevel ?? 3}`}
                        </option>
                        {subList.map((sc) => (
                          <option key={sc.id} value={sc.id}>
                            {sc.labelCa}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor={`cfg-lvl-${idx}`} className="mb-0.5 block text-[11px] font-medium">
                      Nivell
                    </label>
                    <input
                      id={`cfg-lvl-${idx}`}
                      type="number"
                      min={1}
                      max={20}
                      disabled={!canEditClasses}
                      value={cls.level}
                      onChange={(e) => {
                        const lvl = Math.min(20, Math.max(1, Math.trunc(Number(e.target.value) || 1)));
                        setClasses((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, level: lvl } : item))
                        );
                      }}
                      className="w-full rounded border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1 font-mono text-xs text-center"
                    />
                  </div>

                  <div className="sm:col-span-1 flex justify-end">
                    {canEditClasses && classes.length > 1 && (
                      <button
                        type="button"
                        aria-label="Eliminar classe"
                        onClick={() => setClasses((prev) => prev.filter((_, i) => i !== idx))}
                        className="rounded p-1 text-[var(--rol-status-danger-ink)] hover:bg-[var(--rol-status-danger-bg)] cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Competències editables */}
        {canEditProfs && (
          <div className="space-y-2 border-t border-[var(--rol-border-subtle)] pt-3 text-xs">
            <p className="font-semibold uppercase tracking-wide text-[var(--rol-ink-primary)]">
              Competències i idiomes
            </p>
            {(
              [
                ['armor', 'Armadures', armorProfs, setArmorProfs],
                ['weapons', 'Armes', weaponProfs, setWeaponProfs],
                ['tools', 'Eines', toolProfs, setToolProfs],
                ['languages', 'Idiomes', languages, setLanguages],
              ] as const
            ).map(([k, label, list, setter]) => (
              <div key={k} className="space-y-1">
                <span className="font-medium text-[var(--rol-ink-secondary)]">{label}:</span>
                <div className="flex flex-wrap gap-1">
                  {list.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)] px-2 py-0.5 text-[11px]"
                    >
                      {tag}
                      <button
                        type="button"
                        aria-label={`Treure ${tag}`}
                        onClick={() => setter(list.filter((item) => item !== tag))}
                        className="text-[var(--rol-status-danger-ink)] cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    list={k === 'languages' ? 'cfg-lang-datalist' : undefined}
                    placeholder={`Afegir ${label.toLowerCase()}…`}
                    value={newProfText[k]}
                    onChange={(e) =>
                      setNewProfText((prev) => ({ ...prev, [k]: e.target.value }))
                    }
                    className="flex-1 rounded border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!newProfText[k].trim()}
                    onClick={() => addTag(list, setter, newProfText[k], k)}
                  >
                    Afegir
                  </Button>
                </div>
              </div>
            ))}
            <datalist id="cfg-lang-datalist">
              {DND5E_LANGUAGES_CA.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-[var(--rol-radius-md)] border border-[var(--rol-status-danger-border)] bg-[var(--rol-status-danger-bg)] px-3 py-2 text-xs text-[var(--rol-status-danger-ink)]"
          >
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel·lar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Desant…' : 'Desar configuració'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
