import type { GameSystemDefinition } from '../types';
import {
  DND5E_2014_SECTIONS,
  createEmptyDnd5e2014Sheet,
  type Dnd5e2014SheetData,
} from './schema';

export const dnd5e2014System: GameSystemDefinition<Dnd5e2014SheetData> = {
  id: 'dnd5e-2014',
  name: 'Dungeons & Dragons 5a edició (2014)',
  shortName: 'D&D 5e (2014)',
  version: '2014',
  schemaVersion: 2,
  sections: DND5E_2014_SECTIONS,
  createEmptySheet: createEmptyDnd5e2014Sheet,
};

export * from './catalog';
export * from './creation-catalog';
export * from './schema';
export * from './dice';
export * from './attacks';
export * from './resources';
export * from './rules';
export * from './validation';
export * from './permissions';
export * from './rests';
export * from './creation-validator';
