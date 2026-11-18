import { Injectable, signal } from '@angular/core';
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
  type View,
  type WidgetType,
  type Workspace,
} from './workspace';

@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly model = signal(createWorkspace('light'));
  readonly workspace = this.model.asReadonly();

  restore(workspace: Workspace): void {
    this.model.set(workspace);
  }

  add(type: WidgetType): 'ok' | 'full' {
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

    this.model.set(next);
    return 'ok';
  }

  place(id: string, view: View, rect: Placement): PlacementResult {
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
    this.model.set({ ...current, [view]: { ...positions, [id]: rect } });
    return 'ok';
  }

  remove(id: string): void {
    const current = this.model();
    const widgets = current.widgets.filter((item) => item.id !== id);
    if (widgets.length === current.widgets.length) return;
    const without = (positions: Positions) =>
      Object.fromEntries(Object.entries(positions).filter(([key]) => key !== id));
    this.model.set({
      ...current,
      widgets,
      desktop: without(current.desktop),
      mobile: current.mobile && without(current.mobile),
    });
  }

  resetLayout(): 'ok' | 'full' {
    const next = resetLayout(this.model());
    if (!next) return 'full';
    this.model.set(next);
    return 'ok';
  }
}
