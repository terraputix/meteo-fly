import { resetLocalTimeZone } from '@internationalized/date';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addDays, addSeconds } from '#lib/utils/dateExtensions.js';
import { fmtTime, formatTimeZone } from '#lib/helpers.js';

afterEach(() => {
  vi.unstubAllEnvs();
  resetLocalTimeZone();
});

describe('DST transitions', () => {
  it.each([
    ['2026-03-29T00:30:00Z', '2026-03-29T01:30:00Z'],
    ['2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z'],
    ['2026-10-25T01:30:00Z', '2026-10-25T02:30:00Z'],
  ])('adds elapsed seconds across %s', (start, end) => {
    vi.stubEnv('TZ', 'Europe/Berlin');
    resetLocalTimeZone();
    const date = new Date(start);
    expect(addSeconds(date, 3600).toISOString()).toBe(new Date(end).toISOString());
    expect(date.toISOString()).toBe(new Date(start).toISOString());
    expect(addSeconds(new Date(end), -3600).toISOString()).toBe(new Date(start).toISOString());
  });

  it.each([
    ['2026-03-28T11:00:00Z', '2026-03-29T10:00:00Z'],
    ['2026-10-24T10:00:00Z', '2026-10-25T11:00:00Z'],
  ])('adds calendar days in the forecast timezone across %s', (start, end) => {
    vi.stubEnv('TZ', 'America/Los_Angeles');
    resetLocalTimeZone();
    expect(addDays(new Date(start), 1, 'Europe/Berlin').toISOString()).toBe(new Date(end).toISOString());
    expect(addDays(new Date(end), -1, 'Europe/Berlin').toISOString()).toBe(new Date(start).toISOString());
  });

  it('keeps consecutive forecast dates distinct across the autumn transition', () => {
    const now = new Date('2026-10-22T15:00:00Z');
    const format = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', weekday: 'long' });
    expect(format.format(addDays(now, 3, 'Europe/Berlin'))).toBe('Sunday');
    expect(format.format(addDays(now, 4, 'Europe/Berlin'))).toBe('Monday');
  });

  it('skips the missing spring hour and distinguishes repeated autumn hours', () => {
    expect(fmtTime(new Date('2026-03-29T00:00Z'), 'Europe/Berlin')).toBe('01:00');
    expect(fmtTime(new Date('2026-03-29T01:00Z'), 'Europe/Berlin')).toBe('03:00');
    expect(fmtTime(new Date('2026-10-25T00:00Z'), 'Europe/Berlin', true)).toBe('02:00 GMT+2');
    expect(fmtTime(new Date('2026-10-25T01:00Z'), 'Europe/Berlin', true)).toBe('02:00 GMT+1');
    expect(formatTimeZone(new Date('2026-10-25T00:00Z'), 'Europe/Berlin')).toBe('GMT+2');
    expect(formatTimeZone(new Date('2026-10-25T01:00Z'), 'Europe/Berlin')).toBe('GMT+1');
  });
});
