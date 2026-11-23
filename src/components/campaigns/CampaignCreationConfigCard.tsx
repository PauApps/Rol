'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ScrollText } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { InputField, SelectField, TextareaField } from '@/components/ui/Field';
import {
  ABILITY_METHOD_LABELS_CA,
  CREATION_REQUIRED_FIELD_OPTIONS,
  FREEDOM_MODE_LABELS_CA,
  REQUIRED_FIELD_LABELS_CA,
  type AbilityScoreMethod,
  type CampaignCreationConfig,
  type CreationFreedomMode,
  type CreationRequiredFieldKey,
} from '@/domain/campaigns/creation-config';

interface CampaignCreationConfigCardProps {
  campaignId: string;
  canManage: boolean;
  initialConfig: CampaignCreationConfig;
  initialMaxCharactersPerPlayer: number | null;
}

function parseCommaList(raw: string): string[] {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function CampaignCreationConfigCard({
  campaignId,
  canManage,
  initialConfig,
  initialMaxCharactersPerPlayer,
}: CampaignCreationConfigCardProps) {
  const router = useRouter();
  const [freedomMode, setFreedomMode] = useState<CreationFreedomMode>(initialConfig.freedomMode);
  const [startingLevel, setStartingLevel] = useState<number>(initialConfig.startingLevel);
  const [abilityScoreMethod, setAbilityScoreMethod] = useState<AbilityScoreMethod>(
    initialConfig.abilityScoreMethod
  );
  const [allowedRacesText, setAllowedRacesText] = useState(initialConfig.allowedRaces.join(', '));
  const [allowedClassesText, setAllowedClassesText] = useState(
    initialConfig.allowedClasses.join(', ')
  );
  const [allowedBackgroundsText, setAllowedBackgroundsText] = useState(
    initialConfig.allowedBackgrounds.join(', ')
  );
  const [requiredFields, setRequiredFields] = useState<CreationRequiredFieldKey[]>(
    initialConfig.requiredFields
  );
  const [restrictions, setRestrictions] = useState(initialConfig.restrictions);
  const [maxCharsText, setMaxCharsText] = useState(
    initialMaxCharactersPerPlayer !== null ? String(initialMaxCharactersPerPlayer) : ''
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  function toggleRequiredField(key: CreationRequiredFieldKey) {
    if (key === 'name') return;
    setRequiredFields((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaveMessage(null);

    const trimmedLimit = maxCharsText.trim();
    let parsedLimit: number | null = null;
    if (trimmedLimit !== '') {
      const n = Number(trimmedLimit);
      if (!Number.isInteger(n) || n < 1 || n > 50) {
        setError('El límit de personatges ha de ser un enter entre 1 i 50, o buit per il·limitat.');
        return;
      }
      parsedLimit = n;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/creation-config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxCharactersPerPlayer: parsedLimit,
          creationConfig: {
            freedomMode,
            startingLevel: Number(startingLevel),
            abilityScoreMethod,
            allowedRaces: parseCommaList(allowedRacesText),
            allowedClasses: parseCommaList(allowedClassesText),
            allowedBackgrounds: parseCommaList(allowedBackgroundsText),
            requiredFields,
            restrictions,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error?.message ?? 'No s’ha pogut desar la configuració de creació.');
        return;
      }
      setSaveMessage('Regles de creació i límit desats correctament.');
      router.refresh();
    } catch {
      setError('Error de connexió en desar la configuració.');
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) {
    return (
      <Card
        title="Regles de creació de personatges"
        subtitle="Criteris configurats pel Director de Joc per a aquesta campanya."
        actions={<ScrollText className="h-4 w-4 text-[var(--rol-accent-gold)]" />}
      >
        <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs uppercase text-[var(--rol-ink-muted)]">Nivell inicial</p>
            <p className="mt-1 font-semibold">Nivell {initialConfig.startingLevel}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-[var(--rol-ink-muted)]">Grau de llibertat</p>
            <p className="mt-1 font-medium">{FREEDOM_MODE_LABELS_CA[initialConfig.freedomMode]}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-[var(--rol-ink-muted)]">Característiques</p>
            <p className="mt-1 font-medium">
              {ABILITY_METHOD_LABELS_CA[initialConfig.abilityScoreMethod]}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-[var(--rol-ink-muted)]">Límit per jugador</p>
            <p className="mt-1 font-semibold">
              {initialMaxCharactersPerPlayer !== null
                ? `${initialMaxCharactersPerPlayer} personatge(s)`
                : 'Sense límit'}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 border-t border-[var(--rol-border-subtle)] pt-4 text-xs sm:grid-cols-3">
          <div>
            <p className="font-semibold text-[var(--rol-ink-primary)]">Races permeses</p>
            <p className="mt-1 text-[var(--rol-ink-secondary)]">
              {initialConfig.allowedRaces.length > 0
                ? initialConfig.allowedRaces.join(', ')
                : 'Totes les races disponibles'}
            </p>
          </div>
          <div>
            <p className="font-semibold text-[var(--rol-ink-primary)]">Classes permeses</p>
            <p className="mt-1 text-[var(--rol-ink-secondary)]">
              {initialConfig.allowedClasses.length > 0
                ? initialConfig.allowedClasses.join(', ')
                : 'Totes les classes disponibles'}
            </p>
          </div>
          <div>
            <p className="font-semibold text-[var(--rol-ink-primary)]">Antecedents permesos</p>
            <p className="mt-1 text-[var(--rol-ink-secondary)]">
              {initialConfig.allowedBackgrounds.length > 0
                ? initialConfig.allowedBackgrounds.join(', ')
                : 'Tots els antecedents disponibles'}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold text-[var(--rol-ink-primary)]">Camps obligatoris:</span>
          {initialConfig.requiredFields.map((fieldKey) => (
            <Badge key={fieldKey} tone="neutral">
              {REQUIRED_FIELD_LABELS_CA[fieldKey]}
            </Badge>
          ))}
        </div>

        {initialConfig.restrictions && (
          <div className="mt-3 rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/50 p-3 text-xs text-[var(--rol-ink-secondary)]">
            <span className="font-semibold text-[var(--rol-ink-primary)]">Restriccions: </span>
            {initialConfig.restrictions}
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card
      title="Configuració de creació i límits de personatges"
      subtitle="Defineix les regles d’inici de la taula i quants personatges pot crear cada jugador."
      actions={<Badge tone="gold">Editable en qualsevol moment</Badge>}
    >
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InputField
            label="Nivell inicial (1–20)"
            htmlFor="rule-starting-level"
            type="number"
            min={1}
            max={20}
            required
            value={startingLevel}
            onChange={(e) => setStartingLevel(Number(e.target.value))}
          />

          <SelectField
            label="Grau de llibertat"
            htmlFor="rule-freedom-mode"
            value={freedomMode}
            onChange={(e) => setFreedomMode(e.target.value as CreationFreedomMode)}
          >
            {(Object.keys(FREEDOM_MODE_LABELS_CA) as CreationFreedomMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {FREEDOM_MODE_LABELS_CA[mode]}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Mètode de característiques"
            htmlFor="rule-ability-method"
            value={abilityScoreMethod}
            onChange={(e) => setAbilityScoreMethod(e.target.value as AbilityScoreMethod)}
          >
            {(Object.keys(ABILITY_METHOD_LABELS_CA) as AbilityScoreMethod[]).map((method) => (
              <option key={method} value={method}>
                {ABILITY_METHOD_LABELS_CA[method]}
              </option>
            ))}
          </SelectField>

          <InputField
            label="Límit de personatges per jugador"
            htmlFor="rule-max-chars"
            type="number"
            min={1}
            max={50}
            value={maxCharsText}
            onChange={(e) => setMaxCharsText(e.target.value)}
            placeholder="Sense límit"
            hint="Deixa-ho buit per il·limitat."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <InputField
            label="Races permeses"
            htmlFor="rule-races"
            type="text"
            value={allowedRacesText}
            onChange={(e) => setAllowedRacesText(e.target.value)}
            placeholder="Ex. Humà, Elf, Nan"
            hint="Separades per comes. Buit = totes."
          />
          <InputField
            label="Classes permeses"
            htmlFor="rule-classes"
            type="text"
            value={allowedClassesText}
            onChange={(e) => setAllowedClassesText(e.target.value)}
            placeholder="Ex. Guerrer, Mag, Murri"
            hint="Separades per comes. Buit = totes."
          />
          <InputField
            label="Antecedents permesos"
            htmlFor="rule-backgrounds"
            type="text"
            value={allowedBackgroundsText}
            onChange={(e) => setAllowedBackgroundsText(e.target.value)}
            placeholder="Ex. Acòlit, Soldat, Erudit"
            hint="Separats per comes. Buit = tots."
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--rol-ink-primary)]">Camps obligatoris</p>
          <div className="flex flex-wrap gap-2">
            {CREATION_REQUIRED_FIELD_OPTIONS.map((key) => {
              const checked = requiredFields.includes(key);
              const locked = key === 'name';
              return (
                <label
                  key={key}
                  className={`inline-flex items-center gap-2 rounded-[var(--rol-radius-sm)] border px-3 py-1.5 text-xs ${
                    checked
                      ? 'border-[var(--rol-accent-gold)] bg-[var(--rol-accent-gold-soft)]/50 text-[var(--rol-ink-primary)]'
                      : 'border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] text-[var(--rol-ink-secondary)]'
                  } ${locked ? 'opacity-80' : 'cursor-pointer'}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={locked}
                    onChange={() => toggleRequiredField(key)}
                  />
                  <span>{REQUIRED_FIELD_LABELS_CA[key]}</span>
                </label>
              );
            })}
          </div>
        </div>

        <TextareaField
          label="Restriccions i notes de creació"
          htmlFor="rule-restrictions"
          rows={2}
          value={restrictions}
          onChange={(e) => setRestrictions(e.target.value)}
          placeholder="Ex. Només contingut del Player’s Handbook 2014; sense multiclasse a nivell 1."
        />

        {error && (
          <div
            role="alert"
            className="rounded-[var(--rol-radius-md)] border border-[var(--rol-status-danger-border)] bg-[var(--rol-status-danger-bg)] px-3.5 py-2.5 text-sm text-[var(--rol-status-danger-ink)]"
          >
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Desant regles…' : 'Desar regles i límits'}
          </Button>
          {saveMessage && (
            <span className="text-xs font-medium text-[var(--rol-status-success-ink)]">
              {saveMessage}
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}
