'use client';

import { useState } from 'react';
import {
  Check,
  Dices,
  Footprints,
  Heart,
  Pencil,
  Settings2,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Swords,
  X,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { canEditSheetField, type SheetAccessContext } from './sheet-permissions';
import {
  formatClassesSummary,
  formatRaceSummary,
  formatSigned,
  formatSpeedSummary,
  type CharacterCampaignContext,
  type CharacterSheetRecord,
} from './types';

interface CharacterHeaderProps {
  character: CharacterSheetRecord;
  campaign: CharacterCampaignContext;
  access: SheetAccessContext;
  draftName: string;
  onChangeName: (nextName: string) => void;
  onOpenGmManage?: () => void;
  onOpenIdentityConfig?: () => void;
}

export function CharacterHeader({
  character,
  campaign,
  access,
  draftName,
  onChangeName,
  onOpenGmManage,
  onOpenIdentityConfig,
}: CharacterHeaderProps) {
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(draftName);

  const canEditName = canEditSheetField('name', access);
  const { sheetData, computed } = character;

  const playerLabel =
    sheetData.generalInfo.playerName?.trim() ||
    character.ownerDisplayName ||
    'Personatge del GM';
  const raceSummary = formatRaceSummary(sheetData);
  const classesSummary = formatClassesSummary(sheetData, computed);
  const speedSummary = formatSpeedSummary(sheetData.speed);

  const currentHp = sheetData.hitPoints.current;
  const maxHp = sheetData.hitPoints.max;
  const tempHp = sheetData.hitPoints.temporary ?? 0;
  const hpDisplay =
    currentHp !== null || maxHp !== null
      ? `${currentHp ?? '—'} / ${maxHp ?? '—'}`
      : '—';

  function startNameEdit() {
    setTempName(draftName);
    setEditingName(true);
  }

  function confirmNameEdit() {
    const cleaned = tempName.trim();
    if (cleaned.length > 0) {
      onChangeName(cleaned);
    }
    setEditingName(false);
  }

  function cancelNameEdit() {
    setTempName(draftName);
    setEditingName(false);
  }

  return (
    <section
      aria-label="Resum del personatge"
      className="rol-sheet-banner p-4 sm:p-5 space-y-4"
    >
      {/* Fila superior: Identitat + Nivell + Accés */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--rol-accent-primary)]">
              {campaign.systemName} · {campaign.name}
            </span>
            {campaign.canManage ? (
              <Badge tone="gold">Director de Joc</Badge>
            ) : character.canEdit ? (
              <Badge tone="success">La teva fitxa</Badge>
            ) : (
              <Badge tone="neutral">Només lectura</Badge>
            )}
            {campaign.virtualDiceEnabled && (
              <Badge tone="neutral">
                <Dices className="h-3 w-3" />
                Dau virtual actiu (3C.4)
              </Badge>
            )}
          </div>

          {editingName && canEditName ? (
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="header-character-name" className="sr-only">
                Nom del personatge
              </label>
              <input
                id="header-character-name"
                type="text"
                maxLength={100}
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    confirmNameEdit();
                  } else if (e.key === 'Escape') {
                    cancelNameEdit();
                  }
                }}
                className="rol-heading-flourish min-w-[200px] flex-1 max-w-md rounded-[var(--rol-radius-md)] border border-[var(--rol-accent-gold)] bg-[var(--rol-bg-surface)] px-3 py-1 text-xl font-bold text-[var(--rol-ink-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--rol-accent-gold-soft)]"
              />
              <Button size="sm" onClick={confirmNameEdit} aria-label="Aplicar nom">
                <Check className="h-3.5 w-3.5" />
                Aplicar
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelNameEdit} aria-label="Cancel·lar">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="rol-heading-flourish truncate text-2xl font-bold text-[var(--rol-ink-primary)] sm:text-3xl">
                {draftName}
              </h1>
              {canEditName && (
                <button
                  type="button"
                  onClick={startNameEdit}
                  aria-label="Editar el nom del personatge"
                  title="Editar el nom del personatge"
                  className="rounded-[var(--rol-radius-sm)] p-1 text-[var(--rol-ink-muted)] hover:bg-[var(--rol-bg-surface)] hover:text-[var(--rol-accent-primary)] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rol-accent-gold)]"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {/* Metadades d'identitat */}
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
            <div className="flex items-baseline gap-1.5 border-b border-[var(--rol-border-subtle)]/80 pb-1">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
                Jugador:
              </dt>
              <dd className="truncate font-medium text-[var(--rol-ink-primary)]">
                {playerLabel}
              </dd>
            </div>
            <div className="flex items-baseline gap-1.5 border-b border-[var(--rol-border-subtle)]/80 pb-1">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
                Raça:
              </dt>
              <dd className="truncate font-medium text-[var(--rol-ink-primary)]">
                {raceSummary}
              </dd>
            </div>
            <div className="flex items-baseline gap-1.5 border-b border-[var(--rol-border-subtle)]/80 pb-1">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
                Classe:
              </dt>
              <dd className="truncate font-medium text-[var(--rol-ink-primary)]">
                {classesSummary}
              </dd>
            </div>
          </dl>
        </div>

        {/* Bloque de Nivell total i acció GM */}
        <div className="flex shrink-0 items-center justify-between gap-3 lg:flex-col lg:items-end">
          <div className="flex items-center gap-3 rounded-[var(--rol-radius-md)] border border-[var(--rol-accent-gold)] bg-[var(--rol-accent-primary)] px-3.5 py-2 text-[var(--rol-accent-primary-ink)] shadow-sm">
            <span className="rol-heading-flourish text-2xl font-bold leading-none text-[var(--rol-accent-gold-soft)]">
              {computed.totalLevel}
            </span>
            <div className="leading-tight">
              <span className="block text-[10px] uppercase tracking-wider opacity-85">
                Nivell
              </span>
              <span className="block text-xs font-semibold">Total</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {access.canEdit && onOpenIdentityConfig && (
              <Button size="sm" variant="secondary" onClick={onOpenIdentityConfig}>
                <Settings2 className="h-3.5 w-3.5" />
                Identitat i classes
              </Button>
            )}
            {campaign.canManage && onOpenGmManage && (
              <Button size="sm" variant="secondary" onClick={onOpenGmManage}>
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Gestió GM
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Barra d'indicadors vitals persistents (estrictament des de `computed` + `sheetData`) */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        <div className="rol-stat-plaque col-span-2 px-3 py-2 sm:col-span-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
            <Heart className="h-3.5 w-3.5 text-[var(--rol-accent-primary)]" />
            <span>Punts de cop</span>
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="rol-heading-flourish text-lg font-bold text-[var(--rol-ink-primary)]">
              {hpDisplay}
            </span>
            {tempHp > 0 && (
              <span className="text-xs font-semibold text-[var(--rol-status-success-ink)]">
                +{tempHp} temp
              </span>
            )}
          </div>
        </div>

        <div className="rol-stat-plaque px-3 py-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
            <Shield className="h-3.5 w-3.5 text-[var(--rol-accent-gold)]" />
            <span>CA</span>
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="rol-heading-flourish text-lg font-bold text-[var(--rol-ink-primary)]">
              {computed.combat.armorClass.value}
            </span>
            {computed.combat.armorClass.isOverridden && (
              <span className="text-[10px] font-medium text-[var(--rol-status-warning-ink)]">
                GM
              </span>
            )}
          </div>
        </div>

        <div className="rol-stat-plaque px-3 py-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
            <Zap className="h-3.5 w-3.5 text-[var(--rol-accent-gold)]" />
            <span>Iniciativa</span>
          </div>
          <p className="rol-heading-flourish mt-0.5 text-lg font-bold text-[var(--rol-ink-primary)]">
            {formatSigned(computed.combat.initiative)}
          </p>
        </div>

        <div className="rol-stat-plaque px-3 py-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
            <Footprints className="h-3.5 w-3.5 text-[var(--rol-ink-secondary)]" />
            <span>Velocitat</span>
          </div>
          <p className="rol-heading-flourish mt-0.5 truncate text-base font-bold text-[var(--rol-ink-primary)] sm:text-lg">
            {speedSummary}
          </p>
        </div>

        <div className="rol-stat-plaque px-3 py-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
            {computed.spellcasting ? (
              <Sparkles className="h-3.5 w-3.5 text-[var(--rol-accent-primary)]" />
            ) : (
              <Swords className="h-3.5 w-3.5 text-[var(--rol-accent-primary)]" />
            )}
            <span>Competència</span>
          </div>
          <p className="rol-heading-flourish mt-0.5 text-lg font-bold text-[var(--rol-ink-primary)]">
            {formatSigned(computed.proficiencyBonus)}
          </p>
        </div>
      </div>
    </section>
  );
}
