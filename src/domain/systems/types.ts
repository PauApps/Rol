export interface GameSystemSectionDefinition {
  key: string;
  labelCa: string;
  descriptionCa: string;
}

export interface GameSystemDefinition<TSheet extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  name: string;
  shortName: string;
  version: string;
  schemaVersion: number;
  /**
   * Sections exposed by character sheets in this system.
   * Rules and derived calculations are implemented per system in Phase 3+.
   */
  sections: GameSystemSectionDefinition[];
  createEmptySheet: (characterName: string) => TSheet;
}
