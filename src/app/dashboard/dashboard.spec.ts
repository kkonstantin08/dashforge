import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexedDbWorkspace } from '../storage/indexed-db';
import { Dashboard } from './dashboard';
import { DashboardStore } from './dashboard-store';
import { createWorkspace } from './workspace';

describe('Dashboard widget lifecycle', () => {
  const read = vi.fn().mockResolvedValue(null);
  beforeEach(() => {
    read.mockResolvedValue(null);
    TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        { provide: IndexedDbWorkspace, useValue: { read, write: vi.fn().mockResolvedValue(1) } },
      ],
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('adds a second instance and removes only the selected widget', async () => {
    const fixture = TestBed.createComponent(Dashboard);
    const store = TestBed.inject(DashboardStore);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('[data-widget-id]')).toHaveLength(4);
    root.querySelector<HTMLButtonElement>('[data-add="notes"]')?.click();
    await fixture.whenStable();
    const notes = store.workspace().widgets.filter((widget) => widget.type === 'notes');
    expect(notes).toHaveLength(2);
    expect(notes[0].id).not.toBe(notes[1].id);
    store.remove(notes[1].id);
    await fixture.whenStable();
    expect(root.querySelectorAll('[data-widget-id]')).toHaveLength(4);
    expect(store.workspace().widgets).toContain(notes[0]);
  });

  it('creates an independent mobile layout on the first edit', () => {
    const store = TestBed.inject(DashboardStore);
    const clock = store.workspace().widgets[0].id;
    const desktop = store.workspace().desktop[clock];
    expect(store.place(clock, 'mobile', { col: 0, row: 0, width: 2, height: 2 })).toBe('ok');
    expect(store.workspace().desktop[clock]).toEqual(desktop);
    expect(store.workspace().mobile?.[clock]).toEqual({ col: 0, row: 0, width: 2, height: 2 });
    store.remove(clock);
    expect(store.workspace().mobile?.[clock]).toBeUndefined();
    expect(store.workspace().desktop[clock]).toBeUndefined();
  });

  it('rejects adding when the customized mobile grid has no room', async () => {
    const workspace = createWorkspace('light');
    const ids = workspace.widgets.map((widget) => widget.id);
    const initial = {
      ...workspace,
      mobile: Object.fromEntries(
        ids.map((id, index) => [id, { col: 0, row: index * 50, width: 4, height: 50 }]),
      ),
    };
    const store = TestBed.inject(DashboardStore);
    read.mockResolvedValue({ schemaVersion: 1, revision: 1, workspace: initial });
    await store.load();
    expect(store.add('clock')).toBe('full');
    expect(store.workspace()).toBe(initial);
  });
});
