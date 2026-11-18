import {
  GRID,
  limitsFor,
  projectMobile,
  usedRows,
  validatePlacement,
  type Placement,
} from '../dashboard/layout';
import type { View, Widget, Workspace } from '../dashboard/workspace';
import { isBookmarkUrl, isLocalDate, isLocalTime, isTimeZone } from '../widgets/widget-values';

export type StoredWorkspace = { schemaVersion: 1; revision: number; workspace: Workspace };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): value is string {
  return typeof value === 'string';
}

function entries(value: unknown, valid: (item: Record<string, unknown>) => boolean): boolean {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  for (const entry of value) {
    if (
      !isRecord(entry) ||
      !text(entry['id']) ||
      !entry['id'] ||
      ids.has(entry['id']) ||
      !valid(entry)
    )
      return false;
    ids.add(entry['id']);
  }
  return true;
}

function isWidget(value: unknown): value is Widget {
  if (!isRecord(value) || !text(value['id']) || !/^[0-9a-f-]{36}$/i.test(value['id'])) return false;
  const data = value['data'];
  if (!isRecord(data)) return false;

  switch (value['type']) {
    case 'clock':
      return (
        (data['hourFormat'] === '12' || data['hourFormat'] === '24') &&
        text(data['timeZone']) &&
        isTimeZone(data['timeZone'])
      );
    case 'bookmarks':
      return entries(
        data['links'],
        (link) =>
          text(link['title']) &&
          !!link['title'].trim() &&
          text(link['url']) &&
          isBookmarkUrl(link['url']) &&
          text(link['group']) &&
          text(link['icon']),
      );
    case 'notes': {
      const notes = data['notes'];
      const selected = data['activeId'];
      return (
        entries(notes, (note) => text(note['text'])) &&
        (selected === undefined ||
          (Array.isArray(notes) && notes.some((note) => note['id'] === selected)))
      );
    }
    case 'calendar':
      return entries(
        data['events'],
        (event) =>
          text(event['title']) &&
          !!event['title'].trim() &&
          text(event['date']) &&
          isLocalDate(event['date']) &&
          (event['time'] === undefined || (text(event['time']) && isLocalTime(event['time']))),
      );
    default:
      return false;
  }
}

function validLayout(layout: unknown, widgets: Widget[], view: View): boolean {
  if (!isRecord(layout) || Object.keys(layout).length !== widgets.length) return false;
  const occupied: Placement[] = [];
  for (const widget of widgets) {
    const position = layout[widget.id];
    if (!isRecord(position)) return false;
    const { col, row, width, height } = position;
    if (
      typeof col !== 'number' ||
      typeof row !== 'number' ||
      typeof width !== 'number' ||
      typeof height !== 'number'
    )
      return false;
    const rect = { col, row, width, height };
    if (validatePlacement(rect, occupied, limitsFor(widget.type, view)) !== 'ok') return false;
    occupied.push(rect);
  }
  return true;
}

export function isWorkspace(value: unknown): value is Workspace {
  if (!isRecord(value) || (value['theme'] !== 'light' && value['theme'] !== 'dark')) return false;
  const widgets = value['widgets'];
  if (
    !Array.isArray(widgets) ||
    !widgets.every(isWidget) ||
    new Set(widgets.map((widget) => widget.id)).size !== widgets.length
  )
    return false;
  if (!validLayout(value['desktop'], widgets, 'desktop')) return false;
  return value['mobile'] === undefined
    ? usedRows(projectMobile(value as Workspace)) <= GRID.mobile.rows
    : validLayout(value['mobile'], widgets, 'mobile');
}

export function isStoredWorkspace(value: unknown): value is StoredWorkspace {
  return (
    isRecord(value) &&
    value['schemaVersion'] === 1 &&
    typeof value['revision'] === 'number' &&
    Number.isSafeInteger(value['revision']) &&
    value['revision'] > 0 &&
    isWorkspace(value['workspace'])
  );
}
