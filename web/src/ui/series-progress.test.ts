import { describe, expect, it } from 'vitest';
import {
  SERIES_READ_KEY,
  countReadChapters,
  loadSeriesRead,
  markChapterRead,
  nextUnreadIndex,
  persistSeriesRead,
  type SeriesReadMap,
} from './series-progress.js';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    dump: () => Object.fromEntries(data),
  };
}

describe('series-progress', () => {
  it('returns an empty map when storage is missing or empty', () => {
    expect(loadSeriesRead(null)).toEqual({});
    expect(loadSeriesRead(fakeStorage())).toEqual({});
  });

  it('tolerates corrupt payloads and filters non-string entries', () => {
    expect(loadSeriesRead(fakeStorage({ [SERIES_READ_KEY]: '{oops' }))).toEqual({});
    expect(loadSeriesRead(fakeStorage({ [SERIES_READ_KEY]: '[1,2]' }))).toEqual({});
    const storage = fakeStorage({
      [SERIES_READ_KEY]: JSON.stringify({
        shells: ['a', 'a', 1, 'b'],
        empty: [],
        bad: 'nope',
      }),
    });
    expect(loadSeriesRead(storage)).toEqual({ shells: ['a', 'b'] });
  });

  it('persist + load round-trips', () => {
    const storage = fakeStorage();
    const map: SeriesReadMap = { shells: ['c0', 'c1'] };
    persistSeriesRead(map, storage);
    expect(loadSeriesRead(storage)).toEqual(map);
  });

  it('markChapterRead appends once and keeps immutability', () => {
    const base: SeriesReadMap = { shells: ['c0'] };
    const next = markChapterRead(base, 'shells', 'c1');
    expect(next).toEqual({ shells: ['c0', 'c1'] });
    expect(base).toEqual({ shells: ['c0'] });
    expect(markChapterRead(next, 'shells', 'c1')).toBe(next);
    expect(markChapterRead({}, 'other', 'x')).toEqual({ other: ['x'] });
  });

  it('counts only chapters still present in the series', () => {
    const map: SeriesReadMap = { shells: ['c0', 'c1', 'withdrawn'] };
    expect(countReadChapters(map, 'shells', ['c0', 'c1', 'c2'])).toBe(2);
    expect(countReadChapters(map, 'ghost', ['c0'])).toBe(0);
  });

  it('finds the first unread chapter for continue-reading', () => {
    const chapters = ['c0', 'c1', 'c2', 'c3'];
    expect(nextUnreadIndex(chapters, [])).toBe(0);
    expect(nextUnreadIndex(chapters, ['c0', 'c2'])).toBe(1);
    expect(nextUnreadIndex(chapters, chapters)).toBe(-1);
    expect(nextUnreadIndex([], [])).toBe(-1);
  });
});
