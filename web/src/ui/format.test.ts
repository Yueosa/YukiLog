import { describe, expect, it } from 'vitest';
import {
  excerpt,
  formatDate,
  formatDateTime,
  formatMonthDay,
  readingMinutes,
  relTime,
  textFromHtml,
  yearOf,
} from './format.js';

describe('textFromHtml', () => {
  it('strips tags and collapses whitespace', () => {
    expect(textFromHtml('<p>雨停以后，<strong>窗沿</strong>留下了一小段晚霞。</p>')).toBe(
      '雨停以后， 窗沿 留下了一小段晚霞。',
    );
  });

  it('drops script/style content and decodes common entities', () => {
    expect(textFromHtml('<p>a &amp; b</p><script>alert(1)</script>')).toBe('a & b');
    expect(textFromHtml('Tom &lt;3 &#39;night&#39;')).toBe("Tom <3 'night'");
  });
});

describe('excerpt', () => {
  it('keeps short text intact and truncates by code point', () => {
    expect(excerpt('短句', 10)).toBe('短句');
    expect(excerpt('一二三四五六七八九十', 5)).toBe('一二三四…');
  });
});

describe('date formatting', () => {
  it('formats dates in the site style', () => {
    const iso = '2026-10-04T22:17:00+08:00';
    expect(formatDate(iso)).toMatch(/^2026 · 10 · 0[45]$/);
    expect(formatMonthDay(iso)).toMatch(/^10\.0[45]$/);
    expect(yearOf(iso)).toBe('2026');
    expect(formatDateTime(iso)).toContain('/');
  });

  it('passes through unparseable input', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
    expect(formatMonthDay('not-a-date')).toBe('');
  });
});

describe('relTime', () => {
  const now = new Date('2026-10-05T12:00:00+08:00').getTime();

  it('buckets minutes, hours, days and weeks', () => {
    expect(relTime('2026-10-05T11:59:40+08:00', now)).toBe('刚刚');
    expect(relTime('2026-10-05T11:30:00+08:00', now)).toBe('30 分钟前');
    expect(relTime('2026-10-05T00:00:00+08:00', now)).toBe('12 小时前');
    expect(relTime('2026-10-02T12:00:00+08:00', now)).toBe('3 天前');
    expect(relTime('2026-09-28T12:00:00+08:00', now)).toBe('1 周前');
  });

  it('falls back to a full date beyond four weeks', () => {
    expect(relTime('2026-08-01T12:00:00+08:00', now)).toContain('2026 · 08 ·');
  });
});

describe('readingMinutes', () => {
  it('estimates minutes from plain-text length with a floor of one', () => {
    expect(readingMinutes('<p>短</p>')).toBe(1);
    expect(readingMinutes(`<p>${'字'.repeat(900)}</p>`)).toBe(2);
  });
});
