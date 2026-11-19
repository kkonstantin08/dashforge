import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_APPEARANCE } from '../appearance/appearance';
import { IndexedDbWorkspace, RevisionConflict } from '../storage/indexed-db';
import { DashboardStore } from './dashboard-store';
import { createWorkspace, type Workspace } from './workspace';

function setup(read = vi.fn().mockResolvedValue(null), write = vi.fn().mockResolvedValue(1)) {
  TestBed.configureTestingModule({
    providers: [{ provide: IndexedDbWorkspace, useValue: { read, write } }],
  });
  return { store: TestBed.inject(DashboardStore), read, write };
}

describe('workspace persistence', () => {
  afterEach(() => vi.useRealTimers());

  it('retries the appearance snapshot with its font and retains it after layout reset', async () => {
    const { store, write } = setup();
    write.mockRejectedValueOnce(new Error('Quota exceeded'));
    await store.load();
    const id = crypto.randomUUID();
    const blob = new Blob(['test asset']);
    const palette = { background: '#F3EEE5', cards: '#FFFDF8', accent: '#98492E' };
    const appearance = {
      palettes: { light: palette, dark: palette },
      headings: id,
      body: 'system',
      imported: [{ id, name: 'Local font' }],
      density: 'compact' as const,
      radius: 20,
    };
    store.applyAppearance('dark', appearance, new Map([[id, blob]]));
    await vi.waitFor(() => expect(store.saveState()).toBe('write-error'));
    await store.retrySave();
    expect(write.mock.lastCall).toEqual([
      expect.objectContaining({ theme: 'dark', appearance }),
      0,
      { additions: [[id, blob]], removed: [] },
    ]);
    expect(store.resetLayout()).toBe('ok');
    expect(store.workspace().appearance).toBe(appearance);
    expect(write.mock.lastCall).toHaveLength(2);
  });

  it('retains the newest whole snapshot when a write fails', async () => {
    let rejectWrite!: (reason: Error) => void;
    const firstWrite = new Promise<number>((_, reject) => {
      rejectWrite = reject;
    });
    const write = vi
      .fn<(workspace: Workspace, revision: number) => Promise<number>>()
      .mockReturnValueOnce(firstWrite)
      .mockResolvedValue(1);
    const { store } = setup(undefined, write);
    await store.load();
    store.applyAppearance('dark', DEFAULT_APPEARANCE, new Map());
    const clock = store.workspace().widgets.find((widget) => widget.type === 'clock')!;
    store.place(clock.id, 'desktop', { col: 0, row: 10, width: 4, height: 2 });
    expect(store.saveState()).toBe('saving');
    rejectWrite(new Error('Quota exceeded'));
    await vi.waitFor(() => expect(store.saveState()).toBe('write-error'));
    expect(store.workspace().desktop[clock.id].row).toBe(10);
    await store.retrySave();
    expect(store.saveState()).toBe('saved');
    expect(write.mock.calls.at(-1)?.[0]).toMatchObject({
      theme: 'dark',
      desktop: { [clock.id]: { row: 10 } },
    });
  });

  it('leaves the local model available on a revision conflict', async () => {
    const saved = createWorkspace('light');
    const read = vi.fn().mockResolvedValue({ revision: 7, workspace: saved });
    const write = vi.fn().mockRejectedValue(new RevisionConflict());
    const { store } = setup(read, write);
    await store.load();
    store.applyAppearance('dark', DEFAULT_APPEARANCE, new Map());
    await vi.waitFor(() => expect(store.saveState()).toBe('conflict'));
    expect(store.workspace().theme).toBe('dark');
    await store.retrySave();
    expect(store.saveState()).toBe('conflict');
    expect(store.workspace().theme).toBe('dark');
    await store.load();
    expect(store.workspace().theme).toBe('light');
  });

  it('blocks edits when reading failed', async () => {
    const { store, write } = setup(vi.fn().mockRejectedValue(new Error('Unreadable')));
    await store.load();
    store.applyAppearance('dark', DEFAULT_APPEARANCE, new Map());
    expect(store.saveState()).toBe('read-error');
    expect(write).not.toHaveBeenCalled();
  });

  it('debounces repeated keystrokes and flushes on request', async () => {
    vi.useFakeTimers();
    const { store, write } = setup();
    await store.load();
    const notes = store.workspace().widgets.find((widget) => widget.type === 'notes')!;
    const note = { id: crypto.randomUUID(), text: 'a' };
    store.updateWidget({ ...notes, data: { notes: [note], activeId: note.id } }, true);
    await vi.advanceTimersByTimeAsync(249);
    expect(write).not.toHaveBeenCalled();
    store.updateWidget(
      { ...notes, data: { notes: [{ ...note, text: 'ab' }], activeId: note.id } },
      true,
    );
    await store.flush();
    expect(write).toHaveBeenCalledTimes(1);
    expect(
      write.mock.calls[0][0].widgets.find((widget: { id: string }) => widget.id === notes.id).data
        .notes[0].text,
    ).toBe('ab');
    await vi.advanceTimersByTimeAsync(250);
    expect(write).toHaveBeenCalledTimes(1);
    expect(store.saveState()).toBe('saved');
  });
});
