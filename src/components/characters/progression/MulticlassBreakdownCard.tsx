'use client';

import { CheckCircle2, Compass, ShieldAlert } from 'lucide-react';
import {
  formatMulticlassRequirementCa,
  getClassEntry,
  validateMulticlassPrerequisites,
  type ProgressionMilestoneCategory,
} from '@/domain/systems/dnd5e-2014';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { CharacterSheetRecord } from '../types';

interface MulticlassBreakdownCardProps {
  character: CharacterSheetRecord;
}

const MILESTONE_LABELS: Record<ProgressionMilestoneCategory, string> = {
  proficiency_bonus: 'Competència',
  subclass: 'Subclasse',
  asi: 'ASI / Dot',
  spell_circle: 'Cercle màgic',
  class_feature: 'Tret de classe',
};

export function MulticlassBreakdownCard({ character }: MulticlassBreakdownCardProps) {
  const { sheetData, computed } = character;
  const prog = computed.progression;
  const mcValidation = validateMulticlassPrerequisites(
    sheetData.raceAndClass.classes,
    sheetData.abilities
  );
  const isMulticlass = sheetData.raceAndClass.classes.length >= 2;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Desglossament per classe i multiclasse */}
      <Card
        title="Classes, subclasses i multiclasse"
        subtitle="Desglossament oficial per classe amb daus de cop, ASI i beneficis desbloquejats."
        actions={
          isMulticlass ? (
            <Badge tone={mcValidation.eligible ? 'success' : 'warning'}>
              {mcValidation.eligible ? 'Multiclasse oficial vàlida' : 'Multiclasse amb excepció GM'}
            </Badge>
          ) : (
            <Badge tone="neutral">Classe única</Badge>
          )
        }
      >
        <div className="space-y-3">
          {prog.classProgressions.length === 0 ? (
            <p className="text-sm text-[var(--rol-ink-muted)]">
              Encara no hi ha cap classe assignada a aquest personatge.
            </p>
          ) : (
            prog.classProgressions.map((cls) => {
              const classMeta = getClassEntry(cls.classId);
              const unlockedFeatures =
                classMeta?.keyFeatureMilestones.filter((m) => m.level <= cls.level) ?? [];

              return (
                <div
                  key={`${cls.classId}-${cls.level}`}
                  className="rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/35 p-3.5 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-[var(--rol-ink-primary)]">
                        {cls.classLabelCa}{' '}
                        <span className="font-mono text-sm text-[var(--rol-accent-primary)]">
                          Nivell {cls.level}
                        </span>
                      </h4>
                      <p className="text-xs text-[var(--rol-ink-muted)]">
                        {cls.subclassLabelCa
                          ? `Subclasse: ${cls.subclassLabelCa}`
                          : cls.subclassUnlocked
                            ? 'Subclasse pendent de selecció'
                            : `Subclasse es desbloqueja al nivell ${cls.subclassLevel ?? 3}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {cls.hitDie && (
                        <Badge tone="gold">
                          d{cls.hitDie} (+{cls.averageHpPerLevel} mitj.)
                        </Badge>
                      )}
                      {cls.classId !== 'custom' && (
                        <Badge tone="neutral">
                          Req. multiclasse: {formatMulticlassRequirementCa(cls.classId)}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--rol-ink-secondary)]">
                    <span>
                      <strong>ASI desbloquejades:</strong>{' '}
                      {cls.unlockedAsiLevels.length > 0
                        ? `Niv. ${cls.unlockedAsiLevels.join(', ')}`
                        : 'Cap encara'}
                    </span>
                    {cls.nextAsiLevel && (
                      <span className="text-[var(--rol-ink-muted)]">
                        (Pròxima ASI al niv. {cls.nextAsiLevel})
                      </span>
                    )}
                  </div>

                  {unlockedFeatures.length > 0 && (
                    <div className="border-t border-[var(--rol-border-subtle)] pt-2 space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
                        Beneficis oficials desbloquejats
                      </p>
                      <ul className="space-y-1 text-xs">
                        {unlockedFeatures.map((feat) => (
                          <li key={`${cls.classId}-${feat.level}`} className="flex items-start gap-1.5">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--rol-status-success-ink)]" />
                            <span>
                              <strong>Niv. {feat.level} · {feat.titleCa}:</strong>{' '}
                              <span className="text-[var(--rol-ink-secondary)]">{feat.descriptionCa}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {isMulticlass && !mcValidation.eligible && (
            <div className="flex items-start gap-2 rounded-[var(--rol-radius-md)] border border-[var(--rol-status-warning-border)] bg-[var(--rol-status-warning-bg)] px-3 py-2 text-xs text-[var(--rol-status-warning-ink)]">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-0.5">
                <p className="font-semibold">Requisits PHB de multiclasse no assolits:</p>
                {mcValidation.unmetRequirements.map((msg) => (
                  <p key={msg}>{msg}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Fites properes */}
      <Card
        title="Fites properes d’evolució"
        subtitle="Pròxims desbloquejos oficials calculats pel motor fins al nivell 20."
        actions={
          <Badge tone="gold">
            <Compass className="h-3 w-3" />
            {prog.upcomingMilestones.length} fites
          </Badge>
        }
      >
        {prog.isMaxLevel ? (
          <p className="text-sm text-[var(--rol-ink-muted)]">
            {prog.maxLevelMessageCa}
          </p>
        ) : prog.upcomingMilestones.length === 0 ? (
          <p className="text-sm text-[var(--rol-ink-muted)]">
            No hi ha fites pendents registrades per a la configuració actual.
          </p>
        ) : (
          <ul className="max-h-96 space-y-2 overflow-y-auto pr-1 text-xs">
            {prog.upcomingMilestones.slice(0, 12).map((m, idx) => (
              <li
                key={`${m.category}-${m.classId ?? 'char'}-${m.targetTotalLevel}-${idx}`}
                className="rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/30 px-3 py-2 space-y-1"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--rol-ink-primary)]">{m.titleCa}</span>
                  <div className="flex items-center gap-1.5">
                    <Badge tone="neutral">{MILESTONE_LABELS[m.category]}</Badge>
                    <Badge tone={m.levelsRemaining === 1 ? 'success' : 'gold'}>
                      +{m.levelsRemaining} {m.levelsRemaining === 1 ? 'nivell' : 'nivells'}
                    </Badge>
                  </div>
                </div>
                <p className="text-[var(--rol-ink-secondary)]">{m.descriptionCa}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
