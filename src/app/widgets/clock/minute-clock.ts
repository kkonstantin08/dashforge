import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import type { WidgetData } from '../../dashboard/workspace';

export function formatClock(options: WidgetData['clock'], locale: string) {
  const zone = options.timeZone || undefined;
  const time = new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: options.hourFormat === '24' ? 'h23' : 'h12',
  });
  const date = new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return (epoch: number) => ({ time: time.format(epoch), date: date.format(epoch) });
}

@Injectable({ providedIn: 'root' })
export class MinuteClock {
  private readonly document = inject(DOCUMENT);
  private readonly now = signal(Date.now());
  private clients = 0;
  private pending?: ReturnType<typeof setTimeout>;

  readonly time = this.now.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  connect(): () => void {
    if (++this.clients === 1) {
      this.document.addEventListener('visibilitychange', this.refresh);
      this.refresh();
    }
    return () => {
      if (--this.clients === 0) this.stop();
    };
  }

  private readonly refresh = () => {
    clearTimeout(this.pending);
    if (this.document.hidden) return;
    const now = Date.now();
    this.now.set(now);
    this.pending = setTimeout(this.refresh, 60_000 - (now % 60_000));
  };

  private stop(): void {
    clearTimeout(this.pending);
    this.document.removeEventListener('visibilitychange', this.refresh);
  }
}
