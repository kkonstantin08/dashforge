import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { IndexedDbWorkspace, RevisionConflict } from '../storage/indexed-db';
import { WIDGETS } from '../widgets/widget-registry';
import {
  firstFree,
  GRID,
  limitsFor,
  occupiedExcept,
  projectMobile,
  resetLayout,
  usedRows,
  validatePlacement,
  type Placement,
  type PlacementResult,
  type Positions,
} from './layout';
import {
  createWidget,
  createWorkspace,
  type Theme,
  type View,
  type Widget,
  type WidgetType,
  type Workspace,
} from './workspace';

export type SaveState =
  'ready' | 'loading' | 'saving' | 'saved' | 'read-error' | 'write-error' | 'conflict';

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly storage = inject(IndexedDbWorkspace);
  private readonly model = signal(createWorkspace(systemTheme()));
  private readonly state = signal<SaveState>('ready');
  private revision = 0;
  private persisted = this.model();
  private timer?: ReturnType<typeof setTimeout>;
  private writing = false;
  private destroyed = false;

  readonly workspace = this.model.asReadonly();
  readonly saveState = this.state.asReadonly();
  readonly canEdit = computed(() => this.state() !== 'loading' && this.state() !== 'read-error');

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.clearTimer();
    });
  }

  async load(): Promise<void> {
    if (this.writing || this.state() === 'loading') return;
    const wasConflict = this.state() === 'conflict';
    this.clearTimer();
    this.state.set('loading');
    try {
      const stored = await this.storage.read();
      if (this.destroyed) return;
      this.revision = stored?.revision ?? 0;
      this.persisted = stored?.workspace ?? createWorkspace(systemTheme());
      this.model.set(this.persisted);
      this.state.set(stored ? 'saved' : 'ready');
    } catch {
      if (!this.destroyed) this.state.set(wasConflict ? 'conflict' : 'read-error');
    }
  }

  setTheme(theme: Theme): void {
    const current = this.model();
    if (current.theme !== theme) this.change({ ...current, theme });
  }

  updateWidget(widget: Widget, debounce = false): void {
    const current = this.model();
    const previous = current.widgets.find((item) => item.id === widget.id);
    if (!previous || previous.type !== widget.type || previous === widget) return;
    this.change(
      {
        ...current,
        widgets: current.widgets.map((item) => (item.id === widget.id ? widget : item)),
      },
      debounce,
    );
  }

  async retrySave(): Promise<void> {
    if (this.state() !== 'write-error') return;
    this.state.set('saving');
    await this.flush();
  }

  async flush(): Promise<void> {
    this.clearTimer();
    const snapshot = this.model();
    if (
      this.writing ||
      this.destroyed ||
      !this.canEdit() ||
      snapshot === this.persisted ||
      this.state() === 'conflict' ||
      this.state() === 'write-error'
    )
      return;
    this.writing = true;
    this.state.set('saving');
    try {
      this.revision = await this.storage.write(snapshot, this.revision);
      this.persisted = snapshot;
      if (!this.destroyed && this.model() === snapshot) this.state.set('saved');
    } catch (error) {
      if (!this.destroyed)
        this.state.set(error instanceof RevisionConflict ? 'conflict' : 'write-error');
    } finally {
      this.writing = false;
      if (this.state() === 'saving' && this.timer === undefined && this.model() !== snapshot)
        void this.flush();
    }
  }

  private change(next: Workspace, debounce = false): void {
    if (!this.canEdit()) return;
    this.model.set(next);
    if (this.state() === 'conflict' || this.state() === 'write-error') return;
    this.state.set('saving');
    this.clearTimer();
    if (debounce) this.timer = setTimeout(() => void this.flush(), 250);
    else void this.flush();
  }

  private clearTimer(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  add(type: WidgetType): 'ok' | 'full' {
    if (!this.canEdit()) return 'full';
    const current = this.model();
    const { start } = WIDGETS[type];
    const desktop = firstFree(start, Object.values(current.desktop), GRID.desktop);
    if (!desktop) return 'full';

    const widget = createWidget(type);
    const next = {
      ...current,
      widgets: [...current.widgets, widget],
      desktop: { ...current.desktop, [widget.id]: desktop },
    };
    if (current.mobile) {
      const size = { width: WIDGETS[type].mobileMinimumWidth, height: start.height };
      const mobile = firstFree(size, Object.values(current.mobile), GRID.mobile);
      if (!mobile) return 'full';
      next.mobile = { ...current.mobile, [widget.id]: mobile };
    } else if (usedRows(projectMobile(next)) > GRID.mobile.rows) {
      return 'full';
    }

    this.change(next);
    return 'ok';
  }

  place(id: string, view: View, rect: Placement): PlacementResult {
    if (!this.canEdit()) return 'bounds';
    const current = this.model();
    const widget = current.widgets.find((item) => item.id === id);
    if (!widget) return 'bounds';
    const positions =
      view === 'desktop' ? current.desktop : (current.mobile ?? projectMobile(current));
    const result = validatePlacement(
      rect,
      occupiedExcept(positions, id),
      limitsFor(widget.type, view),
    );
    if (result !== 'ok') return result;
    const previous = positions[id];
    if (
      previous.col === rect.col &&
      previous.row === rect.row &&
      previous.width === rect.width &&
      previous.height === rect.height
    )
      return 'ok';
    this.change({ ...current, [view]: { ...positions, [id]: rect } });
    return 'ok';
  }

  remove(id: string): void {
    const current = this.model();
    const widgets = current.widgets.filter((item) => item.id !== id);
    if (widgets.length === current.widgets.length) return;
    const without = (positions: Positions) =>
      Object.fromEntries(Object.entries(positions).filter(([key]) => key !== id));
    this.change({
      ...current,
      widgets,
      desktop: without(current.desktop),
      mobile: current.mobile && without(current.mobile),
    });
  }

  resetLayout(): 'ok' | 'full' {
    if (!this.canEdit()) return 'full';
    const next = resetLayout(this.model());
    if (!next) return 'full';
    this.change(next);
    return 'ok';
  }
}
