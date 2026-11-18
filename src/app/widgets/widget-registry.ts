import type { Placement, Size } from '../dashboard/layout';
import type { WidgetType } from '../dashboard/workspace';

interface WidgetDefinition {
  title: string;
  description: string;
  start: Placement;
  minimum: Size;
  mobileMinimumWidth: number;
}

export const WIDGETS = {
  clock: {
    title: 'Clock',
    description: 'Time and date, in any time zone.',
    start: { col: 0, row: 0, width: 4, height: 2 },
    minimum: { width: 2, height: 2 },
    mobileMinimumWidth: 2,
  },
  bookmarks: {
    title: 'Bookmarks',
    description: 'Keep useful links together.',
    start: { col: 0, row: 2, width: 5, height: 3 },
    minimum: { width: 3, height: 3 },
    mobileMinimumWidth: 3,
  },
  notes: {
    title: 'Notes',
    description: 'Make a quick note or keep a list.',
    start: { col: 0, row: 5, width: 5, height: 3 },
    minimum: { width: 3, height: 3 },
    mobileMinimumWidth: 3,
  },
  calendar: {
    title: 'Calendar',
    description: 'See dates and upcoming local events.',
    start: { col: 5, row: 0, width: 7, height: 8 },
    minimum: { width: 5, height: 5 },
    mobileMinimumWidth: 4,
  },
} satisfies Record<WidgetType, WidgetDefinition>;

export const WIDGET_TYPES = Object.keys(WIDGETS) as WidgetType[];

export const WIDGET_LOADERS: Partial<
  Record<WidgetType, () => Promise<import('@angular/core').Type<unknown>>>
> = {
  clock: () => import('./clock/clock').then(({ ClockWidget }) => ClockWidget),
  bookmarks: () => import('./bookmarks/bookmarks').then(({ BookmarksWidget }) => BookmarksWidget),
  notes: () => import('./notes/notes').then(({ NotesWidget }) => NotesWidget),
};
