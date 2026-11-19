import type { Theme } from '../dashboard/workspace';

export type Palette = { background: string; cards: string; accent: string };
export type LocalFont = { id: string; name: string };
export type Appearance = {
  palettes: Record<Theme, Palette>;
  headings: string;
  body: string;
  imported: LocalFont[];
  density: 'comfortable' | 'compact';
  radius: number;
};

export const BUILTIN_FONTS = { lora: 'Lora', system: 'System Sans', mono: 'System Mono' };
export const MAX_FONTS = 6;
export const MAX_FONT_BYTES = 5 * 1024 ** 2;
export const FONT_ID = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
export const HEX_COLOR = /^#[\da-f]{6}$/i;

export const PALETTES = {
  Studio: {
    light: { background: '#F3EEE5', cards: '#FFFDF8', accent: '#98492E' },
    dark: { background: '#1B1715', cards: '#25201D', accent: '#F1AE89' },
  },
  Olive: {
    light: { background: '#E8EADF', cards: '#F8FAF2', accent: '#4F622F' },
    dark: { background: '#181F17', cards: '#222D21', accent: '#BACD8F' },
  },
  Ink: {
    light: { background: '#E8ECF2', cards: '#F8FAFF', accent: '#355581' },
    dark: { background: '#191D26', cards: '#242C3A', accent: '#B3CAFA' },
  },
} satisfies Record<string, Record<Theme, Palette>>;

export const DEFAULT_APPEARANCE: Appearance = {
  palettes: PALETTES.Studio,
  headings: 'lora',
  body: 'system',
  imported: [],
  density: 'comfortable',
  radius: 18,
};
