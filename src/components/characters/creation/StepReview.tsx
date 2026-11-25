'use client';

import { AlertTriangle, CheckCircle2, Pencil } from 'lucide-react';
import {
  ABILITY_KEYS,
  DND5E_SKILLS,
  validateCharacterAgainstCampaignConfig,
} from '@/domain/systems/dnd5e-2014';
import type { CampaignCreationConfig } from '@/domain/campaigns/creation-config';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatClassesSummary, formatRaceSummary, formatSigned, formatSpeedSummary } from '../types';
import {
  buildPreviewFromWizard,
  type CharacterWizardState,
  type WizardStepId,
} from './wizard-state';

interface StepReviewProps {
  state: CharacterWizardState;
  config: CampaignCreationConfig;
  isGm: boolean;
  onJumpToStep: (step: WizardStepId) => void;
}

export function StepReview({
  state,
  config,
  isGm,
  onJumpToStep,
}: StepReviewProps) {
  const { sheet, computed } = buildPreviewFromWizard(state, config, isGm);
  const serverPreviewCheck = validateCharacterAgainstCampaignConfig(sheet, config, {
    isGm,
    isCreation: true,
  });

  const proficientSkillNames = sheet.skills.proficient.map(
    (sid) => DND5E_SKILLS.find((s) => s.id === sid)?.labelCa ?? sid
  );

  return (
    <Card
      title="Pas 6 · Revisió final abans de crear"
      subtitle="Comprova totes les dades calculades. Un cop creat, s’obrirà directament la fitxa universal completa."
    >
      <div className="space-y-4">
        {serverPreviewCheck.violations.length > 0 && (
          <div
            role="alert"
            className="rounded-[var(--rol-radius-md)] border border-[var(--rol-status-danger-border)] bg-[var(--rol-status-danger-bg)] p-3 text-xs text-[var(--rol-status-danger-ink)] space-y-1"
          >
            <p className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Restriccions de campanya pendents de corregir:
            </p>
            <ul className="list-disc pl-5">
              {serverPreviewCheck.violations.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          </div>
        )}

        {serverPreviewCheck.warnings.length > 0 && (
          <div className="rounded-[var(--rol-radius-md)] border border-[var(--rol-status-warning-border)] bg-[var(--rol-status-warning-bg)]/60 p-3 text-xs text-[var(--rol-status-warning-ink)] space-y-1">
            <p className="font-semibold">Avisos de configuració de campanya:</p>
            <ul className="list-disc pl-5">
              {serverPreviewCheck.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {serverPreviewCheck.valid && (
          <div className="flex items-center gap-2 rounded-[var(--rol-radius-md)] border border-[var(--rol-status-success-border)] bg-[var(--rol-status-success-bg)]/60 px-3 py-2 text-xs font-medium text-[var(--rol-status-success-ink)]">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Totes les comprovacions bàsiques de creació són correctes.</span>
          </div>
        )}

        {/* Valors derivats principals */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          <div className="rol-stat-plaque p-2.5 text-center">
            <span className="block text-[10px] uppercase text-[var(--rol-ink-muted)]">Nivell</span>
            <span className="rol-heading-flourish text-lg font-bold">{computed.totalLevel}</span>
          </div>
          <div className="rol-stat-plaque p-2.5 text-center">
            <span className="block text-[10px] uppercase text-[var(--rol-ink-muted)]">PV Màx</span>
            <span className="rol-heading-flourish text-lg font-bold text-[var(--rol-accent-primary)]">
              {sheet.hitPoints.max ?? '—'}
            </span>
          </div>
          <div className="rol-stat-plaque p-2.5 text-center">
            <span className="block text-[10px] uppercase text-[var(--rol-ink-muted)]">CA</span>
            <span className="rol-heading-flourish text-lg font-bold">
              {computed.combat.armorClass.value}
            </span>
          </div>
          <div className="rol-stat-plaque p-2.5 text-center">
            <span className="block text-[10px] uppercase text-[var(--rol-ink-muted)]">Iniciativa</span>
            <span className="rol-heading-flourish text-lg font-bold">
              {formatSigned(computed.combat.initiative)}
            </span>
          </div>
          <div className="rol-stat-plaque p-2.5 text-center">
            <span className="block text-[10px] uppercase text-[var(--rol-ink-muted)]">Competència</span>
            <span className="rol-heading-flourish text-lg font-bold">
              {formatSigned(computed.proficiencyBonus)}
            </span>
          </div>
        </div>

        {/* Blocs de resum amb accés directe */}
        <div className="grid gap-3 md:grid-cols-2 text-xs">
          <div className="rounded border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/30 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-[var(--rol-ink-primary)]">Identitat</span>
              <Button size="sm" variant="ghost" onClick={() => onJumpToStep(1)}>
                <Pencil className="h-3 w-3" />
                Editar
              </Button>
            </div>
            <p><strong>Nom:</strong> {sheet.generalInfo.name}</p>
            <p><strong>Raça:</strong> {formatRaceSummary(sheet)}</p>
            <p><strong>Classe:</strong> {formatClassesSummary(sheet, computed)}</p>
            <p><strong>Velocitat:</strong> {formatSpeedSummary(sheet.speed)}</p>
            {sheet.generalInfo.alignment && <p><strong>Alineament:</strong> {sheet.generalInfo.alignment}</p>}
          </div>

          <div className="rounded border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/30 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-[var(--rol-ink-primary)]">Característiques</span>
              <Button size="sm" variant="ghost" onClick={() => onJumpToStep(2)}>
                <Pencil className="h-3 w-3" />
                Editar
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {ABILITY_KEYS.map((k) => {
                const ab = computed.abilities[k];
                return (
                  <div key={k} className="rounded bg-[var(--rol-bg-surface)] px-2 py-1 text-center border border-[var(--rol-border-subtle)]">
                    <span className="block text-[10px] font-bold text-[var(--rol-ink-muted)]">
                      {ab.shortCa}
                    </span>
                    <span className="font-mono font-bold">
                      {ab.score ?? '—'} ({formatSigned(ab.modifier)})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/30 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-[var(--rol-ink-primary)]">Trasfons i competències</span>
              <Button size="sm" variant="ghost" onClick={() => onJumpToStep(3)}>
                <Pencil className="h-3 w-3" />
                Editar
              </Button>
            </div>
            <p><strong>Antecedent:</strong> {sheet.background.backgroundName || 'Sense antecedent'}</p>
            <p><strong>Habilitats:</strong> {proficientSkillNames.join(', ') || 'Cap'}</p>
            <p><strong>Idiomes:</strong> {sheet.proficiencies.languages.join(', ') || 'Comú'}</p>
          </div>

          <div className="rounded border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/30 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-[var(--rol-ink-primary)]">Equipament, atacs i màgia</span>
              <Button size="sm" variant="ghost" onClick={() => onJumpToStep(5)}>
                <Pencil className="h-3 w-3" />
                Editar
              </Button>
            </div>
            <p><strong>Armes / Objectes:</strong> {sheet.inventory.length} entrades ({sheet.currency.gp} PO)</p>
            <div className="flex flex-wrap gap-1">
              {computed.combat.attacks.map((a) => (
                <Badge key={a.id} tone="gold">
                  {a.name} ({a.attackBonusDisplay})
                </Badge>
              ))}
            </div>
            {computed.spellcasting && (
              <p>
                <strong>Màgia:</strong> CD {computed.spellcasting.saveDc ?? '—'}, Atac{' '}
                {formatSigned(computed.spellcasting.attackBonus)} ({sheet.spells.length} conjurs inicials)
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
