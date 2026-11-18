import { DOCUMENT } from '@angular/common';
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
import type { CalendarEvent, Widget } from '../../dashboard/workspace';
import { isLocalDate, isLocalTime } from '../widget-values';
import {
  dateKey,
  fromDateKey,
  localDate,
  monthDays,
  nextEventRefresh,
  upcomingEvents,
} from './calendar-dates';

@Component({
  selector: 'app-calendar-widget',
  imports: [ReactiveFormsModule],
  templateUrl: './calendar.html',
  styleUrl: './calendar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarWidget {
  readonly widget = input.required<Widget<'calendar'>>();
  readonly settings = input(false);
  private readonly store = inject(DashboardStore);
  private readonly document = inject(DOCUMENT);
  private readonly monthFormat = new Intl.DateTimeFormat(navigator.language, {
    month: 'long',
    year: 'numeric',
  });
  private readonly dayFormat = new Intl.DateTimeFormat(navigator.language, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  private readonly now = signal(Date.now());
  private readonly visible = signal(!this.document.hidden);
  private readonly month = signal(new Date());
  private readonly widgetId = computed(() => this.widget().id);
  protected readonly shown = computed(() => this.monthFormat.format(this.month()));
  protected readonly days = computed(() =>
    monthDays(this.month().getFullYear(), this.month().getMonth()),
  );
  protected readonly today = computed(() => dateKey(new Date(this.now())));
  protected readonly selected = signal(this.today());
  protected readonly selectedLabel = computed(() =>
    this.dayFormat.format(fromDateKey(this.selected())),
  );
  protected readonly events = computed(() => this.widget().data.events);
  protected readonly dayEvents = computed(() =>
    this.events()
      .filter((event) => event.date === this.selected())
      .sort((a, b) => (a.time ?? '24:00').localeCompare(b.time ?? '24:00')),
  );
  protected readonly upcoming = computed(() => upcomingEvents(this.events(), new Date(this.now())));
  protected readonly weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  protected readonly editing = signal<string | null>(null);
  protected readonly error = signal('');
  protected readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true }),
    date: new FormControl('', { nonNullable: true }),
    time: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      this.widgetId();
      this.cancel();
    });
    effect((onCleanup) => {
      if (this.settings()) return;
      const listener = () => {
        this.visible.set(!this.document.hidden);
        if (!this.document.hidden) this.now.set(Date.now());
      };
      this.document.addEventListener('visibilitychange', listener);
      onCleanup(() => this.document.removeEventListener('visibilitychange', listener));
    });
    effect((onCleanup) => {
      if (this.settings() || !this.visible()) return;
      const next = nextEventRefresh(this.events(), new Date(this.now()));
      const timer = setTimeout(() => this.now.set(Date.now()), Math.max(1, next - Date.now()));
      onCleanup(() => clearTimeout(timer));
    });
  }

  protected shiftMonth(offset: number): void {
    const current = this.month();
    const next = localDate(current.getFullYear(), current.getMonth() + offset, 1);
    this.month.set(next);
    this.choose(dateKey(next));
  }

  protected choose(day: string): void {
    this.selected.set(day);
    this.cancel();
  }

  protected begin(event?: CalendarEvent): void {
    this.form.setValue({
      title: event?.title ?? '',
      date: event?.date ?? this.selected(),
      time: event?.time ?? '',
    });
    this.error.set('');
    this.editing.set(event?.id ?? '');
  }

  protected cancel(): void {
    this.editing.set(null);
    this.error.set('');
  }

  protected save(): void {
    const { title, date, time } = this.form.getRawValue();
    if (!title.trim() || !isLocalDate(date) || (time && !isLocalTime(time))) {
      this.error.set('Enter a title, a valid date and an optional time.');
      return;
    }
    const widget = this.store.getWidget(this.widget().id, 'calendar');
    if (!widget) return;
    const existing = this.editing();
    const event: CalendarEvent = {
      id: existing || crypto.randomUUID(),
      title: title.trim(),
      date,
      time: time || undefined,
    };
    const events = existing
      ? widget.data.events.map((item) => (item.id === existing ? event : item))
      : [...widget.data.events, event];
    this.store.updateWidget({ ...widget, data: { events } });
    this.month.set(fromDateKey(date));
    this.choose(date);
  }

  protected remove(id: string): void {
    const widget = this.store.getWidget(this.widget().id, 'calendar');
    if (!widget) return;
    this.store.updateWidget({
      ...widget,
      data: { events: widget.data.events.filter((event) => event.id !== id) },
    });
    if (this.editing() === id) this.cancel();
  }

  protected eventDate(event: CalendarEvent): string {
    return this.dayFormat.format(fromDateKey(event.date)) + (event.time ? ' · ' + event.time : '');
  }
}
