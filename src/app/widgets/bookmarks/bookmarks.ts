import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { DashboardStore } from '../../dashboard/dashboard-store';
import type { Bookmark, Widget } from '../../dashboard/workspace';
import { isBookmarkUrl } from '../widget-values';

export function groupBookmarks(links: Bookmark[]): [string, Bookmark[]][] {
  const groups = new Map<string, Bookmark[]>();
  for (const link of links) {
    const group = groups.get(link.group);
    if (group) group.push(link);
    else groups.set(link.group, [link]);
  }
  return [...groups];
}

const ICONS = [
  { value: '', label: 'Site initial', glyph: '' },
  { value: 'work', label: 'Work', glyph: '◆' },
  { value: 'reading', label: 'Reading', glyph: '▤' },
  { value: 'favorite', label: 'Favorite', glyph: '☆' },
];

const EMPTY_LINK = { title: '', url: '', group: '', icon: '' };

@Component({
  selector: 'app-bookmarks-widget',
  imports: [ReactiveFormsModule],
  templateUrl: './bookmarks.html',
  styleUrl: './bookmarks.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookmarksWidget {
  readonly widget = input.required<Widget<'bookmarks'>>();
  readonly settings = input(false);
  private readonly store = inject(DashboardStore);
  private readonly id = computed(() => this.widget().id);

  protected readonly icons = ICONS;
  protected readonly groups = computed(() => groupBookmarks(this.widget().data.links));
  protected readonly editing = signal<string | null>(null);
  protected readonly error = signal<'title' | 'url' | null>(null);
  protected readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true }),
    url: new FormControl('', { nonNullable: true }),
    group: new FormControl('', { nonNullable: true }),
    icon: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      this.id();
      this.cancel();
    });
  }

  protected begin(link?: Bookmark): void {
    this.error.set(null);
    this.form.setValue(
      link ? { title: link.title, url: link.url, group: link.group, icon: link.icon } : EMPTY_LINK,
    );
    this.editing.set(link?.id ?? '');
  }

  protected cancel(): void {
    this.editing.set(null);
    this.error.set(null);
  }

  protected save(): void {
    const value = this.form.getRawValue();
    const title = value.title.trim();
    const url = value.url.trim();
    if (!title || !isBookmarkUrl(url)) {
      this.error.set(title ? 'url' : 'title');
      return;
    }
    const id = this.editing();
    const link = { id: id || crypto.randomUUID(), ...value, title, url, group: value.group.trim() };
    const widget = this.store.getWidget(this.widget().id, 'bookmarks');
    if (!widget) return;
    const links = id
      ? widget.data.links.map((item) => (item.id === id ? link : item))
      : [...widget.data.links, link];
    this.store.updateWidget({ ...widget, data: { links } });
    this.cancel();
  }

  protected remove(id: string): void {
    const widget = this.store.getWidget(this.widget().id, 'bookmarks');
    if (!widget) return;
    this.store.updateWidget({
      ...widget,
      data: { links: widget.data.links.filter((link) => link.id !== id) },
    });
    if (this.editing() === id) this.cancel();
  }

  protected glyph(link: Bookmark): string {
    return (
      ICONS.find(({ value }) => value === link.icon)?.glyph ||
      new URL(link.url).hostname
        .replace(/^www\./, '')
        .slice(0, 1)
        .toUpperCase()
    );
  }
}
