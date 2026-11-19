import { CdkDrag, type CdkDragEnd, type CdkDragStart } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { AppearancePanel } from '../appearance/appearance-panel';
import { WIDGETS, WIDGET_TYPES } from '../widgets/widget-registry';
import { DashboardStore } from './dashboard-store';
import { GridGesture, PLACEMENT_ERRORS } from './grid-gesture';
import { GRID, limitsFor, occupiedExcept, projectMobile, usedRows, type Placement } from './layout';
import { WidgetCard } from './widget-card';
import { WidgetInspector } from './widget-inspector';
import type { View, Widget, WidgetType } from './workspace';

@Component({
  selector: 'app-dashboard',
  imports: [CdkDrag, WidgetCard, WidgetInspector, AppearancePanel],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:resize)': 'updateView()' },
})
export class Dashboard {
  private readonly gesture = new GridGesture();
  private anchor?: HTMLElement;
  private width = window.innerWidth;
  protected readonly selectedId = signal<string | null>(null);
  protected readonly store = inject(DashboardStore);
  protected readonly widgets = WIDGETS;
  protected readonly types = WIDGET_TYPES;
  protected readonly editing = signal(false);
  protected readonly appearanceOpen = signal(false);
  protected readonly message = signal('');
  protected readonly view = signal<View>(window.innerWidth < 760 ? 'mobile' : 'desktop');
  protected readonly columns = computed(() => GRID[this.view()].columns);
  protected readonly positions = computed(() => {
    const workspace = this.store.workspace();
    return this.view() === 'desktop'
      ? workspace.desktop
      : (workspace.mobile ?? projectMobile(workspace));
  });

  protected readonly selected = computed(() =>
    this.store.workspace().widgets.find((widget) => widget.id === this.selectedId()),
  );
  protected readonly rows = computed(() => usedRows(this.positions()));
  protected readonly editRows = computed(() => Math.min(GRID[this.view()].rows, this.rows() + 6));
  protected readonly selectedNeighbors = computed(() =>
    occupiedExcept(this.positions(), this.selectedId() ?? ''),
  );
  protected readonly limits = limitsFor;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.gesture.dispose());
  }

  protected updateView(): void {
    if (this.width === window.innerWidth) return;
    this.width = window.innerWidth;
    this.gesture.cancel();
    this.view.set(this.width < 760 ? 'mobile' : 'desktop');
  }

  protected toggleEditor(): void {
    this.gesture.cancel();
    this.editing.update((active) => !active);
    this.message.set('');
  }

  protected openAppearance(): void {
    this.gesture.cancel();
    this.selectedId.set(null);
    this.anchor = undefined;
    this.appearanceOpen.set(true);
  }

  protected closeAppearance(anchor: HTMLElement): void {
    this.appearanceOpen.set(false);
    requestAnimationFrame(() => anchor.focus());
  }

  protected select(widget: Widget, anchor: HTMLElement): void {
    this.gesture.cancel();
    this.anchor = anchor;
    this.selectedId.set(widget.id);
  }

  protected close(fallback: HTMLElement): void {
    this.selectedId.set(null);
    const focusTarget = this.anchor?.isConnected ? this.anchor : fallback;
    this.anchor = undefined;
    requestAnimationFrame(() => (focusTarget.isConnected ? focusTarget : fallback).focus());
  }

  protected remove(id: string, fallback: HTMLElement): void {
    this.store.remove(id);
    this.close(fallback);
    this.message.set('Widget removed.');
  }

  protected startDrag(
    widget: Widget,
    event: CdkDragStart,
    grid: HTMLElement,
    preview: HTMLElement,
  ): void {
    this.gesture.startDrag(event.source, this.gestureTarget(widget, grid, preview));
  }

  protected endDrag(event: CdkDragEnd): void {
    this.gesture.endDrag(event);
  }

  protected startResize(
    widget: Widget,
    event: PointerEvent,
    grid: HTMLElement,
    preview: HTMLElement,
  ): void {
    this.gesture.startResize(event, this.gestureTarget(widget, grid, preview));
  }

  protected place(id: string, rect: Placement): void {
    const outcome = this.store.place(id, this.view(), rect);
    this.message.set(outcome === 'ok' ? '' : PLACEMENT_ERRORS[outcome]);
  }

  private gestureTarget(widget: Widget, grid: HTMLElement, preview: HTMLElement) {
    const view = this.view();
    return {
      grid,
      preview,
      rect: this.positions()[widget.id],
      limits: limitsFor(widget.type, view),
      occupied: occupiedExcept(this.positions(), widget.id),
      commit: (rect: Placement) => this.place(widget.id, rect),
    };
  }

  protected add(type: WidgetType, catalog: HTMLDialogElement): void {
    if (this.store.add(type) === 'full') {
      this.message.set('There is no room for this widget. Free up space and try again.');
      return;
    }
    this.message.set('');
    if (catalog.open) catalog.close();
  }

  protected reloadSaved(): void {
    if (window.confirm('Load the saved workspace and discard unsaved changes in this tab?')) {
      void this.store.load();
    }
  }

  protected reset(): void {
    this.gesture.cancel();
    if (window.confirm('Reset widget positions and sizes? Your content and theme will be kept.')) {
      const result = this.store.resetLayout();
      this.message.set(
        result === 'ok' ? 'Layout reset.' : 'There is not enough space to reset this layout.',
      );
    }
  }
}
