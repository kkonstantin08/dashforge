import type { Appearance } from '../appearance/appearance';
import { WIDGETS, WIDGET_TYPES } from '../widgets/widget-registry';
import type { Positions } from './layout';

export type Theme = 'light' | 'dark';
export type View = 'desktop' | 'mobile';
export type Bookmark = { id: string; title: string; url: string; group: string; icon: string };
export type Note = { id: string; text: string };
export type CalendarEvent = { id: string; title: string; date: string; time?: string };

export interface WidgetData {
  clock: { hourFormat: '12' | '24'; timeZone: string };
  bookmarks: { links: Bookmark[] };
  notes: { notes: Note[]; activeId?: string };
  calendar: { events: CalendarEvent[] };
}

export type WidgetType = keyof WidgetData;
export type Widget<K extends WidgetType = WidgetType> = {
  [T in K]: { id: string; type: T; data: WidgetData[T] };
}[K];
export type Workspace = {
  theme: Theme;
  widgets: Widget[];
  desktop: Positions;
  mobile?: Positions;
  appearance?: Appearance;
};

export function createWidget(type: WidgetType): Widget {
  const id = crypto.randomUUID();
  switch (type) {
    case 'clock':
      return { id, type, data: { hourFormat: '24', timeZone: '' } };
    case 'bookmarks':
      return { id, type, data: { links: [] } };
    case 'notes':
      return { id, type, data: { notes: [] } };
    case 'calendar':
      return { id, type, data: { events: [] } };
  }
}

export function createWorkspace(theme: Theme): Workspace {
  const widgets = WIDGET_TYPES.map(createWidget);
  return {
    theme,
    widgets,
    desktop: Object.fromEntries(widgets.map(({ id, type }) => [id, WIDGETS[type].start])),
  };
}
