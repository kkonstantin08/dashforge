import { describe, expect, it } from 'vitest';
import { firstFree, projectMobile, resetLayout, validatePlacement, type Placement } from './layout';
import { createWorkspace } from './workspace';

const limits = { columns: 12, rows: 200, minWidth: 2, minHeight: 2 };
const tile: Placement = { col: 0, row: 0, width: 2, height: 2 };

describe('workspace layout', () => {
  it('allows touching edges without an overlap', () => {
    expect(validatePlacement({ ...tile, col: 2 }, [tile], limits)).toBe('ok');
    expect(validatePlacement({ ...tile, col: 10, row: 198 }, [], limits)).toBe('ok');
  });

  it.each([
    [{ ...tile, col: 1 }, 'collision'],
    [{ ...tile, col: -1 }, 'bounds'],
    [{ ...tile, col: 11 }, 'bounds'],
    [{ ...tile, row: 199 }, 'bounds'],
    [{ ...tile, row: 1.5 }, 'bounds'],
    [{ ...tile, width: 1 }, 'size'],
  ])('rejects an invalid placement %o', (candidate, expected) => {
    expect(validatePlacement(candidate, [tile], limits)).toBe(expected);
  });

  it('finds the first free rectangle in row order', () => {
    expect(firstFree(tile, [tile], { columns: 4, rows: 2 })).toEqual({ ...tile, col: 2 });
    expect(firstFree(tile, [tile], { columns: 2, rows: 2 })).toBeNull();
  });

  it('projects all widgets into a single column in desktop reading order', () => {
    const workspace = createWorkspace('light');
    const [clock, bookmarks, notes, calendar] = workspace.widgets;
    expect(projectMobile(workspace)).toEqual({
      [clock.id]: { col: 0, row: 0, width: 4, height: 2 },
      [calendar.id]: { col: 0, row: 2, width: 4, height: 8 },
      [bookmarks.id]: { col: 0, row: 10, width: 4, height: 3 },
      [notes.id]: { col: 0, row: 13, width: 4, height: 3 },
    });
  });

  it('resets coordinates while retaining widget models and theme', () => {
    const original = createWorkspace('dark');
    const clock = original.widgets[0];
    const workspace = {
      ...original,
      desktop: { ...original.desktop, [clock.id]: { ...tile, row: 12 } },
      mobile: {},
    };
    const result = resetLayout(workspace);
    expect(result?.desktop).toEqual(original.desktop);
    expect(result?.mobile).toBeUndefined();
    expect(result?.widgets).toBe(original.widgets);
    expect(result?.theme).toBe('dark');
  });
});
