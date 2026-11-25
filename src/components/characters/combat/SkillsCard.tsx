'use client';

import { Award, CheckCircle2, Circle, CircleDot, Eye } from 'lucide-react';
import {
  ABILITY_SHORT_CA,
  DND5E_SKILLS,
  type ComputedDnd5e2014Snapshot,
  type ComputedSkill,
  type RollMode,
  type SkillId,
  type SkillProficiencyLevel,
} from '@/domain/systems/dnd5e-2014';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { RollModeToggle } from '../RollModeToggle';
import { canEditSheetField, type SheetAccessContext } from '../sheet-permissions';
import { formatSigned } from '../types';

interface SkillsCardProps {
  computedSkills: ComputedSkill[];
  passives: ComputedDnd5e2014Snapshot['passives'];
  draftProficient: SkillId[];
  draftExpertise: SkillId[];
  draftHalfProficient: boolean;
  draftRollModes: Partial<Record<SkillId, RollMode>>;
  draftOverrides: Partial<Record<SkillId, number>>;
  access: SheetAccessContext;
  onSetProficiencyLevel: (skillId: SkillId, level: 'none' | 'proficient' | 'expertise') => void;
  onToggleHalfProficient: (next: boolean) => void;
  onChangeRollMode: (skillId: SkillId, mode: RollMode) => void;
  onChangeOverride: (skillId: SkillId, value: number | null) => void;
}

const PROF_BADGE: Record<
  SkillProficiencyLevel,
  { label: string; short: string; rowClass: string }
> = {
  expertise: {
    label: 'Expertesa (×2)',
    short: 'Exp',
    rowClass: 'bg-[var(--rol-accent-gold-soft)]/25',
  },
  proficient: {
    label: 'Competent',
    short: 'Comp',
    rowClass: 'bg-[var(--rol-status-success-bg)]/35',
  },
  half: {
    label: '½ Competència',
    short: '½',
    rowClass: 'bg-[var(--rol-status-warning-bg)]/25',
  },
  none: {
    label: 'Sense competència',
    short: 'No',
    rowClass: '',
  },
};

export function SkillsCard({
  computedSkills,
  passives,
  draftProficient,
  draftExpertise,
  draftHalfProficient,
  draftRollModes,
  draftOverrides,
  access,
  onSetProficiencyLevel,
  onToggleHalfProficient,
  onChangeRollMode,
  onChangeOverride,
}: SkillsCardProps) {
  const computedById = new Map(computedSkills.map((sk) => [sk.id, sk]));
  const canEditProf = canEditSheetField('skills.proficient', access);
  const canEditExp = canEditSheetField('skills.expertise', access);
  const canEditHalf = canEditSheetField('skills.halfProficient', access);
  const canEditRollMode = canEditSheetField('skills.rollModes', access);
  const canEditOverride = canEditSheetField('skills.overrides', access);

  function getDraftProficiencyLevel(skillId: SkillId): SkillProficiencyLevel {
    if (draftExpertise.includes(skillId)) return 'expertise';
    if (draftProficient.includes(skillId)) return 'proficient';
    if (draftHalfProficient) return 'half';
    return 'none';
  }

  function cycleProficiency(skillId: SkillId) {
    const current = getDraftProficiencyLevel(skillId);
    if (current === 'none' || current === 'half') {
      if (canEditProf) onSetProficiencyLevel(skillId, 'proficient');
      return;
    }
    if (current === 'proficient') {
      if (canEditExp) {
        onSetProficiencyLevel(skillId, 'expertise');
      } else if (canEditProf) {
        onSetProficiencyLevel(skillId, 'none');
      }
      return;
    }
    if (canEditProf || canEditExp) {
      onSetProficiencyLevel(skillId, 'none');
    }
  }

  return (
    <Card
      title="Habilitats (18 oficials)"
      subtitle="Competència, expertesa i modes d’avantatge/desavantatge segons catàleg D&D 5e."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="gold">
            <Award className="h-3 w-3" />
            Expertesa
          </Badge>
          <Badge tone="success">
            <CheckCircle2 className="h-3 w-3" />
            Competent
          </Badge>
        </div>
      }
    >
      {/* Percepcions / Sentits passius */}
      <div className="mb-3 grid grid-cols-3 gap-2 rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/55 p-2.5 text-center text-xs">
        <div>
          <span className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
            <Eye className="h-3 w-3" />
            Percepció passiva
          </span>
          <span className="rol-heading-flourish text-base font-bold text-[var(--rol-ink-primary)]">
            {passives.perception}
          </span>
        </div>
        <div>
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
            Investigació passiva
          </span>
          <span className="rol-heading-flourish text-base font-bold text-[var(--rol-ink-primary)]">
            {passives.investigation}
          </span>
        </div>
        <div>
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
            Perspicàcia passiva
          </span>
          <span className="rol-heading-flourish text-base font-bold text-[var(--rol-ink-primary)]">
            {passives.insight}
          </span>
        </div>
      </div>

      {canEditHalf && (
        <label className="mb-3 inline-flex items-center gap-2 rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/40 px-2.5 py-1.5 text-xs text-[var(--rol-ink-primary)] cursor-pointer">
          <input
            type="checkbox"
            checked={draftHalfProficient}
            onChange={(e) => onToggleHalfProficient(e.target.checked)}
          />
          <span>Aplicar ½ competència general (Polivalent / Jack of All Trades)</span>
        </label>
      )}

      {/* Llista completa de les 18 habilitats des de DND5E_SKILLS */}
      <ul className="divide-y divide-[var(--rol-border-subtle)]/70">
        {DND5E_SKILLS.map((entry) => {
          const computedSkill = computedById.get(entry.id);
          const total = computedSkill?.total ?? 0;
          const level = getDraftProficiencyLevel(entry.id);
          const rollModeDraft = draftRollModes[entry.id] ?? computedSkill?.rollMode ?? 'normal';
          const overrideDraft = draftOverrides[entry.id];
          const meta = PROF_BADGE[level];
          const canCycle = canEditProf || canEditExp;

          return (
            <li
              key={entry.id}
              className={`flex flex-wrap items-center justify-between gap-2 rounded px-1.5 py-2 ${meta.rowClass}`}
            >
              <div className="flex min-w-0 items-center gap-2">
                {canCycle ? (
                  <button
                    type="button"
                    onClick={() => cycleProficiency(entry.id)}
                    title={`${entry.labelCa}: ${meta.label} (prem per canviar)`}
                    aria-label={`${entry.labelCa}: ${meta.label}. Canviar nivell de competència`}
                    className="rounded-full p-0.5 hover:bg-[var(--rol-bg-surface)] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rol-accent-gold)]"
                  >
                    {level === 'expertise' ? (
                      <Award className="h-4 w-4 text-[var(--rol-accent-gold)]" />
                    ) : level === 'proficient' ? (
                      <CheckCircle2 className="h-4 w-4 text-[var(--rol-status-success-ink)]" />
                    ) : level === 'half' ? (
                      <CircleDot className="h-4 w-4 text-[var(--rol-status-warning-ink)]" />
                    ) : (
                      <Circle className="h-4 w-4 text-[var(--rol-ink-muted)]" />
                    )}
                  </button>
                ) : (
                  <span
                    aria-label={`${entry.labelCa}: ${meta.label}`}
                    title={meta.label}
                    className="p-0.5"
                  >
                    {level === 'expertise' ? (
                      <Award className="h-4 w-4 text-[var(--rol-accent-gold)]" />
                    ) : level === 'proficient' ? (
                      <CheckCircle2 className="h-4 w-4 text-[var(--rol-status-success-ink)]" />
                    ) : level === 'half' ? (
                      <CircleDot className="h-4 w-4 text-[var(--rol-status-warning-ink)]" />
                    ) : (
                      <Circle className="h-4 w-4 text-[var(--rol-ink-muted)]" />
                    )}
                  </span>
                )}

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`text-sm ${
                        level === 'expertise' || level === 'proficient'
                          ? 'font-semibold text-[var(--rol-ink-primary)]'
                          : 'text-[var(--rol-ink-secondary)]'
                      }`}
                    >
                      {entry.labelCa}
                    </span>
                    <span className="font-mono text-[11px] uppercase text-[var(--rol-ink-muted)]">
                      ({ABILITY_SHORT_CA[entry.ability]})
                    </span>
                    {level === 'expertise' && (
                      <Badge tone="gold" className="px-1.5 py-0 text-[10px]">
                        Expertesa
                      </Badge>
                    )}
                    {level === 'proficient' && (
                      <Badge tone="success" className="px-1.5 py-0 text-[10px]">
                        Competent
                      </Badge>
                    )}
                    {level === 'half' && (
                      <Badge tone="warning" className="px-1.5 py-0 text-[10px]">
                        ½ Comp
                      </Badge>
                    )}
                    {computedSkill?.override !== null && computedSkill?.override !== undefined && (
                      <Badge tone="warning" className="px-1.5 py-0 text-[10px]">
                        Override GM
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canEditOverride && (
                  <input
                    type="number"
                    min={-20}
                    max={40}
                    step={1}
                    placeholder="Auto"
                    aria-label={`Override GM habilitat ${entry.labelCa}`}
                    value={overrideDraft ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      if (!raw) {
                        onChangeOverride(entry.id, null);
                      } else {
                        const num = Math.trunc(Number(raw));
                        if (Number.isFinite(num)) {
                          onChangeOverride(entry.id, Math.min(40, Math.max(-20, num)));
                        }
                      }
                    }}
                    className="w-14 rounded-[var(--rol-radius-sm)] border border-[var(--rol-status-warning-border)] bg-[var(--rol-status-warning-bg)]/40 px-1.5 py-0.5 text-center font-mono text-xs text-[var(--rol-ink-primary)]"
                  />
                )}

                <span
                  className="min-w-[2.5rem] rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] px-2 py-0.5 text-center font-mono text-sm font-bold text-[var(--rol-ink-primary)]"
                  aria-label={`Modificador ${entry.labelCa}: ${formatSigned(total)}`}
                >
                  {formatSigned(total)}
                </span>

                <RollModeToggle
                  value={rollModeDraft}
                  disabled={!canEditRollMode}
                  label={entry.labelCa}
                  onChange={(next) => onChangeRollMode(entry.id, next)}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
