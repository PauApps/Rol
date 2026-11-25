'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Sparkles,
} from 'lucide-react';
import {
  ABILITY_METHOD_LABELS_CA,
  FREEDOM_MODE_LABELS_CA,
  type CampaignCreationConfig,
} from '@/domain/campaigns/creation-config';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatClassesSummary, formatRaceSummary, formatSigned } from '../types';
import { StepAbilities } from './StepAbilities';
import { StepBackgroundProficiencies } from './StepBackgroundProficiencies';
import { StepClassFeatures } from './StepClassFeatures';
import { StepEquipment } from './StepEquipment';
import { StepIdentity, type CampaignMemberOption } from './StepIdentity';
import { StepReview } from './StepReview';
import {
  WIZARD_STEPS,
  buildPreviewFromWizard,
  buildSheetPatchFromWizard,
  createInitialWizardState,
  validateWizardStep,
  type CharacterWizardState,
  type WizardStepId,
} from './wizard-state';

interface CharacterCreationWizardClientProps {
  campaign: {
    id: string;
    name: string;
    systemName: string;
    creationConfig: CampaignCreationConfig;
    maxCharactersPerPlayer: number | null;
  };
  canManage: boolean;
  myCharacterCount: number;
  members: readonly CampaignMemberOption[];
}

export function CharacterCreationWizardClient({
  campaign,
  canManage,
  myCharacterCount,
  members,
}: CharacterCreationWizardClientProps) {
  const router = useRouter();
  const config = campaign.creationConfig;

  const [step, setStep] = useState<WizardStepId>(1);
  const [state, setState] = useState<CharacterWizardState>(() =>
    createInitialWizardState(config)
  );
  const [stepErrors, setStepErrors] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlightRef = useRef(false);

  const playerAtLimit =
    !canManage &&
    campaign.maxCharactersPerPlayer !== null &&
    myCharacterCount >= campaign.maxCharactersPerPlayer;

  const currentCheck = validateWizardStep(step, state, config, canManage);
  const { sheet: previewSheet, computed: previewComputed } = buildPreviewFromWizard(
    state,
    config,
    canManage
  );

  function updateWizardState(updater: (prev: CharacterWizardState) => CharacterWizardState) {
    setStepErrors([]);
    setSubmitError(null);
    setState(updater);
  }

  function handleNext() {
    const check = validateWizardStep(step, state, config, canManage);
    if (check.errors.length > 0) {
      setStepErrors(check.errors);
      return;
    }
    setStepErrors([]);
    if (step < 6) {
      setStep((step + 1) as WizardStepId);
    }
  }

  function handleBack() {
    setStepErrors([]);
    if (step > 1) {
      setStep((step - 1) as WizardStepId);
    }
  }

  async function handleCreate() {
    if (inFlightRef.current || playerAtLimit) return;

    const allErrors: string[] = [];
    for (const s of [1, 2, 3, 4] as const) {
      allErrors.push(...validateWizardStep(s, state, config, canManage).errors);
    }
    if (allErrors.length > 0) {
      setStepErrors(allErrors);
      return;
    }

    inFlightRef.current = true;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const payload = buildSheetPatchFromWizard(state, config, canManage);
      const response = await fetch(`/api/campaigns/${campaign.id}/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setSubmitError(data?.error?.message ?? 'No s’ha pogut crear el personatge.');
        return;
      }

      const newId = data?.character?.id;
      if (typeof newId === 'string' && newId) {
        router.push(`/campaigns/${campaign.id}/characters/${newId}`);
        router.refresh();
      } else {
        router.push(`/campaigns/${campaign.id}`);
        router.refresh();
      }
    } catch {
      setSubmitError('Error de connexió en crear el personatge.');
    } finally {
      inFlightRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/campaigns/${campaign.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--rol-ink-secondary)] hover:text-[var(--rol-accent-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Tornar a {campaign.name}
        </Link>

        <div className="flex flex-wrap gap-2">
          <Badge tone="gold">{FREEDOM_MODE_LABELS_CA[config.freedomMode]}</Badge>
          <Badge tone="neutral">Nivell inicial: {config.startingLevel}</Badge>
          <Badge tone="neutral">{ABILITY_METHOD_LABELS_CA[config.abilityScoreMethod]}</Badge>
        </div>
      </div>

      {playerAtLimit && (
        <div
          role="alert"
          className="rounded-[var(--rol-radius-md)] border border-[var(--rol-status-danger-border)] bg-[var(--rol-status-danger-bg)] p-4 text-sm text-[var(--rol-status-danger-ink)]"
        >
          Has assolit el límit de {campaign.maxCharactersPerPlayer} personatge(s) per jugador en
          aquesta campanya. No en pots crear cap més tret que el GM augmenti el límit.
        </div>
      )}

      {/* Indicador de passos */}
      <nav aria-label="Passos de creació" className="rol-sheet-banner p-3 sm:p-4">
        <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {WIZARD_STEPS.map((s) => {
            const active = s.id === step;
            const completed = s.id < step;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setStepErrors([]);
                    setStep(s.id);
                  }}
                  aria-current={active ? 'step' : undefined}
                  className={`flex w-full items-center gap-2 rounded-[var(--rol-radius-sm)] border px-2.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                    active
                      ? 'border-[var(--rol-accent-primary)] bg-[var(--rol-accent-primary)] text-[var(--rol-accent-primary-ink)] font-semibold'
                      : completed
                        ? 'border-[var(--rol-status-success-border)] bg-[var(--rol-status-success-bg)]/60 text-[var(--rol-status-success-ink)]'
                        : 'border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] text-[var(--rol-ink-secondary)]'
                  }`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-[10px] font-bold">
                    {completed ? <Check className="h-3 w-3" /> : s.id}
                  </span>
                  <span className="truncate">{s.short}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Contingut principal + Resum persistent */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        <div className="space-y-4 lg:col-span-8">
          {step === 1 && (
            <StepIdentity
              state={state}
              config={config}
              isGm={canManage}
              members={members}
              onChange={updateWizardState}
            />
          )}
          {step === 2 && (
            <StepAbilities
              state={state}
              config={config}
              isGm={canManage}
              onChange={updateWizardState}
            />
          )}
          {step === 3 && (
            <StepBackgroundProficiencies
              state={state}
              config={config}
              isGm={canManage}
              onChange={updateWizardState}
            />
          )}
          {step === 4 && (
            <StepClassFeatures
              state={state}
              config={config}
              isGm={canManage}
              onChange={updateWizardState}
            />
          )}
          {step === 5 && (
            <StepEquipment
              state={state}
              config={config}
              isGm={canManage}
              onChange={updateWizardState}
            />
          )}
          {step === 6 && (
            <StepReview
              state={state}
              config={config}
              isGm={canManage}
              onJumpToStep={setStep}
            />
          )}

          {/* Errors i avisos */}
          {stepErrors.length > 0 && (
            <div
              role="alert"
              className="rounded-[var(--rol-radius-md)] border border-[var(--rol-status-danger-border)] bg-[var(--rol-status-danger-bg)] p-3 text-xs text-[var(--rol-status-danger-ink)] space-y-1"
            >
              {stepErrors.map((err) => (
                <p key={err} className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>{err}</span>
                </p>
              ))}
            </div>
          )}

          {currentCheck.warnings.length > 0 && step < 6 && (
            <div className="rounded-[var(--rol-radius-md)] border border-[var(--rol-status-warning-border)] bg-[var(--rol-status-warning-bg)]/55 p-3 text-xs text-[var(--rol-status-warning-ink)] space-y-1">
              {currentCheck.warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </div>
          )}

          {submitError && (
            <div
              role="alert"
              className="rounded-[var(--rol-radius-md)] border border-[var(--rol-status-danger-border)] bg-[var(--rol-status-danger-bg)] p-3 text-sm text-[var(--rol-status-danger-ink)]"
            >
              {submitError}
            </div>
          )}

          {/* Navegació enrere / endavant / crear */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <Button variant="secondary" disabled={step === 1 || submitting} onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
              Pas anterior
            </Button>

            {step < 6 ? (
              <Button onClick={handleNext}>
                Següent pas
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button disabled={submitting || playerAtLimit} onClick={handleCreate}>
                <Sparkles className="h-4 w-4" />
                {submitting ? 'Creant personatge…' : 'Crear personatge i obrir fitxa'}
              </Button>
            )}
          </div>
        </div>

        {/* Resum persistent en construcció */}
        <aside className="lg:col-span-4 space-y-4">
          <Card title="Resum en construcció" subtitle={campaign.systemName}>
            <div className="space-y-3 text-xs">
              <div>
                <p className="font-semibold text-base text-[var(--rol-ink-primary)]">
                  {state.name.trim() || 'Sense nom encara'}
                </p>
                <p className="text-[var(--rol-ink-secondary)]">
                  {formatRaceSummary(previewSheet)} · {formatClassesSummary(previewSheet, previewComputed)}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rol-stat-plaque p-2">
                  <span className="block text-[10px] text-[var(--rol-ink-muted)]">PV</span>
                  <span className="font-mono font-bold">{previewSheet.hitPoints.max ?? '—'}</span>
                </div>
                <div className="rol-stat-plaque p-2">
                  <span className="block text-[10px] text-[var(--rol-ink-muted)]">CA</span>
                  <span className="font-mono font-bold">
                    {previewComputed.combat.armorClass.value}
                  </span>
                </div>
                <div className="rol-stat-plaque p-2">
                  <span className="block text-[10px] text-[var(--rol-ink-muted)]">Comp.</span>
                  <span className="font-mono font-bold">
                    {formatSigned(previewComputed.proficiencyBonus)}
                  </span>
                </div>
              </div>

              {config.restrictions && (
                <div className="rounded border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/50 p-2.5 text-[11px] text-[var(--rol-ink-secondary)]">
                  <strong>Notes del GM:</strong> {config.restrictions}
                </div>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
