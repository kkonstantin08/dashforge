import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DashboardStore } from '../dashboard/dashboard-store';
import type { Theme } from '../dashboard/workspace';
import { AppearancePreview } from './appearance-preview';
import {
  BUILTIN_FONTS,
  DEFAULT_APPEARANCE,
  HEX_COLOR,
  MAX_FONTS,
  PALETTES,
  type Appearance,
  type Palette,
} from './appearance';
import { validateFont } from './local-font';

const COLOR_FIELDS = [
  { key: 'background', label: 'Background' },
  { key: 'cards', label: 'Cards' },
  { key: 'accent', label: 'Accent' },
] as const;
type InvalidColors = Partial<Record<Theme, Partial<Palette>>>;

@Component({
  selector: 'app-appearance-panel',
  templateUrl: './appearance-panel.html',
  styleUrl: './appearance-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(keydown)': 'cycleFocus($event)' },
})
export class AppearancePanel {
  private readonly store = inject(DashboardStore);
  private readonly preview = inject(AppearancePreview);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly additions = new Map<string, Blob>();
  private destroyed = false;

  readonly closed = output<void>();
  protected readonly theme = signal(this.store.workspace().theme);
  protected readonly appearance = signal(this.store.workspace().appearance ?? DEFAULT_APPEARANCE);
  protected readonly palette = computed(() => this.appearance().palettes[this.theme()]);
  protected readonly invalidColors = signal<InvalidColors>({});
  protected readonly invalid = computed(() =>
    Object.values(this.invalidColors()).some((fields) => Object.keys(fields).length > 0),
  );
  protected readonly uploading = signal(false);
  protected readonly uploadError = signal('');
  protected readonly failedFonts = this.preview.failedFonts;
  protected readonly colorFields = COLOR_FIELDS;
  protected readonly presets = Object.entries(PALETTES);
  protected readonly fontRoles = [
    { key: 'headings', label: 'Headings' },
    { key: 'body', label: 'Body' },
  ] as const;
  protected readonly builtins = Object.entries(BUILTIN_FONTS);

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
    effect(() =>
      this.preview.show({
        theme: this.theme(),
        appearance: this.appearance(),
        additions: this.additions,
      }),
    );
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.preview.show(null);
    });
  }

  protected choosePreset(palette: Palette): void {
    this.invalidColors.update((invalid) => ({ ...invalid, [this.theme()]: {} }));
    this.appearance.update((value) => ({
      ...value,
      palettes: { ...value.palettes, [this.theme()]: palette },
    }));
  }

  protected samePalette(palette: Palette): boolean {
    return this.colorFields.every(({ key }) => palette[key] === this.palette()[key]);
  }

  protected changeColor(key: keyof Palette, color: string): void {
    const valid = HEX_COLOR.test(color);
    const theme = this.theme();
    this.invalidColors.update((current) => {
      const fields = { ...current[theme] };
      if (valid) delete fields[key];
      else fields[key] = color;
      return { ...current, [theme]: fields };
    });
    if (valid) {
      this.appearance.update((value) => ({
        ...value,
        palettes: { ...value.palettes, [theme]: { ...this.palette(), [key]: color.toUpperCase() } },
      }));
    }
  }

  protected setAppearance<K extends 'headings' | 'body' | 'density' | 'radius'>(
    key: K,
    value: Appearance[K],
  ): void {
    this.appearance.update((appearance) => ({ ...appearance, [key]: value }));
  }

  protected async upload(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.uploading()) return;
    if (this.appearance().imported.length >= MAX_FONTS) {
      this.uploadError.set('You can keep up to six imported fonts. Remove one to add another.');
      return;
    }
    this.uploadError.set('');
    this.uploading.set(true);
    const id = crypto.randomUUID();
    try {
      await validateFont(id, file);
      if (this.destroyed) return;
      this.additions.set(id, file);
      this.appearance.update((current) => ({
        ...current,
        imported: [...current.imported, { id, name: file.name.slice(0, 255) }],
      }));
    } catch (error) {
      if (!this.destroyed)
        this.uploadError.set(error instanceof Error ? error.message : 'Could not open this font.');
    } finally {
      if (!this.destroyed) this.uploading.set(false);
    }
  }

  protected removeFont(id: string): void {
    this.additions.delete(id);
    this.uploadError.set('');
    this.appearance.update((value) => ({
      ...value,
      headings: value.headings === id ? DEFAULT_APPEARANCE.headings : value.headings,
      body: value.body === id ? DEFAULT_APPEARANCE.body : value.body,
      imported: value.imported.filter((font) => font.id !== id),
    }));
  }

  protected reset(): void {
    this.invalidColors.set({});
    this.uploadError.set('');
    this.appearance.update((value) => ({ ...DEFAULT_APPEARANCE, imported: value.imported }));
  }

  protected save(): void {
    if (this.invalid() || this.uploading()) return;
    this.store.applyAppearance(this.theme(), this.appearance(), this.additions);
    this.dismiss();
  }

  protected cycleFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;
    const dialog = this.dialog().nativeElement;
    const controls = dialog.querySelectorAll<HTMLElement>(
      'button:enabled, input:enabled:not([hidden]), select:enabled',
    );
    const first = controls.item(0);
    const last = controls.item(controls.length - 1);
    if (dialog.ownerDocument.activeElement !== (event.shiftKey ? first : last)) return;
    event.preventDefault();
    (event.shiftKey ? last : first)?.focus();
  }

  protected dismiss(event?: Event): void {
    event?.preventDefault();
    this.preview.show(null);
    this.closed.emit();
  }
}
