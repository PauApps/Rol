'use client';

import { useState } from 'react';
import { Lock, Plus, ShieldCheck, Swords, Trash2 } from 'lucide-react';
import {
  ABILITY_LABELS_CA,
  ABILITY_SHORT_CA,
  type AbilityKey,
  type AttackEntryKind,
  type ComputedAttack,
  type ComputedDnd5e2014Snapshot,
  type Dnd5e2014AttackEntry,
  type Dnd5e2014ClassEntry,
} from '@/domain/systems/dnd5e-2014';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { canEditSheetField, type SheetAccessContext } from '../sheet-permissions';

interface AttacksCardProps {
  computedAttacks: ComputedAttack[];
  spellcasting: ComputedDnd5e2014Snapshot['spellcasting'];
  classes: readonly Dnd5e2014ClassEntry[];
  savedAttacks: readonly Dnd5e2014AttackEntry[];
  draftAttacks: readonly Dnd5e2014AttackEntry[];
  access: SheetAccessContext;
  onChangeAttacks: (next: Dnd5e2014AttackEntry[]) => void;
}

const KIND_LABELS: Record<ComputedAttack['attackKind'], string> = {
  weapon: 'Arma equipada',
  weapon_override: 'Arma vinculada',
  unarmed: 'Desarmat',
  spell: 'Conjur',
  special: 'Especial',
  gm_custom: 'GM personalitzat',
};

const PROF_LABELS: Record<ComputedAttack['proficiencySource'], string> = {
  character_proficiencies: 'Competent',
  unarmed_official: 'Desarmat oficial',
  spellcasting_official: 'Màgia oficial',
  gm_exception: 'Excepció GM',
  none: 'Sense competència',
};

export function AttacksCard({
  computedAttacks,
  spellcasting,
  classes,
  savedAttacks,
  draftAttacks,
  access,
  onChangeAttacks,
}: AttacksCardProps) {
  const canEditAttacks = canEditSheetField('attacks', access);
  const canGmCustom = access.isGm || canEditSheetField('attacks.gmCustom', access);
  const canAbilityOverride = access.isGm || canEditSheetField('attacks.ability', access);
  const canProfOverride = access.isGm || canEditSheetField('attacks.proficient', access);
  const canBonusOverride = access.isGm || canEditSheetField('attacks.bonusOverride', access);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<Exclude<AttackEntryKind, 'weapon_override'>>('unarmed');
  const [newSpellClassId, setNewSpellClassId] = useState<string>('');
  const [newAbility, setNewAbility] = useState<string>('');
  const [newDamage, setNewDamage] = useState('');
  const [newDamageType, setNewDamageType] = useState('');
  const [newRange, setNewRange] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const hasMonkClass = classes.some((c) => c.classId === 'monk');
  const spellSources = spellcasting?.sources ?? [];
  const manualDrafts = draftAttacks.filter((atk) => atk.inventoryItemId === null);
  const hasUnsavedAttackChanges = JSON.stringify(savedAttacks) !== JSON.stringify(draftAttacks);

  function handleAddManualAttack() {
    const cleanName = newName.trim();
    if (!cleanName) return;

    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `atk-${crypto.randomUUID().slice(0, 8)}`
        : `atk-${Date.now()}`;

    const entry: Dnd5e2014AttackEntry = {
      id,
      inventoryItemId: null,
      kind: newKind,
      spellSourceClassId: newKind === 'spell' && newSpellClassId ? newSpellClassId : null,
      name: cleanName,
      ability:
        newKind === 'unarmed' && (newAbility === 'str' || newAbility === 'dex')
          ? (newAbility as AbilityKey)
          : newKind === 'gm_custom' && newAbility
            ? (newAbility as AbilityKey)
            : null,
      abilityOverride: null,
      proficient: false,
      proficientOverride: null,
      bonusOverride: null,
      attackBonus: null,
      damage: newDamage.trim() || null,
      damageType: newDamageType.trim() || null,
      range: newRange.trim() || null,
      notes: newNotes.trim(),
    };

    onChangeAttacks([...draftAttacks, entry]);
    setNewName('');
    setNewDamage('');
    setNewDamageType('');
    setNewRange('');
    setNewNotes('');
    setNewAbility('');
    setNewSpellClassId('');
    setAdding(false);
  }

  function handleRemoveManualAttack(id: string) {
    onChangeAttacks(draftAttacks.filter((atk) => atk.id !== id));
  }

  return (
    <Card
      title="Atacs i accions ofensives"
      subtitle="Armes equipades de l’inventari i atacs manuals calculats pel motor D&D 5e."
      actions={
        canEditAttacks && (
          <Button size="sm" variant="secondary" onClick={() => setAdding((v) => !v)}>
            <Plus className="h-3.5 w-3.5" />
            {adding ? 'Tancar formulari' : 'Nou atac manual'}
          </Button>
        )
      }
    >
      <div className="space-y-4">
        {/* Taula / llista d'atacs calculats pel servidor */}
        {computedAttacks.length === 0 ? (
          <p className="text-sm text-[var(--rol-ink-muted)]">
            Cap arma equipada ni atac manual configurat encara. Les armes equipades a l’inventari
            apareixeran aquí automàticament.
          </p>
        ) : (
          <div className="space-y-2.5">
            {computedAttacks.map((atk) => (
              <div
                key={atk.id}
                className="rounded-[var(--rol-radius-md)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface-alt)]/35 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Swords className="h-3.5 w-3.5 shrink-0 text-[var(--rol-accent-primary)]" />
                      <span className="font-semibold text-[var(--rol-ink-primary)]">
                        {atk.name}
                      </span>
                      <Badge tone={atk.source === 'equipped_weapon' ? 'gold' : 'neutral'}>
                        {KIND_LABELS[atk.attackKind]}
                      </Badge>
                      {atk.ability && (
                        <Badge tone="neutral">{ABILITY_SHORT_CA[atk.ability]}</Badge>
                      )}
                      {atk.isAbilityOverridden && <Badge tone="warning">Aptitud GM</Badge>}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--rol-ink-secondary)]">
                      {atk.damage && (
                        <span>
                          <strong>Dany:</strong> {atk.damage}
                          {atk.damageType ? ` ${atk.damageType}` : ''}
                        </span>
                      )}
                      {atk.range && (
                        <span>
                          <strong>Abast:</strong> {atk.range}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3 text-[var(--rol-ink-muted)]" />
                        {PROF_LABELS[atk.proficiencySource]}
                      </span>
                    </div>

                    {(atk.properties || atk.notes) && (
                      <p className="text-xs text-[var(--rol-ink-muted)]">
                        {[atk.properties, atk.notes].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
                      Atac
                    </span>
                    <span className="rol-heading-flourish inline-block min-w-[3rem] rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2.5 py-1 text-center font-mono text-base font-bold text-[var(--rol-accent-primary)]">
                      {atk.attackBonusDisplay ?? '—'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Formulari d'afegir atac manual */}
        {adding && canEditAttacks && (
          <div className="rounded-[var(--rol-radius-md)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface-alt)]/50 p-3.5 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--rol-ink-primary)]">
              Afegir atac manual
            </h4>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div>
                <label htmlFor="new-atk-name" className="mb-1 block text-xs font-medium">
                  Nom
                </label>
                <input
                  id="new-atk-name"
                  type="text"
                  maxLength={120}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex. Cop desarmat / Raig de foc"
                  className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2.5 py-1.5 text-sm"
                />
              </div>

              <div>
                <label htmlFor="new-atk-kind" className="mb-1 block text-xs font-medium">
                  Tipus d’atac
                </label>
                <select
                  id="new-atk-kind"
                  value={newKind}
                  onChange={(e) => {
                    const nextKind = e.target.value as Exclude<AttackEntryKind, 'weapon_override'>;
                    setNewKind(nextKind);
                    setNewAbility('');
                  }}
                  className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2.5 py-1.5 text-sm"
                >
                  <option value="unarmed">Cop desarmat (oficial)</option>
                  <option value="spell">Atac màgic (segons classe)</option>
                  <option value="special">Habilitat especial</option>
                  {canGmCustom && <option value="gm_custom">Personalitzat del GM</option>}
                </select>
              </div>
            </div>

            {newKind === 'unarmed' && (
              <div>
                <label htmlFor="new-atk-ability" className="mb-1 block text-xs font-medium">
                  Característica oficial permesa
                </label>
                <select
                  id="new-atk-ability"
                  value={newAbility}
                  onChange={(e) => setNewAbility(e.target.value)}
                  className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2.5 py-1.5 text-xs"
                >
                  <option value="">Automàtica ({hasMonkClass ? 'FOR o DES' : 'FOR'})</option>
                  <option value="str">{ABILITY_LABELS_CA.str}</option>
                  {hasMonkClass && <option value="dex">{ABILITY_LABELS_CA.dex} (Arts Marcials)</option>}
                </select>
              </div>
            )}

            {newKind === 'spell' && (
              <div>
                <label htmlFor="new-atk-spell-source" className="mb-1 block text-xs font-medium">
                  Classe llançadora
                </label>
                <select
                  id="new-atk-spell-source"
                  value={newSpellClassId}
                  onChange={(e) => setNewSpellClassId(e.target.value)}
                  className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2.5 py-1.5 text-xs"
                >
                  <option value="">Automàtica segons fonts actives</option>
                  {spellSources.map((src) => (
                    <option key={src.classId} value={src.classId}>
                      {src.classLabelCa} ({src.abilityLabelCa ?? 'sense aptitud'})
                    </option>
                  ))}
                </select>
                {spellSources.length === 0 && (
                  <p className="mt-1 text-[11px] text-[var(--rol-ink-muted)]">
                    Aquest personatge no té cap classe amb màgia activa; sense excepció del GM no
                    obtindrà bonificador màgic.
                  </p>
                )}
              </div>
            )}

            {newKind === 'special' && (
              <p className="text-[11px] text-[var(--rol-ink-muted)]">
                Els atacs especials no permeten autoassignar aptituds ni competència; si requereixen
                bonificador numèric, l’ha d’autoritzar el Director de Joc.
              </p>
            )}

            <div className="grid gap-2.5 sm:grid-cols-3">
              <div>
                <label htmlFor="new-atk-damage" className="mb-1 block text-xs font-medium">
                  Dany
                </label>
                <input
                  id="new-atk-damage"
                  type="text"
                  maxLength={80}
                  value={newDamage}
                  onChange={(e) => setNewDamage(e.target.value)}
                  placeholder="Ex. 1d8 + 3"
                  className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label htmlFor="new-atk-damage-type" className="mb-1 block text-xs font-medium">
                  Tipus de dany
                </label>
                <input
                  id="new-atk-damage-type"
                  type="text"
                  maxLength={60}
                  value={newDamageType}
                  onChange={(e) => setNewDamageType(e.target.value)}
                  placeholder="Ex. foc / contudent"
                  className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label htmlFor="new-atk-range" className="mb-1 block text-xs font-medium">
                  Abast
                </label>
                <input
                  id="new-atk-range"
                  type="text"
                  maxLength={80}
                  value={newRange}
                  onChange={(e) => setNewRange(e.target.value)}
                  placeholder="Ex. 1,5 m / 36 m"
                  className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-strong)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs"
                />
              </div>
            </div>

            <div>
              <label htmlFor="new-atk-notes" className="mb-1 block text-xs font-medium">
                Notes
              </label>
              <input
                id="new-atk-notes"
                type="text"
                maxLength={1000}
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Efectes addicionals, salvacions associades…"
                className="w-full rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] px-2 py-1 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Cancel·lar
              </Button>
              <Button size="sm" disabled={!newName.trim()} onClick={handleAddManualAttack}>
                Afegir a l’esborrany
              </Button>
            </div>
          </div>
        )}

        {/* Gestió d'atacs manuals existents (eliminar o editar overrides si GM) */}
        {canEditAttacks && manualDrafts.length > 0 && (
          <div className="border-t border-[var(--rol-border-subtle)] pt-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--rol-ink-muted)]">
              Atacs manuals desats / en esborrany
            </p>
            <ul className="space-y-1.5 text-xs">
              {manualDrafts.map((atk) => {
                const lockedGmCustom = atk.kind === 'gm_custom' && !canGmCustom;
                return (
                  <li
                    key={atk.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--rol-radius-sm)] border border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] px-2.5 py-1.5"
                  >
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="font-medium text-[var(--rol-ink-primary)]">{atk.name}</span>
                      <Badge tone="neutral">{KIND_LABELS[atk.kind]}</Badge>
                      {canAbilityOverride && atk.abilityOverride && (
                        <Badge tone="warning">Aptitud: {ABILITY_SHORT_CA[atk.abilityOverride]}</Badge>
                      )}
                      {canProfOverride && atk.proficientOverride !== null && (
                        <Badge tone="warning">
                          Comp: {atk.proficientOverride ? 'Sí' : 'No'}
                        </Badge>
                      )}
                      {canBonusOverride && atk.bonusOverride !== null && (
                        <Badge tone="warning">Bo: {atk.bonusOverride}</Badge>
                      )}
                    </div>
                    {lockedGmCustom ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--rol-ink-muted)]">
                        <Lock className="h-3 w-3" />
                        Només GM
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRemoveManualAttack(atk.id)}
                        aria-label={`Eliminar atac manual ${atk.name}`}
                        className="rounded p-1 text-[var(--rol-status-danger-ink)] hover:bg-[var(--rol-status-danger-bg)] cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {hasUnsavedAttackChanges && (
              <p className="text-[11px] font-medium text-[var(--rol-status-warning-ink)]">
                Hi ha canvis pendents als atacs manuals. Prem «Desar canvis» per recalcular les
                bonificacions al servidor.
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
