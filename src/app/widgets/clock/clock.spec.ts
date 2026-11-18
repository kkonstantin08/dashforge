import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatClock, MinuteClock } from './minute-clock';
import { isTimeZone } from '../widget-values';

describe('Clock', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('formats minutes and dates in the requested time zone', () => {
    const time = Date.UTC(2026, 10, 19, 2, 5);
    expect(formatClock({ hourFormat: '24', timeZone: 'UTC' }, 'en-US')(time)).toEqual({
      time: '02:05',
      date: 'Thu, Nov 19',
    });
    expect(
      formatClock({ hourFormat: '12', timeZone: 'America/Los_Angeles' }, 'en-US')(time),
    ).toEqual({
      time: '06:05 PM',
      date: 'Wed, Nov 18',
    });
    expect(isTimeZone('Not/AZone')).toBe(false);
  });

  it('shares one timer and releases it while hidden or unused', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-19T12:00:35Z'));
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const minutes = TestBed.inject(MinuteClock);
    const releaseFirst = minutes.connect();
    const releaseSecond = minutes.connect();
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(25_000);
    expect(new Date(minutes.time()).toISOString()).toBe('2026-11-19T12:01:00.000Z');
    hidden.mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(vi.getTimerCount()).toBe(0);
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(vi.getTimerCount()).toBe(1);
    releaseFirst();
    expect(vi.getTimerCount()).toBe(1);
    releaseSecond();
    expect(vi.getTimerCount()).toBe(0);
  });
});
