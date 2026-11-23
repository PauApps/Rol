import { dnd5e2014System } from './dnd5e-2014';
import type { GameSystemDefinition } from './types';

const SYSTEMS_MAP = new Map<string, GameSystemDefinition>([
  [dnd5e2014System.id, dnd5e2014System],
]);

export function getGameSystem(systemId: string): GameSystemDefinition | undefined {
  return SYSTEMS_MAP.get(systemId);
}

export function listRegisteredGameSystems(): GameSystemDefinition[] {
  return Array.from(SYSTEMS_MAP.values());
}
