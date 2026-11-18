import { describe, expect, it } from 'vitest';
import { groupBookmarks } from './bookmarks';
import { isBookmarkUrl } from '../widget-values';

describe('Bookmarks', () => {
  it('places groups in first-seen order with a bucket for ungrouped links', () => {
    const base = { url: 'https://example.test', icon: '' };
    const first = { ...base, id: '1', title: 'One', group: 'Work' };
    const second = { ...base, id: '2', title: 'Two', group: '' };
    const third = { ...base, id: '3', title: 'Three', group: 'Work' };
    expect(groupBookmarks([first, second, third])).toEqual([
      ['Work', [first, third]],
      ['', [second]],
    ]);
  });

  it.each(['javascript:alert(1)', '', 'data:text/plain,1', 'https://user:secret@example.test'])(
    'rejects unsafe or invalid URL %s',
    (url) => expect(isBookmarkUrl(url)).toBe(false),
  );
  it('accepts absolute HTTP(S) links', () => {
    expect(isBookmarkUrl('https://example.test/?a=1')).toBe(true);
    expect(isBookmarkUrl('http://example.test')).toBe(true);
  });
});
