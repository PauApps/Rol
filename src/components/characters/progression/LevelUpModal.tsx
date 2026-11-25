'use client';

import { useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowUpCircle, Heart, Plus, ShieldAlert, Sparkles, Swords, Trash2 } from 'lucide-react';
import {
  ABILITY_KEYS,
  ABILITY_LABELS_CA,
  ABILITY_SHORT_CA,
  DND5E_CLASSES,
  DND5E_SKILLS,
  buildLevelUpPatch,
  formatMulticlassRequirementCa,
  normalizeDnd5e2014Sheet,
  previewLevelUp,
  type AbilityKey,
  type Dnd5e2014SpellEntry,
  type SkillId,
} from '@/domain/systems/dnd5e-2014';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { InputField, SelectField } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import type { SheetAccessContext } from '../sheet-permissions';
import { formatSigned, type CharacterSheetRecord } from '../types';

interface LevelUpModalProps {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  character: CharacterSheetRecord;
  access: SheetAccessContext;
  onApplied: (nextCharacter: CharacterSheetRecord, warnings: string[]) => void;
}

export function LevelUpModal({
  open,
  onClose,
  campaignId,
  character,
  access,
  onApplied,
}: LevelUpModalProps) {
  const normalized = useMemo(
    () => normalizeDnd5e2014Sheet(character.sheetData, character.name),
    [character.sheetData, character.name]
  );

  const existingClasses = normalized.raceAndClass.classes;
  const availableMulticlassOptions = DND5E_CLASSES.filter(
    (c) => !existingClasses.some((ec) => ec.classId === c.id)
  );

  const [mode, setMode] = useState<'existing' | 'multiclass'>(
    existingClasses.length > 0 ? 'existing' : 'multiclass'
  );
  const [classId, setClassId] = useState<string>(
    existingClasses[0]?.classId ?? availableMulticlassOptions[0]?.id ?? 'fighter'
  );
  const [customClassName, setCustomClassName] = useState('');
  const [subclassId, setSubclassId] = useState<string>('');
  const [customSubclassName, setCustomSubclassName] = useState('');
  const [hpMode, setHpMode] = useState<'average' | 'custom'>('average');
  const [customHpGain, setCustomHpGain] = useState<number>(6);
  const [asiChoice, setAsiChoice] = useState<'none' | 'asi_plus2' | 'asi_plus1_plus1' | 'feat'>('none');
  const [asiAbility1, setAsiAbility1] = useState<AbilityKey>('str');
  const [asiAbility2, setAsiAbility2] = useState<AbilityKey>('con');
  const [featName, setFeatName] = useState('');
  const [featDescription, setFeatDescription] = useState('');
  const [addUnlockedFeatures, setAddUnlockedFeatures] = useState(true);
  const [multiclassSkillId, setMulticlassSkillId] = useState<SkillId | ''>('');
  const [newSpells, setNewSpells] = useState<Dnd5e2014SpellEntry[]>([]);
  const [spellDraftName, setSpellDraftName] = useState('');
  const [spellDraftLevel, setSpellDraftLevel] = useState(1);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const preview = useMemo(
    () =>
      previewLevelUp(normalized, {
        mode,
        classId,
        customClassName,
        subclassId: subclassId || undefined,
        customSubclassName: customSubclassName || undefined,
      }),
    [normalized, mode, classId, customClassName, subclassId, customSubclassName]
  );

  function handleAddSpell() {
    const clean = spellDraftName.trim();
    if (!clean) return;
    const isPact = classId === 'warlock';
    setNewSpells((prev) => [
      ...prev,
      {
        id: `sp-lvlup-${Date.now()}-${prev.length + 1}`,
        level: Math.min(9, Math.max(0, spellDraftLevel)),
        name: clean,
        castingTime: '1 acció',
        range: '',
        components: '',
        duration: '',
        school: null,
        sourceType: isPact ? 'pact' : 'class',
        sourceClassId: classId,
        alwaysPrepared: false,
        prepared: true,
        inSpellbook: classId === 'wizard',
        ritual: false,
        concentration: false,
        notes: '',
      },
    ]);
    setSpellDraftName('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlightRef.current || submitting) return;
    setError(null);

    const built = buildLevelUpPatch(normalized, {
      selection: {
        mode,
        classId,
        customClassName,
        subclassId: subclassId || undefined,
        customSubclassName: customSubclassName || undefined,
      },
      hpMode,
      customHpGain,
      subclassId: subclassId || undefined,
      customSubclassName: customSubclassName || undefined,
      asiChoice: preview.asiUnlock.unlocksNow ? asiChoice : 'none',
      asiAbility1,
      asiAbility2,
      featName,
      featDescription,
      addUnlockedFeatures,
      multiclassSkillId: multiclassSkillId || null,
      newSpells,
      notes,
      isGm: access.isGm,
    });

    if (built.errors.length > 0) {
      setError(built.errors[0]);
      return;
    }

    inFlightRef.current = true;
    setSubmitting(true);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/characters/${character.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetPatch: built.patch }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error?.message ?? 'No s’ha pogut aplicar la pujada de nivell.');
        return;
      }
      const nextChar = data.character as CharacterSheetRecord & { warnings?: string[] };
      onApplied(nextChar, Array.isArray(nextChar.warnings) ? nextChar.warnings : []);
      onClose();
    } catch {
      setError('Error de connexió en aplicar la pujada de nivell.');
    } finally {
      inFlightRef.current = false;
      setSubmitting(false);
    }
  }

  const mcSkillPool = preview.multiclassCheck.gainedProficiencies?.skillPool.filter(
    (sk) => !normalized.skills.proficient.includes(sk)
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Pujar de nivell · ${character.name}`}
      description="Configura la pujada oficial (+1 nivell) amb vista prèvia de PV, subclasse, ASI/dots, conjurs i recursos."
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {/* Selecció de classe o multiclasse */}
        <div className="space-y-2 rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/40 p-3">
          <div className="flex flex-wrap gap-2">
            {existingClasses.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setMode('existing');
                  setClassId(existingClasses[0].classId);
                  setSubclassId('');
                }}
                className={`rounded-[var(--rol-radius-sm)] border px-3 py-1 text-xs font-medium cursor-pointer ${
                  mode === 'existing'
                    ? 'border-[var(--rol-accent-primary)] bg-[var(--rol-accent-primary)] text-[var(--rol-accent-primary-ink)]'
                    : 'border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] text-[var(--rol-ink-secondary)]'
                }`}
              >
                Pujar classe existent
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMode('multiclass');
                setClassId(availableMulticlassOptions[0]?.id ?? 'custom');
                setSubclassId('');
              }}
              className={`rounded-[var(--rol-radius-sm)] border px-3 py-1 text-xs font-medium cursor-pointer ${
                mode === 'multiclass'
                  ? 'border-[var(--rol-accent-primary)] bg-[var(--rol-accent-primary)] text-[var(--rol-accent-primary-ink)]'
                  : 'border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] text-[var(--rol-ink-secondary)]'
              }`}
            >
              {existingClasses.length > 0 ? 'Afegir multiclasse' : 'Seleccionar classe inicial'}
            </button>
          </div>

          {mode === 'existing' ? (
            <SelectField
              label="Classe a pujar"
              htmlFor="lvlup-existing-class"
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setSubclassId('');
              }}
            >
              {existingClasses.map((ec) => (
                <option key={ec.classId} value={ec.classId}>
                  {ec.customClassName?.trim() ||
                    DND5E_CLASSES.find((c) => c.id === ec.classId)?.labelCa ||
                    ec.classId}{' '}
                  ({ec.level} → {ec.level + 1})
                </option>
              ))}
            </SelectField>
          ) : (
            <div className="space-y-2">
              <SelectField
                label="Nova classe"
                htmlFor="lvlup-new-class"
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setSubclassId('');
                }}
              >
                {availableMulticlassOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.labelCa} (Req.: {formatMulticlassRequirementCa(c.id)})
                  </option>
                ))}
                <option value="custom">Classe personalitzada</option>
              </SelectField>
              {classId === 'custom' && (
                <InputField
                  label="Nom de la classe personalitzada"
                  htmlFor="lvlup-custom-class"
                  required
                  value={customClassName}
                  onChange={(e) => setCustomClassName(e.target.value)}
                />
              )}
            </div>
          )}

          {preview.isMulticlassAddition && !preview.multiclassCheck.eligible && (
            <div className="flex items-start gap-2 rounded border border-[var(--rol-status-danger-border)] bg-[var(--rol-status-danger-bg)] px-2.5 py-2 text-xs text-[var(--rol-status-danger-ink)]">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                {preview.multiclassCheck.unmetRequirements.map((r) => (
                  <p key={r}>{r}</p>
                ))}
                {access.isGm && (
                  <p className="mt-0.5 font-semibold">
                    Com a GM pots aplicar-ho com a excepció de taula.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Resum de nivell i competència */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge tone="gold">
            <ArrowUpCircle className="h-3 w-3" />
            Nivell total: {preview.currentTotalLevel} → {preview.nextTotalLevel}
          </Badge>
          <Badge tone={preview.proficiencyBonusIncreased ? 'success' : 'neutral'}>
            Competència: {formatSigned(preview.proficiencyBonusBefore)} →{' '}
            {formatSigned(preview.proficiencyBonusAfter)}
          </Badge>
          {preview.hp.hitDie && (
            <Badge tone="neutral">Dau de cop: d{preview.hp.hitDie}</Badge>
          )}
        </div>

        {/* Increment de Punts de Cop */}
        <div className="space-y-2 rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--rol-ink-primary)]">
            <Heart className="h-3.5 w-3.5 text-[var(--rol-accent-primary)]" />
            <span>Punts de cop addicionals (Mod. CON {formatSigned(preview.hp.conModifier)})</span>
            {preview.hp.hillDwarfBonus > 0 && (
              <Badge tone="gold">+{preview.hp.hillDwarfBonus} Tenacitat nans</Badge>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded border border-[var(--rol-border-subtle)] px-2.5 py-2 text-xs cursor-pointer">
              <input
                type="radio"
                name="hpMode"
                checked={hpMode === 'average'}
                onChange={() => setHpMode('average')}
              />
              <span>
                Mitjana oficial: <strong>+{preview.hp.averageGain} PV</strong>
              </span>
            </label>
            <label className="flex items-center gap-2 rounded border border-[var(--rol-border-subtle)] px-2.5 py-2 text-xs cursor-pointer">
              <input
                type="radio"
                name="hpMode"
                checked={hpMode === 'custom'}
                onChange={() => setHpMode('custom')}
              />
              <span>Tirada / personalitzat:</span>
              <input
                type="number"
                min={1}
                max={access.isGm ? 50 : preview.hp.maxGain}
                disabled={hpMode !== 'custom'}
                value={customHpGain}
                onChange={(e) => setCustomHpGain(Math.max(1, Number(e.target.value) || 1))}
                className="w-16 rounded border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-1.5 py-0.5 font-mono text-xs text-center"
              />
            </label>
          </div>
        </div>

        {/* Subclasse si es desbloqueja ara */}
        {preview.subclassUnlock.needsSelection && (
          <div className="space-y-2 rounded-[var(--rol-radius-md)] border border-[var(--rol-accent-gold)] bg-[var(--rol-bg-surface-alt)]/30 p-3">
            <p className="text-xs font-semibold text-[var(--rol-ink-primary)]">
              Elecció de subclasse ({preview.classLabelCa} nivell {preview.nextClassLevel})
            </p>
            {preview.subclassUnlock.availableSubclasses.length > 0 ? (
              <SelectField
                label="Subclasse oficial"
                htmlFor="lvlup-subclass"
                value={subclassId}
                onChange={(e) => setSubclassId(e.target.value)}
              >
                <option value="">Selecciona més endavant / personalitzada</option>
                {preview.subclassUnlock.availableSubclasses.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.labelCa}
                  </option>
                ))}
              </SelectField>
            ) : null}
            {!subclassId && (
              <InputField
                label="Subclasse personalitzada (opcional)"
                htmlFor="lvlup-custom-sub"
                value={customSubclassName}
                onChange={(e) => setCustomSubclassName(e.target.value)}
                placeholder="Nom de la subclasse…"
              />
            )}
          </div>
        )}

        {/* ASI o Dot si es desbloqueja ara */}
        {preview.asiUnlock.unlocksNow && (
          <div className="space-y-2 rounded-[var(--rol-radius-md)] border border-[var(--rol-accent-gold)] bg-[var(--rol-bg-surface-alt)]/30 p-3">
            <p className="text-xs font-semibold text-[var(--rol-ink-primary)]">
              Millora de característiques (ASI) o Dot ({preview.classLabelCa} niv. {preview.asiUnlock.asiLevel})
            </p>
            <SelectField
              label="Opció d’ASI / Dot"
              htmlFor="lvlup-asi-choice"
              value={asiChoice}
              onChange={(e) => setAsiChoice(e.target.value as typeof asiChoice)}
            >
              <option value="none">Deixar pendent / aplicar manualment després</option>
              <option value="asi_plus2">+2 a una característica (màx. 20)</option>
              <option value="asi_plus1_plus1">+1 a dues característiques diferents (màx. 20)</option>
              <option value="feat">Dot (Feat)</option>
            </SelectField>

            {asiChoice === 'asi_plus2' && (
              <SelectField
                label="Característica (+2)"
                htmlFor="lvlup-asi-1"
                value={asiAbility1}
                onChange={(e) => setAsiAbility1(e.target.value as AbilityKey)}
              >
                {ABILITY_KEYS.map((ab) => (
                  <option key={ab} value={ab}>
                    {ABILITY_LABELS_CA[ab]} ({normalized.abilities[ab] ?? 10})
                  </option>
                ))}
              </SelectField>
            )}

            {asiChoice === 'asi_plus1_plus1' && (
              <div className="grid gap-2 sm:grid-cols-2">
                <SelectField
                  label="1a característica (+1)"
                  htmlFor="lvlup-asi-p1"
                  value={asiAbility1}
                  onChange={(e) => setAsiAbility1(e.target.value as AbilityKey)}
                >
                  {ABILITY_KEYS.map((ab) => (
                    <option key={ab} value={ab}>
                      {ABILITY_LABELS_CA[ab]} ({normalized.abilities[ab] ?? 10})
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="2a característica (+1)"
                  htmlFor="lvlup-asi-p2"
                  value={asiAbility2}
                  onChange={(e) => setAsiAbility2(e.target.value as AbilityKey)}
                >
                  {ABILITY_KEYS.map((ab) => (
                    <option key={ab} value={ab}>
                      {ABILITY_LABELS_CA[ab]} ({normalized.abilities[ab] ?? 10})
                    </option>
                  ))}
                </SelectField>
              </div>
            )}

            {asiChoice === 'feat' && (
              <div className="grid gap-2 sm:grid-cols-2">
                <InputField
                  label="Nom del dot"
                  htmlFor="lvlup-feat-name"
                  required
                  value={featName}
                  onChange={(e) => setFeatName(e.target.value)}
                  placeholder="Ex. Alerta, Centinella, Llançador de guerra"
                />
                <InputField
                  label="Descripció breu del dot"
                  htmlFor="lvlup-feat-desc"
                  value={featDescription}
                  onChange={(e) => setFeatDescription(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {/* Beneficis de multiclasse */}
        {preview.isMulticlassAddition && preview.multiclassCheck.gainedProficiencies && (
          <div className="space-y-2 rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] p-3 text-xs">
            <p className="font-semibold text-[var(--rol-ink-primary)]">
              Beneficis de multiclasse en {preview.classLabelCa} (PHB p. 164)
            </p>
            <p className="text-[var(--rol-ink-secondary)]">
              Armadures:{' '}
              {preview.multiclassCheck.gainedProficiencies.armor.join(', ') || 'Cap'} · Armes:{' '}
              {preview.multiclassCheck.gainedProficiencies.weapons.join(', ') || 'Cap'} · Eines:{' '}
              {preview.multiclassCheck.gainedProficiencies.tools.join(', ') || 'Cap'}
            </p>
            {preview.multiclassCheck.gainedProficiencies.extraSkillCount > 0 && mcSkillPool && mcSkillPool.length > 0 && (
              <SelectField
                label="Habilitat addicional per multiclasse"
                htmlFor="lvlup-mc-skill"
                value={multiclassSkillId}
                onChange={(e) => setMulticlassSkillId(e.target.value as SkillId | '')}
              >
                <option value="">Selecciona una habilitat…</option>
                {mcSkillPool.map((sk) => (
                  <option key={sk} value={sk}>
                    {DND5E_SKILLS.find((s) => s.id === sk)?.labelCa ?? sk}
                  </option>
                ))}
              </SelectField>
            )}
          </div>
        )}

        {/* Trets de classe desbloquejats */}
        {preview.unlockedClassFeatures.length > 0 && (
          <div className="space-y-2 rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] p-3 text-xs">
            <label className="inline-flex items-center gap-2 font-semibold text-[var(--rol-ink-primary)] cursor-pointer">
              <input
                type="checkbox"
                checked={addUnlockedFeatures}
                onChange={(e) => setAddUnlockedFeatures(e.target.checked)}
              />
              <span>Afegir automàticament les capacitats desbloquejades als Trets i aptituds</span>
            </label>
            <ul className="list-disc space-y-1 pl-5 text-[var(--rol-ink-secondary)]">
              {preview.unlockedClassFeatures.map((f) => (
                <li key={f.titleCa}>
                  <strong>{f.titleCa}:</strong> {f.descriptionCa}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Canvis en màgia i recursos */}
        {(preview.spellcastingDelta.gainedSlots.length > 0 ||
          preview.spellcastingDelta.pactChanged ||
          (preview.spellcastingDelta.preparedLimitDelta ?? 0) > 0 ||
          preview.resourceDelta.length > 0) && (
          <div className="space-y-2 rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/30 p-3 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-[var(--rol-ink-primary)]">
              <Sparkles className="h-3.5 w-3.5 text-[var(--rol-accent-gold)]" />
              <span>Canvis en màgia i recursos oficials</span>
            </div>
            {preview.spellcastingDelta.gainedSlots.length > 0 && (
              <p>
                <strong>Espais de conjur:</strong>{' '}
                {preview.spellcastingDelta.gainedSlots
                  .map((s) => `Niv.${s.level}: ${s.before} → ${s.after}`)
                  .join(' · ')}
              </p>
            )}
            {preview.spellcastingDelta.pactChanged && preview.spellcastingDelta.after?.pactMagic && (
              <p>
                <strong>Màgia de Pacte:</strong>{' '}
                {preview.spellcastingDelta.after.pactMagic.count} espais de cercle{' '}
                {preview.spellcastingDelta.after.pactMagic.slotLevel}
              </p>
            )}
            {(preview.spellcastingDelta.preparedLimitDelta ?? 0) > 0 && (
              <p>
                <strong>Límit de conjurs preparats:</strong> +
                {preview.spellcastingDelta.preparedLimitDelta}
              </p>
            )}
            {preview.resourceDelta.length > 0 && (
              <p className="flex flex-wrap items-center gap-1.5">
                <Swords className="h-3 w-3 text-[var(--rol-accent-primary)]" />
                <strong>Recursos:</strong>
                {preview.resourceDelta
                  .map((r) =>
                    r.isNew
                      ? `${r.name} (nou: ${r.unlimitedAfter ? '∞' : r.afterMax})`
                      : `${r.name} (${r.beforeMax ?? '—'} → ${r.unlimitedAfter ? '∞' : r.afterMax})`
                  )
                  .join(' · ')}
              </p>
            )}
          </div>
        )}

        {/* Conjurs nous opcionals si té màgia activa */}
        {preview.spellcastingDelta.after && (
          <div className="space-y-2 rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] p-3 text-xs">
            <p className="font-semibold text-[var(--rol-ink-primary)]">
              Afegir nous conjurs coneguts / preparats (opcional)
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[160px]">
                <InputField
                  label="Nom del conjur"
                  htmlFor="lvlup-spell-name"
                  value={spellDraftName}
                  onChange={(e) => setSpellDraftName(e.target.value)}
                  placeholder="Ex. Bola de foc"
                />
              </div>
              <div className="w-24">
                <SelectField
                  label="Cercle"
                  htmlFor="lvlup-spell-lvl"
                  value={spellDraftLevel}
                  onChange={(e) => setSpellDraftLevel(Number(e.target.value))}
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl === 0 ? 'Truc' : `Niv. ${lvl}`}
                    </option>
                  ))}
                </SelectField>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!spellDraftName.trim()}
                onClick={handleAddSpell}
              >
                <Plus className="h-3.5 w-3.5" />
                Afegir
              </Button>
            </div>
            {newSpells.length > 0 && (
              <ul className="flex flex-wrap gap-1.5 pt-1">
                {newSpells.map((sp) => (
                  <li
                    key={sp.id}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)] px-2.5 py-0.5"
                  >
                    <span>
                      {sp.name} ({sp.level === 0 ? 'Truc' : `${sp.level}è`})
                    </span>
                    <button
                      type="button"
                      aria-label={`Treure ${sp.name}`}
                      onClick={() => setNewSpells((prev) => prev.filter((x) => x.id !== sp.id))}
                      className="text-[var(--rol-status-danger-ink)] cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <InputField
          label="Notes d’aquesta pujada de nivell (opcional)"
          htmlFor="lvlup-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex. Entrenament amb la guàrdia de Phandalin"
        />

        {error && (
          <div
            role="alert"
            className="rounded-[var(--rol-radius-md)] border border-[var(--rol-status-danger-border)] bg-[var(--rol-status-danger-bg)] px-3 py-2 text-xs text-[var(--rol-status-danger-ink)]"
          >
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" disabled={submitting} onClick={onClose}>
            Cancel·lar
          </Button>
          <Button
            type="submit"
            disabled={
              submitting ||
              !preview.canLevelUp ||
              (preview.isMulticlassAddition && !preview.multiclassCheck.eligible && !access.isGm)
            }
          >
            <ArrowUpCircle className="h-3.5 w-3.5" />
            {submitting ? 'Aplicant…' : `Confirmar nivell ${preview.nextTotalLevel}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
