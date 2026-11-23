export type RollMode = 'advantage' | 'normal' | 'disadvantage';

/**
 * Type of d20 roll under D&D 5e (2014) rules.
 * Critical hits (natural 20) and automatic misses (natural 1) apply ONLY to 'attack' rolls
 * (PHB 2014 p. 194), never to ability checks, skill checks, initiative, or saving throws.
 */
export type D20RollCheckType = 'ability' | 'skill' | 'saving_throw' | 'attack' | 'initiative';

export interface ResolveRollModeInput {
  explicitMode?: RollMode;
  advantageSources?: number;
  disadvantageSources?: number;
}

/**
 * Resolves D&D 5e (2014) advantage/disadvantage state.
 * Per PHB 2014 p. 173, ANY combination of advantage and disadvantage cancels out to 'normal'.
 */
export function resolveRollMode(input: ResolveRollModeInput): RollMode {
  const hasAdvantage =
    input.explicitMode === 'advantage' || (input.advantageSources ?? 0) > 0;
  const hasDisadvantage =
    input.explicitMode === 'disadvantage' || (input.disadvantageSources ?? 0) > 0;

  if (hasAdvantage && hasDisadvantage) {
    return 'normal';
  }
  if (hasAdvantage) {
    return 'advantage';
  }
  if (hasDisadvantage) {
    return 'disadvantage';
  }
  return 'normal';
}

export interface D20RollInput {
  modifier: number;
  checkType?: D20RollCheckType;
  mode?: RollMode;
  advantageSources?: number;
  disadvantageSources?: number;
  rng?: () => number;
}

export interface D20RollResult {
  checkType: D20RollCheckType;
  mode: RollMode;
  dice: number[];
  keptDie: number;
  discardedDie: number | null;
  modifier: number;
  total: number;
  isNatural20: boolean;
  isNatural1: boolean;
  isCriticalHit: boolean;
  isCriticalMiss: boolean;
}

function rollSingleD20(rng: () => number): number {
  const raw = Math.floor(rng() * 20) + 1;
  return Math.min(20, Math.max(1, raw));
}

/**
 * Executes a D&D 5e (2014) d20 check with modifier and advantage/disadvantage.
 * Per PHB 2014 p. 173 & p. 194, natural 20 and natural 1 trigger automatic critical hit / miss
 * ONLY when `checkType === 'attack'`, never on ability checks, skills, or saving throws.
 */
export function rollD20Check(input: D20RollInput): D20RollResult {
  const rng = input.rng ?? Math.random;
  const checkType: D20RollCheckType = input.checkType ?? 'ability';
  const isAttack = checkType === 'attack';
  const mode = resolveRollMode({
    explicitMode: input.mode,
    advantageSources: input.advantageSources,
    disadvantageSources: input.disadvantageSources,
  });

  if (mode === 'normal') {
    const d1 = rollSingleD20(rng);
    return {
      checkType,
      mode,
      dice: [d1],
      keptDie: d1,
      discardedDie: null,
      modifier: input.modifier,
      total: d1 + input.modifier,
      isNatural20: d1 === 20,
      isNatural1: d1 === 1,
      isCriticalHit: isAttack && d1 === 20,
      isCriticalMiss: isAttack && d1 === 1,
    };
  }

  const d1 = rollSingleD20(rng);
  const d2 = rollSingleD20(rng);
  const keptDie = mode === 'advantage' ? Math.max(d1, d2) : Math.min(d1, d2);
  const discardedDie = mode === 'advantage' ? Math.min(d1, d2) : Math.max(d1, d2);

  return {
    checkType,
    mode,
    dice: [d1, d2],
    keptDie,
    discardedDie,
    modifier: input.modifier,
    total: keptDie + input.modifier,
    isNatural20: keptDie === 20,
    isNatural1: keptDie === 1,
    isCriticalHit: isAttack && keptDie === 20,
    isCriticalMiss: isAttack && keptDie === 1,
  };
}
