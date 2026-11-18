import { describe, expect, it } from 'vitest';
import { createWorkspace } from '../dashboard/workspace';
import { isStoredWorkspace } from './schema';

describe('persisted workspace schema', () => {
  it('accepts a versioned workspace and rejects an unknown version', () => {
    const record = { schemaVersion: 1, revision: 1, workspace: createWorkspace('dark') };
    expect(isStoredWorkspace(record)).toBe(true);
    expect(isStoredWorkspace({ ...record, schemaVersion: 2 })).toBe(false);
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
