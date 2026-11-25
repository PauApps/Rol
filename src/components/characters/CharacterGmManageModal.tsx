'use client';

import { useState, type FormEvent } from 'react';
import {
  DEFAULT_PLAYER_EDITABLE_FIELDS,
  GM_GRANTABLE_PLAYER_FIELDS,
  PROTECTED_OFFICIAL_CALCULATION_PATHS,
} from '@/domain/systems/dnd5e-2014';
import { Button } from '@/components/ui/Button';
import { TextareaField } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import type { CharacterSheetRecord } from './types';

interface CharacterGmManageModalProps {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  character: CharacterSheetRecord;
  onUpdated: (nextCharacter: CharacterSheetRecord) => void;
}

const SECTION_LABELS: Record<string, string> = {
  name: 'Nom del personatge',
  'generalInfo.playerName': 'Nom del jugador',
  'generalInfo.alignment': 'Alineament',
  'generalInfo.faith': 'Fe / Deïtat',
  'generalInfo.age': 'Edat',
  'generalInfo.size': 'Mida',
  'generalInfo.senses': 'Sentits',
  'generalInfo.appearanceNotes': 'Aspecte físic',
  'raceAndClass.race': 'Raça',
  'raceAndClass.subrace': 'Subraça',
  'raceAndClass.classes': 'Classes i nivells (pujada de nivell)',
  abilities: 'Característiques',
  savingThrows: 'Salvacions',
  skills: 'Habilitats',
  proficiencies: 'Competències',
  hitPoints: 'Punts i daus de cop',
  armorClass: "Classe d'armadura (notes/sense armadura)",
  speed: 'Velocitat',
  attacks: 'Atacs manuals',
  inventory: 'Inventari',
  currency: 'Monedes',
  traitsAndFeatures: 'Trets i aptituds',
  spellcasting: 'Màgia',
  spells: 'Conjurs',
  spellSlotsUsed: 'Espais de conjur gastats',
  resourceUsage: 'Ús de recursos',
  'progression.experiencePoints': 'Punts d’experiència (PE)',
  'progression.totalLevel': 'Nivell total',
  'progression.inspiration': 'Inspiració',
  'progression.abilityScoreImprovements': 'Notes de millores (ASI/Dots)',
  'progression.levelHistory': 'Historial de nivells',
  'background.backgroundName': 'Nom del rerefons',
  'background.personalityTraits': 'Trets de personalitat',
  'background.ideals': 'Ideals',
  'background.bonds': 'Vincles',
  'background.flaws': 'Defectes',
  'background.backstory': 'Història personal',
  'background.sessionNotes': 'Notes de sessió',
  'background.additionalNotes': 'Notes addicionals',
};

const OVERRIDE_LABELS: Record<string, string> = {
  'savingThrows.overrides': 'Overrides de salvacions',
  'skills.overrides': 'Overrides d’habilitats',
  'armorClass.override': 'Override de CA',
  'initiative.override': 'Override d’iniciativa',
  'initiative.bonus': 'Bonificador fix d’iniciativa',
  'attacks.ability': 'Característica d’atac no oficial',
  'attacks.proficient': 'Competència excepcional d’atac',
  'attacks.gmCustom': 'Atacs personalitzats GM',
  'attacks.bonusOverride': 'Override numèric d’atac',
  'attacks.attackBonus': 'Text de bonificador d’atac',
  'inventory.weaponProficient': 'Competència excepcional d’arma',
  'inventory.weaponAbilityOverride': 'Característica excepcional d’arma',
  'attunement.limitOverride': 'Límit de sintonització',
  'spellcasting.abilityOverride': 'Override global d’aptitud màgica',
  'spellcasting.saveDcOverride': 'Override global de CD de conjurs',
  'spellcasting.attackBonusOverride': 'Override global d’atac màgic',
  'spellcasting.sourceOverrides': 'Overrides de màgia per classe',
  spellSlotOverrides: 'Overrides d’espais de conjur',
  customResources: 'Recursos personalitzats',
};

export function CharacterGmManageModal({
  open,
  onClose,
  campaignId,
  character,
  onUpdated,
}: CharacterGmManageModalProps) {
  const [gmNotes, setGmNotes] = useState(character.gmNotes ?? '');
  const [playerEditableFields, setPlayerEditableFields] = useState<string[]>(
    character.fieldPermissions?.playerEditableFields ?? [...DEFAULT_PLAYER_EDITABLE_FIELDS]
  );
  const [gmOnlyFields, setGmOnlyFields] = useState<string[]>(
    character.fieldPermissions?.gmOnlyFields ?? []
  );
  const [authorizedOverrideFields, setAuthorizedOverrideFields] = useState<string[]>(
    character.fieldPermissions?.authorizedOverrideFields ?? []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleInList(list: string[], setter: (next: string[]) => void, value: string) {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/characters/${character.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gmNotes,
          fieldPermissions: {
            playerEditableFields,
            gmOnlyFields,
            authorizedOverrideFields,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error?.message ?? 'No s’han pogut desar els permisos del personatge.');
        return;
      }
      onUpdated(data.character as CharacterSheetRecord);
      onClose();
    } catch {
      setError('Error de connexió en desar la configuració del GM.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Gestió GM · ${character.name}`}
      description="Configura notes privades del Director de Joc i els permisos granulars d’edició del jugador."
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        <TextareaField
          label="Notes privades del GM (invisibles per als jugadors)"
          htmlFor="sheet-gm-notes"
          rows={3}
          value={gmNotes}
          onChange={(e) => setGmNotes(e.target.value)}
          placeholder="Secrets, trames o recordatoris interns…"
        />

        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--rol-ink-primary)]">
            Seccions editables pel jugador propietari
          </p>
          <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/40 p-2.5 text-xs sm:grid-cols-2">
            {GM_GRANTABLE_PLAYER_FIELDS.map((fieldPath) => {
              const checked = playerEditableFields.includes(fieldPath);
              const blockedByGmOnly = gmOnlyFields.includes(fieldPath);
              return (
                <label
                  key={fieldPath}
                  className="inline-flex items-center gap-2 cursor-pointer text-[var(--rol-ink-primary)]"
                >
                  <input
                    type="checkbox"
                    checked={checked && !blockedByGmOnly}
                    disabled={blockedByGmOnly}
                    onChange={() => toggleInList(playerEditableFields, setPlayerEditableFields, fieldPath)}
                  />
                  <span className="truncate">{SECTION_LABELS[fieldPath] ?? fieldPath}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--rol-ink-primary)]">
            Excepcions oficials autoritzades al jugador (overrides)
          </p>
          <p className="text-[11px] text-[var(--rol-ink-muted)]">
            Per defecte tots aquests camins estan protegits al servidor (`403 OFFICIAL_CALCULATION_PROTECTED`).
          </p>
          <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/40 p-2.5 text-xs sm:grid-cols-2">
            {PROTECTED_OFFICIAL_CALCULATION_PATHS.map((overridePath) => {
              const checked = authorizedOverrideFields.includes(overridePath);
              return (
                <label
                  key={overridePath}
                  className="inline-flex items-center gap-2 cursor-pointer text-[var(--rol-ink-primary)]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      toggleInList(
                        authorizedOverrideFields,
                        setAuthorizedOverrideFields,
                        overridePath
                      )
                    }
                  />
                  <span className="truncate">{OVERRIDE_LABELS[overridePath] ?? overridePath}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--rol-ink-primary)]">
            Seccions ocultes per als jugadors (`gmOnlyFields`)
          </p>
          <div className="grid grid-cols-2 gap-1.5 rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/40 p-2.5 text-xs sm:grid-cols-3">
            {(
              [
                ['abilities', 'Característiques'],
                ['savingThrows', 'Salvacions'],
                ['skills', 'Habilitats'],
                ['hitPoints', 'Punts de cop'],
                ['attacks', 'Atacs'],
                ['background.sessionNotes', 'Diari de sessions'],
                ['background.additionalNotes', 'Notes addicionals'],
              ] as const
            ).map(([path, label]) => (
              <label key={path} className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gmOnlyFields.includes(path)}
                  onChange={() => toggleInList(gmOnlyFields, setGmOnlyFields, path)}
                />
                <span className="truncate">{label}</span>
              </label>
            ))}
          </div>
        </div>

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
            {saving ? 'Desant…' : 'Desar permisos'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
