import { describe, expect, it } from 'vitest';
import { PALETTES } from './appearance';
import { contrast, surfaceColors } from './appearance-colors';

describe('appearance contrast', () => {
  it('uses the agreed text and accent for the Studio palette', () => {
    const { cards, accent } = PALETTES.Studio.light;
    expect(surfaceColors(cards, accent, 'light')).toMatchObject({
      text: '#29241F',
      accent,
    });
  });

  it('keeps text, emphasis and interactive borders readable on arbitrary colors', () => {
    for (const background of ['#000000', '#FFFFFF', '#777777', '#FF0000', '#103E76', '#FFE900']) {
      for (const choice of ['#000000', '#FFFFFF', '#777777', '#223344']) {
        const palette = surfaceColors(background, choice, 'light');
        for (const color of [palette.text, palette.muted, palette.accent, palette.error]) {
          expect(contrast(color, background)).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrast(palette.control, background)).toBeGreaterThanOrEqual(3);
        expect(contrast(palette.onAccent, palette.accent)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
