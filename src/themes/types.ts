export type ThemeId = 'fantasy-classic';

export interface ThemeDefinition {
  id: ThemeId;
  labelCa: string;
  descriptionCa: string;
}

export const DEFAULT_THEME: ThemeId = 'fantasy-classic';

export const AVAILABLE_THEMES: ThemeDefinition[] = [
  {
    id: 'fantasy-classic',
    labelCa: 'Fantasia clàssica',
    descriptionCa: 'Pergamí càlid, tinta de crònica i accents daurats subtils.',
  },
];
