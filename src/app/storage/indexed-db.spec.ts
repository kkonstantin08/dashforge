import { describe, expect, it } from 'vitest';
import { createWorkspace } from '../dashboard/workspace';
import { isStoredWorkspace } from './schema';

describe('persisted workspace schema', () => {
  it('accepts a versioned workspace and rejects an unknown version', () => {
    const record = { schemaVersion: 1, revision: 1, workspace: createWorkspace('dark') };
    expect(isStoredWorkspace(record)).toBe(true);
    expect(isStoredWorkspace({ ...record, schemaVersion: 2 })).toBe(false);
  });

  it('accepts appearance metadata in a v1 snapshot and rejects references to unknown fonts', () => {
    const palette = { background: '#F3EEE5', cards: '#FFFDF8', accent: '#98492E' };
    const appearance = {
      palettes: { light: palette, dark: palette },
      headings: 'lora',
      body: 'system',
      imported: [],
      density: 'comfortable',
      radius: 18,
    };
    const workspace = { ...createWorkspace('dark'), appearance };
    const record = { schemaVersion: 1, revision: 1, workspace };
    expect(isStoredWorkspace(record)).toBe(true);
    expect(
      isStoredWorkspace({
        ...record,
        workspace: { ...workspace, appearance: { ...appearance, body: crypto.randomUUID() } },
      }),
    ).toBe(false);
    expect(
      isStoredWorkspace({
        ...record,
        workspace: { ...workspace, appearance: { ...appearance, radius: -18 } },
      }),
    ).toBe(false);
  });

  it('rejects corrupt positions and duplicate identifiers', () => {
    const workspace = createWorkspace('light');
    const [clock, bookmarks] = workspace.widgets;
    expect(
      isStoredWorkspace({
        schemaVersion: 1,
        revision: 1,
        workspace: {
          ...workspace,
          desktop: { ...workspace.desktop, [bookmarks.id]: workspace.desktop[clock.id] },
        },
      }),
    ).toBe(false);
    expect(
      isStoredWorkspace({
        schemaVersion: 1,
        revision: 1,
        workspace: { ...workspace, widgets: [clock, ...workspace.widgets] },
      }),
    ).toBe(false);
  });
});
