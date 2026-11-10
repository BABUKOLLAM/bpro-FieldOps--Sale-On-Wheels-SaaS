import {
  MAX_SPAN_DAYS,
  PRESET_ORDER,
  addDays,
  formatDay,
  formatIstDateTime,
  isIsoDate,
  matchPreset,
  presetRange,
  spanDays,
  todayInIndia,
  validateRange,
} from '../src/history/dateRange';

describe('todayInIndia', () => {
  it('uses the India day, not UTC or the phone zone', () => {
    // 2026-11-09 18:29:59 UTC = 23:59:59 IST on the 9th
    expect(todayInIndia(new Date(Date.UTC(2026, 10, 9, 18, 29, 59)))).toBe(
      '2026-11-09'
    );
    // 18:30 UTC = 00:00 IST on the 10th
    expect(todayInIndia(new Date(Date.UTC(2026, 10, 9, 18, 30)))).toBe(
      '2026-11-10'
    );
  });
});

describe('presets (2026-11-09 is a Monday)', () => {
  const today = '2026-11-09';
  it.each([
    ['today', '2026-11-09', '2026-11-09'],
    ['yesterday', '2026-11-08', '2026-11-08'],
    ['this_week', '2026-11-09', '2026-11-09'],
    ['last_7', '2026-11-03', '2026-11-09'],
    ['mtd', '2026-11-01', '2026-11-09'],
    ['last_month', '2026-10-01', '2026-10-31'],
    ['last_30', '2026-10-11', '2026-11-09'],
  ] as const)('%s', (key, from, to) => {
    expect(presetRange(key, today)).toEqual({ from, to });
  });

  it('this week runs Monday to today (Sunday case)', () => {
    expect(presetRange('this_week', '2026-11-15')).toEqual({
      from: '2026-11-09',
      to: '2026-11-15',
    });
  });

  it('last month across a year boundary and a leap February', () => {
    expect(presetRange('last_month', '2026-01-15')).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
    expect(presetRange('last_month', '2028-03-10')).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    });
  });

  it('every preset is valid for the backend', () => {
    for (const d of ['2026-11-09', '2027-01-01', '2028-02-29']) {
      for (const key of PRESET_ORDER) {
        expect(validateRange(presetRange(key, d))).toBeNull();
      }
    }
  });

  it('matchPreset recognises a preset range', () => {
    expect(matchPreset({ from: '2026-11-01', to: '2026-11-09' }, today)).toBe(
      'mtd'
    );
    expect(
      matchPreset({ from: '2026-11-02', to: '2026-11-04' }, today)
    ).toBeNull();
  });
});

describe('validation mirrors the backend', () => {
  it('strict YYYY-MM-DD real dates', () => {
    expect(isIsoDate('2026-11-09')).toBe(true);
    for (const bad of [
      '2026-2-01',
      '09/11/2026',
      '2026-02-30',
      '',
      '2026-13-01',
    ]) {
      expect(isIsoDate(bad)).toBe(false);
    }
  });

  it('errors', () => {
    expect(validateRange({ from: '2026-11-31', to: '2026-12-01' })).toBe(
      'invalid_from'
    );
    expect(validateRange({ from: '2026-11-01', to: '9999-12-31' })).toBe(
      'invalid_to'
    );
    expect(validateRange({ from: '1999-12-31', to: '2000-01-01' })).toBe(
      'invalid_from'
    );
    expect(validateRange({ from: '2026-11-10', to: '2026-11-09' })).toBe(
      'from_after_to'
    );
    expect(validateRange({ from: '2026-04-01', to: '2027-04-01' })).toBeNull();
    expect(validateRange({ from: '2026-04-01', to: '2027-04-02' })).toBe(
      'too_long'
    );
    expect(MAX_SPAN_DAYS).toBe(366);
  });

  it('inclusive span and day arithmetic', () => {
    expect(spanDays('2026-11-09', '2026-11-09')).toBe(1);
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('formatting', () => {
  it('formats days and IST timestamps', () => {
    expect(formatDay('2026-11-09')).toBe('9 Nov 2026');
    expect(formatIstDateTime('2026-11-09T18:29:00Z')).toBe('9 Nov 2026, 23:59');
    expect(formatIstDateTime('2026-11-09T23:59:00+05:30')).toBe(
      '9 Nov 2026, 23:59'
    );
  });
});

describe('robust formatting', () => {
  it('missing or malformed values render as —', () => {
    expect(formatDay(undefined)).toBe('—');
    expect(formatDay(null)).toBe('—');
    expect(formatDay('2026-02-30')).toBe('—');
    expect(formatIstDateTime(null)).toBe('—');
    expect(formatIstDateTime('not a date')).toBe('—');
  });

  it('uses locale month names when given', () => {
    const ml = [
      'ജനു',
      'ഫെബ്രു',
      'മാർ',
      'ഏപ്രി',
      'മേയ്',
      'ജൂൺ',
      'ജൂലൈ',
      'ഓഗ',
      'സെപ്',
      'ഒക്',
      'നവം',
      'ഡിസം',
    ];
    expect(formatDay('2026-11-09', ml)).toBe('9 നവം 2026');
  });
});
