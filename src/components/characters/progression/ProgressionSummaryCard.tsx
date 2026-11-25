'use client';

import { useState } from 'react';
import { ArrowUpCircle, Award, Lock, Sparkles, TrendingUp } from 'lucide-react';
import { XP_THRESHOLDS_2014 } from '@/domain/systems/dnd5e-2014';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { InputField } from '@/components/ui/Field';
import { canEditSheetField, type SheetAccessContext } from '../sheet-permissions';
import { formatSigned, type CharacterSheetDraft, type CharacterSheetRecord } from '../types';

interface ProgressionSummaryCardProps {
  character: CharacterSheetRecord;
  draft: CharacterSheetDraft;
  access: SheetAccessContext;
  hasUnsavedChanges: boolean;
  onUpdateDraft: (updater: (prev: CharacterSheetDraft) => CharacterSheetDraft) => void;
  onOpenLevelUp: () => void;
}

export function ProgressionSummaryCard({
  character,
  draft,
  access,
  hasUnsavedChanges,
  onUpdateDraft,
  onOpenLevelUp,
}: ProgressionSummaryCardProps) {
  const prog = character.computed.progression;
  const canEditXp = canEditSheetField('progression.experiencePoints', access);
  const canEditInspiration = canEditSheetField('progression.inspiration', access);
  const canLevelUpPermission =
    canEditSheetField('raceAndClass.classes', access) &&
    canEditSheetField('progression.totalLevel', access);

  const [xpToAdd, setXpToAdd] = useState('');

  // Progress bar uses draft XP with server XP_THRESHOLDS_2014 bounds without duplicating XP math
  const draftXp = Math.max(0, Math.floor(draft.progression.experiencePoints ?? 0));
  const minXp = prog.currentLevelMinXp ?? XP_THRESHOLDS_2014[prog.totalLevel - 1] ?? 0;
  const nextXp = prog.nextLevelXp;
  const remainingXp = nextXp !== null ? Math.max(0, nextXp - draftXp) : null;
  const livePercent =
    !prog.isMaxLevel && nextXp !== null && nextXp > minXp
      ? Math.min(100, Math.max(0, Math.round(((draftXp - minXp) / (nextXp - minXp)) * 100)))
      : 100;
  const readyToLevelUp = !prog.isMaxLevel && nextXp !== null && draftXp >= nextXp;

  function handleAddXp() {
    if (!canEditXp) return;
    const delta = Math.trunc(Number(xpToAdd));
    if (!Number.isFinite(delta) || delta === 0) return;
    const nextVal = Math.max(0, Math.min(10000000, draftXp + delta));
    onUpdateDraft((prev) => ({
      ...prev,
      progression: { ...prev.progression, experiencePoints: nextVal },
    }));
    setXpToAdd('');
  }

  return (
    <Card
      title="Nivell, experiència i inspiració"
      subtitle="Seguiment oficial de nivell (1–20), punts d’experiència i progrés cap al nivell següent."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {readyToLevelUp && <Badge tone="success">PE suficients per pujar de nivell!</Badge>}
          {canLevelUpPermission && !prog.isMaxLevel && (
            <Button
              type="button"
              size="sm"
              disabled={hasUnsavedChanges}
              onClick={onOpenLevelUp}
            >
              <ArrowUpCircle className="h-3.5 w-3.5" />
              Pujar de nivell (+1)
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Plaques principals */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rol-stat-plaque px-3.5 py-2.5">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
              Nivell total
            </span>
            <p className="rol-heading-flourish mt-0.5 text-2xl font-bold text-[var(--rol-ink-primary)]">
              {prog.totalLevel}{' '}
              <span className="text-xs font-normal text-[var(--rol-ink-muted)]">/ 20</span>
            </p>
          </div>

          <div className="rol-stat-plaque px-3.5 py-2.5">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
              Bonif. competència
            </span>
            <p className="rol-heading-flourish mt-0.5 text-2xl font-bold text-[var(--rol-accent-primary)]">
              {formatSigned(character.computed.proficiencyBonus)}
            </p>
          </div>

          <div className="rol-stat-plaque px-3.5 py-2.5">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
              Experiència actual
            </span>
            <p className="rol-heading-flourish mt-0.5 text-xl font-bold text-[var(--rol-ink-primary)]">
              {draftXp.toLocaleString('ca-ES')} <span className="text-xs font-normal">PE</span>
            </p>
          </div>

          <div className="rol-stat-plaque px-3.5 py-2.5 flex flex-col justify-between">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
              Inspiració heroica
            </span>
            <button
              type="button"
              disabled={!canEditInspiration}
              onClick={() =>
                onUpdateDraft((prev) => ({
                  ...prev,
                  progression: { ...prev.progression, inspiration: !prev.progression.inspiration },
                }))
              }
              className={`mt-1 inline-flex items-center justify-center gap-1.5 rounded-[var(--rol-radius-sm)] border px-2.5 py-1 text-xs font-semibold transition-colors ${
                draft.progression.inspiration
                  ? 'border-[var(--rol-accent-gold)] bg-[var(--rol-accent-primary)] text-[var(--rol-accent-primary-ink)]'
                  : 'border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] text-[var(--rol-ink-secondary)]'
              } ${canEditInspiration ? 'cursor-pointer' : 'opacity-65 cursor-not-allowed'}`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {draft.progression.inspiration ? 'Activa' : 'Inactiva'}
            </button>
          </div>
        </div>

        {/* Barra de progrés XP */}
        <div className="rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/40 p-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--rol-ink-primary)]">
              <TrendingUp className="h-3.5 w-3.5 text-[var(--rol-accent-gold)]" />
              {prog.isMaxLevel
                ? prog.maxLevelMessageCa
                : `Progrés cap al nivell ${prog.nextLevel} (${nextXp?.toLocaleString('ca-ES')} PE)`}
            </span>
            <span className="font-mono font-semibold text-[var(--rol-ink-secondary)]">
              {prog.isMaxLevel
                ? '100% (Màxim)'
                : `${livePercent}% · Falten ${remainingXp?.toLocaleString('ca-ES') ?? 0} PE`}
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={livePercent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-3 w-full overflow-hidden rounded-full border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)]"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--rol-accent-primary)] to-[var(--rol-accent-gold)] transition-all duration-300"
              style={{ width: `${livePercent}%` }}
            />
          </div>

          {!prog.isMaxLevel && (
            <div className="flex justify-between text-[11px] font-mono text-[var(--rol-ink-muted)]">
              <span>Nivell {prog.totalLevel}: {minXp.toLocaleString('ca-ES')} PE</span>
              <span>Nivell {prog.nextLevel}: {nextXp?.toLocaleString('ca-ES')} PE</span>
            </div>
          )}
        </div>

        {/* Edició de PE i avisos d'autoritat */}
        <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
          <div className="space-y-1">
            <InputField
              label="Total de punts d’experiència (PE)"
              htmlFor="prog-total-xp"
              type="number"
              min={0}
              max={10000000}
              disabled={!canEditXp}
              value={draftXp}
              onChange={(e) => {
                const next = Math.max(0, Math.min(10000000, Math.trunc(Number(e.target.value) || 0)));
                onUpdateDraft((prev) => ({
                  ...prev,
                  progression: { ...prev.progression, experiencePoints: next },
                }));
              }}
            />
          </div>

          {canEditXp ? (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <InputField
                  label="Sumar / restar PE"
                  htmlFor="prog-delta-xp"
                  type="number"
                  value={xpToAdd}
                  onChange={(e) => setXpToAdd(e.target.value)}
                  placeholder="Ex. 350"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!xpToAdd.trim()}
                onClick={handleAddXp}
              >
                <Award className="h-3.5 w-3.5" />
                Aplicar PE
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/50 px-3 py-2 text-xs text-[var(--rol-ink-muted)]">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span>Els punts d’experiència estan controlats pel Director de Joc.</span>
            </div>
          )}
        </div>

        {hasUnsavedChanges && canLevelUpPermission && !prog.isMaxLevel && (
          <p className="rounded-[var(--rol-radius-sm)] border border-[var(--rol-status-warning-border)] bg-[var(--rol-status-warning-bg)] px-3 py-2 text-xs text-[var(--rol-status-warning-ink)]">
            Tens canvis sense desar a la fitxa. Desa o descarta els canvis pendents abans d’obrir l’assistent de pujada de nivell.
          </p>
        )}

        {!canLevelUpPermission && !prog.isMaxLevel && (
          <div className="flex items-center gap-2 rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/50 px-3 py-2 text-xs text-[var(--rol-ink-muted)]">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            <span>
              La pujada de nivell i modificació de classes requereix autorització del Director de Joc. Pots consultar l’evolució i les fites a sota.
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
