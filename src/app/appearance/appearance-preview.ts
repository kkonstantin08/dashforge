import { DOCUMENT } from '@angular/common';
import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { DashboardStore } from '../dashboard/dashboard-store';
import type { Theme } from '../dashboard/workspace';
import { type Appearance, DEFAULT_APPEARANCE, FONT_ID } from './appearance';
import { surfaceColors } from './appearance-colors';
import { loadFace, localFamily } from './local-font';

type Draft = { theme: Theme; appearance: Appearance; additions: ReadonlyMap<string, Blob> };
type FaceLoad = { face?: FontFace };

function fontStack(id: string, fallback: string): string {
  switch (id) {
    case 'lora':
      return 'Lora, Georgia, serif';
    case 'mono':
      return 'ui-monospace, monospace';
    case 'system':
      return 'system-ui, sans-serif';
    default:
      return `${localFamily(id)}, ${fallback}`;
  }
}

@Injectable({ providedIn: 'root' })
export class AppearancePreview {
  private readonly store = inject(DashboardStore);
  private readonly document = inject(DOCUMENT);
  private readonly draft = signal<Draft | null>(null);
  private readonly theme = computed(() => this.draft()?.theme ?? this.store.workspace().theme);
  private readonly appearance = computed(
    () => this.draft()?.appearance ?? this.store.workspace().appearance ?? DEFAULT_APPEARANCE,
  );
  private readonly headings = computed(() => this.appearance().headings);
  private readonly body = computed(() => this.appearance().body);
  private readonly faces = new Map<string, FaceLoad>();
  private readonly failed = signal<string[]>([]);
  readonly failedFonts = this.failed.asReadonly();

  constructor() {
    const root = this.document.documentElement;
    effect(() => this.render(root, this.theme(), this.appearance()));
    effect(() => {
      const selected = new Set([this.headings(), this.body()].filter((id) => FONT_ID.test(id)));
      const staged = this.draft()?.additions;
      for (const id of this.faces.keys()) if (!selected.has(id)) this.unload(id);
      for (const id of selected) {
        if (!this.faces.has(id)) void this.load(id, staged?.get(id));
      }
    });
    inject(DestroyRef).onDestroy(() => {
      for (const id of this.faces.keys()) this.unload(id);
    });
  }

  show(draft: Draft | null): void {
    this.draft.set(draft);
  }

  private async load(id: string, staged?: Blob): Promise<void> {
    const entry: FaceLoad = {};
    this.faces.set(id, entry);
    try {
      const blob = staged ?? (await this.store.readFont(id));
      if (!blob) throw new Error('Font file is unavailable.');
      const face = await loadFace(id, blob);
      if (this.faces.get(id) !== entry) return;
      this.document.fonts.add(face);
      entry.face = face;
      this.failed.update((ids) => ids.filter((failed) => failed !== id));
    } catch {
      if (this.faces.get(id) === entry) this.failed.update((ids) => [...new Set([...ids, id])]);
    }
  }

  private unload(id: string): void {
    const face = this.faces.get(id)?.face;
    if (face) this.document.fonts.delete(face);
    this.faces.delete(id);
  }

  private render(root: HTMLElement, theme: Theme, appearance: Appearance): void {
    const palette = appearance.palettes[theme];
    const cards = surfaceColors(palette.cards, palette.accent, theme);
    const canvas = surfaceColors(palette.background, palette.accent, theme);
    root.dataset['theme'] = theme;
    root.dataset['density'] = appearance.density;
    const values = {
      '--canvas': palette.background,
      '--surface': palette.cards,
      '--text': cards.text,
      '--muted': cards.muted,
      '--border': cards.border,
      '--control-border': cards.control,
      '--accent': cards.accent,
      '--on-accent': cards.onAccent,
      '--error': cards.error,
      '--canvas-text': canvas.text,
      '--canvas-muted': canvas.muted,
      '--canvas-accent': canvas.accent,
      '--canvas-on-accent': canvas.onAccent,
      '--grid-line': canvas.border,
      '--tile-radius': `${appearance.radius}px`,
      '--heading-font': fontStack(appearance.headings, 'Lora, Georgia, serif'),
      '--body-font': fontStack(appearance.body, 'system-ui, sans-serif'),
    };
    for (const [property, value] of Object.entries(values)) root.style.setProperty(property, value);
  }
}
