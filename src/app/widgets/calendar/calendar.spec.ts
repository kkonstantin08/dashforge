import { describe, expect, it } from 'vitest';
import { monthDays, upcomingEvents, nextEventRefresh } from './calendar-dates';
import { isLocalDate } from '../widget-values';

describe('Calendar', () => {
  it('returns leap-day dates and follows local month boundaries', () => {
    expect(monthDays(2028, 1).filter(Boolean)).toHaveLength(29);
    expect(monthDays(2028, 1)).toContain('2028-02-29');
    expect(monthDays(2027, 1)).not.toContain('2027-02-29');
    expect(monthDays(2027, 12)).toContain('2028-01-01');
    expect(isLocalDate('2027-02-29')).toBe(false);
  });

  it('sorts and limits upcoming events, retaining untimed events today', () => {
    const now = new Date(2026, 10, 19, 12, 30, 0);
    const date = '2026-11-19';
    const events = [
      { id: 'gone', title: 'Gone', date, time: '12:29' },
      { id: 'untimed', title: 'Today', date },
      { id: 'later', title: 'Later', date, time: '14:00' },
      { id: 'now', title: 'Now', date, time: '12:30' },
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `future-${i}`,
        title: 'Future',
        date: '2026-11-20',
      })),
    ];
    expect(upcomingEvents(events, now).map(({ id }) => id)).toEqual([
      'now',
      'later',
      'untimed',
      'future-0',
      'future-1',
    ]);
    expect(nextEventRefresh(events, now)).toBe(new Date(2026, 10, 19, 12, 31).getTime());
  });
});
