import type { CalendarEvent } from '../../dashboard/workspace';

export function localDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setFullYear(year, month, day);
  date.setHours(12, 0, 0, 0);
  return date;
}

export function dateKey(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return localDate(year, month - 1, day);
}

export function monthDays(year: number, month: number): (string | null)[] {
  const first = localDate(year, month, 1);
  const days = localDate(year, month + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7;
  const size = Math.ceil((leading + days) / 7) * 7;
  return Array.from({ length: size }, (_, index) => {
    const day = index - leading + 1;
    return day >= 1 && day <= days ? dateKey(localDate(year, month, day)) : null;
  });
}

function eventEnd(event: CalendarEvent): number {
  const date = fromDateKey(event.date);
  if (event.time) {
    const [hours, minutes] = event.time.split(':').map(Number);
    date.setHours(hours, minutes + 1, 0, 0);
  } else {
    date.setDate(date.getDate() + 1);
    date.setHours(0, 0, 0, 0);
  }
  return date.getTime();
}

export function upcomingEvents(events: CalendarEvent[], now: Date): CalendarEvent[] {
  return events
    .filter((event) => eventEnd(event) > now.getTime())
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.time ?? '24:00').localeCompare(b.time ?? '24:00') ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 5);
}

export function nextEventRefresh(events: CalendarEvent[], now: Date): number {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return events.reduce((next, event) => {
    const end = eventEnd(event);
    return end > now.getTime() ? Math.min(next, end) : next;
  }, midnight.getTime());
}
