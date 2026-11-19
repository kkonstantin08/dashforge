import { WIDGETS } from '../widgets/widget-registry';
import type { View, WidgetType, Workspace } from './workspace';

export type Placement = { col: number; row: number; width: number; height: number };
export type Size = Pick<Placement, 'width' | 'height'>;
export type Bounds = { columns: number; rows: number };
export type Limits = Bounds & { minWidth: number; minHeight: number };
export type PlacementResult = 'ok' | 'bounds' | 'size' | 'collision';
export type Positions = Record<string, Placement>;

export const GRID: Record<View, Bounds> = {
  desktop: { columns: 12, rows: 200 },
  mobile: { columns: 4, rows: 200 },
};

export function limitsFor(type: WidgetType, view: View): Limits {
  const { minimum, mobileMinimumWidth } = WIDGETS[type];
  return {
    ...GRID[view],
    minWidth: view === 'mobile' ? mobileMinimumWidth : minimum.width,
    minHeight: minimum.height,
  };
}

function overlaps(a: Placement, b: Placement): boolean {
  return (
    a.col < b.col + b.width &&
    b.col < a.col + a.width &&
    a.row < b.row + b.height &&
    b.row < a.row + a.height
  );
}

export function validatePlacement(
  candidate: Placement,
  occupied: Placement[],
  limits: Limits,
): PlacementResult {
  const { col, row, width, height } = candidate;
  if (
    ![col, row, width, height].every(Number.isSafeInteger) ||
    col < 0 ||
    row < 0 ||
    col + width > limits.columns ||
    row + height > limits.rows
  )
    return 'bounds';
  if (width < limits.minWidth || height < limits.minHeight) return 'size';
  return occupied.some((placement) => overlaps(candidate, placement)) ? 'collision' : 'ok';
}

export function firstFree(size: Size, occupied: Placement[], bounds: Bounds): Placement | null {
  const { width, height } = size;
  for (let row = 0; row <= bounds.rows - height; row++) {
    for (let col = 0; col <= bounds.columns - width; col++) {
      const candidate = { col, row, width, height };
      if (!occupied.some((placement) => overlaps(candidate, placement))) return candidate;
    }
  }
  return null;
}

export function occupiedExcept(positions: Positions, id: string): Placement[] {
  return Object.entries(positions)
    .filter(([key]) => key !== id)
    .map(([, rect]) => rect);
}

export function projectMobile(workspace: Workspace): Positions {
  const ordered = [...workspace.widgets].sort((a, b) => {
    const left = workspace.desktop[a.id];
    const right = workspace.desktop[b.id];
    return left.row - right.row || left.col - right.col;
  });
  const result: Positions = {};
  let row = 0;
  for (const { id, type } of ordered) {
    const { start, minimum } = WIDGETS[type];
    const height = Math.max(start.height, minimum.height);
    result[id] = { col: 0, row, width: GRID.mobile.columns, height };
    row += height;
  }
  return result;
}

export function usedRows(positions: Positions): number {
  return Object.values(positions).reduce((rows, rect) => Math.max(rows, rect.row + rect.height), 0);
}

export function resetLayout(workspace: Workspace): Workspace | null {
  const desktop: Positions = {};
  const seen = new Set<WidgetType>();
  for (const { id, type } of workspace.widgets) {
    if (!seen.has(type)) {
      seen.add(type);
      desktop[id] = WIDGETS[type].start;
    }
  }
  for (const { id, type } of workspace.widgets) {
    if (desktop[id]) continue;
    const target = firstFree(WIDGETS[type].start, Object.values(desktop), GRID.desktop);
    if (!target) return null;
    desktop[id] = target;
  }
  const reset = { ...workspace, desktop, mobile: undefined };
  return usedRows(projectMobile(reset)) <= GRID.mobile.rows ? reset : null;
}
