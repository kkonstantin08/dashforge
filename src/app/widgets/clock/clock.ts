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
import type { Widget } from '../../dashboard/workspace';
import { isTimeZone } from '../widget-values';
import { formatClock, MinuteClock } from './minute-clock';

@Component({
  selector: 'app-clock-widget',
  imports: [ReactiveFormsModule],
  template: `
    @if (settings()) {
      <form class="widget-form" [formGroup]="form" (ngSubmit)="save()">
        <label
          >Time format
          <select formControlName="hourFormat">
            <option value="24">24-hour</option>
            <option value="12">12-hour</option>
          </select>
        </label>
        <label
          >Time zone
          <input
            formControlName="timeZone"
            list="clock-time-zones"
            placeholder="Device time zone"
            autocomplete="off"
            [attr.aria-invalid]="error() ? 'true' : null"
            aria-describedby="clock-zone-error"
          />
        </label>
        <datalist id="clock-time-zones">
          <option value="UTC"></option>
          @for (zone of zones(); track zone) {
            <option [value]="zone"></option>
          }
        </datalist>
        <p id="clock-zone-error" class="widget-error" role="alert">{{ error() }}</p>
        <button type="submit">Save clock settings</button>
      </form>
    } @else {
      <div class="clock">
        <time class="clock-time">{{ display().time }}</time>
        <span class="clock-date">{{ display().date }}</span>
      </div>
    }
  `,
  styles: `
    .clock {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 2px 12px;
    }
    .clock-time {
      font-size: clamp(1.5rem, 9cqi, 3rem);
      font-weight: 600;
      letter-spacing: -0.045em;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .clock-date {
      font-size: 0.875rem;
      color: var(--muted);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClockWidget {
  readonly widget = input.required<Widget<'clock'>>();
  readonly settings = input(false);
  private readonly store = inject(DashboardStore);
  private readonly minutes = inject(MinuteClock);
  private readonly locale = navigator.language;
  private readonly formatter = computed(() => formatClock(this.widget().data, this.locale));

  protected readonly display = computed(() => this.formatter()(this.minutes.time()));
  protected readonly zones = computed(() => Intl.supportedValuesOf('timeZone'));
  protected readonly error = signal('');
  protected readonly form = new FormGroup({
    hourFormat: new FormControl<'12' | '24'>('24', { nonNullable: true }),
    timeZone: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect((onCleanup) => {
      if (!this.settings()) onCleanup(this.minutes.connect());
    });
    effect(() => {
      if (this.settings()) this.form.setValue(this.widget().data);
    });
  }

  protected save(): void {
    const data = this.form.getRawValue();
    data.timeZone = data.timeZone.trim();
    if (!isTimeZone(data.timeZone)) {
      this.error.set('Enter a valid time zone, such as America/Los_Angeles.');
      return;
    }
    this.error.set('');
    this.store.updateWidget({ ...this.widget(), data });
  }
}
