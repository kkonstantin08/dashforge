import { describe, expect, it } from 'vitest';
import { placementFromDelta } from './grid-gesture';

const rect = { col: 2, row: 2, width: 4, height: 3 };

describe('grid gesture coordinates', () => {
  it('snaps a move to the nearest column and row, including negative deltas', () => {
    expect(placementFromDelta(rect, 'move', -53, 92, 100, 60)).toEqual({ ...rect, col: 1, row: 4 });
  });

  it('resizes width and height without shifting the top-left corner', () => {
    expect(placementFromDelta(rect, 'resize', 55, -32, 100, 60)).toEqual({
      ...rect,
      width: 5,
      height: 2,
    });
  });
});
