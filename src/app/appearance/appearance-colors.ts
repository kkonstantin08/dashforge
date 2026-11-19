import type { Theme } from '../dashboard/workspace';

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [red, green, blue] = channels(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrast(first: string, second: string): number {
  const left = luminance(first) + 0.05;
  const right = luminance(second) + 0.05;
  return Math.max(left, right) / Math.min(left, right);
}

function mix(color: string, target: string, fraction: number): string {
  const end = channels(target);
  return `#${channels(color)
    .map((start, index) =>
      Math.round(start + (end[index] - start) * fraction)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function foreground(background: string): string {
  return contrast('#000000', background) >= contrast('#FFFFFF', background) ? '#000000' : '#FFFFFF';
}

function readable(color: string, background: string, minimum: number): string {
  if (contrast(color, background) >= minimum) return color;
  const target = foreground(background);
  for (let fraction = 0.05; fraction < 1; fraction += 0.05) {
    const candidate = mix(color, target, fraction);
    if (contrast(candidate, background) >= minimum) return candidate;
  }
  return target;
}

export function surfaceColors(background: string, choice: string, theme: Theme) {
  const light = theme === 'light';
  const text = readable(light ? '#29241F' : '#F4EADF', background, 4.5);
  const accent = readable(choice, background, 4.5);
  return {
    text,
    accent,
    onAccent: foreground(accent),
    muted: readable(mix(background, text, 0.72), background, 4.5),
    border: mix(background, text, 0.17),
    control: readable(mix(background, text, 0.45), background, 3),
    error: readable(light ? '#9B3030' : '#FFB3AD', background, 4.5),
  };
}
