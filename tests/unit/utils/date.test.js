const {
  parseDateValue,
  formatDate,
  calculateAge,
  formatAge,
} = require('../../../miniprogram/utils/date');

describe('date utilities', () => {
  describe('parseDateValue', () => {
    test('parses millisecond timestamp numbers', () => {
      const ts = 1717243200000; // 2024-06-01T12:00:00.000Z
      const result = parseDateValue(ts);
      expect(result).not.toBeNull();
      expect(result.getTime()).toBe(ts);
    });

    test('parses second timestamp numbers', () => {
      const seconds = 1717243200;
      const result = parseDateValue(seconds);
      expect(result).not.toBeNull();
      expect(result.getTime()).toBe(seconds * 1000);
    });

    test('parses numeric timestamp strings', () => {
      const milliString = '1717243200000';
      const result = parseDateValue(milliString);
      expect(result).not.toBeNull();
      expect(result.getTime()).toBe(Number(milliString));
    });

    test('parses formatted date strings', () => {
      expect(formatDate('2024/06/01')).toBe('2024-06-01');
      expect(formatDate('2024.6.1')).toBe('2024-06-01');
      expect(formatDate('20240601')).toBe('2024-06-01');
      expect(formatDate('2024-06')).toBe('2024-06-01');
      expect(formatDate('2024')).toBe('2024-01-01');
    });

    test('returns null for invalid inputs', () => {
      expect(parseDateValue(null)).toBeNull();
      expect(parseDateValue('not-a-date')).toBeNull();
      expect(parseDateValue(NaN)).toBeNull();
    });
  });

  describe('calculateAge', () => {
    const reference = new Date(2024, 5, 1); // 2024-06-01

    test('calculates age when birthday has passed', () => {
      expect(calculateAge('2000-05-20', reference)).toBe(24);
    });

    test('calculates age when birthday has not passed', () => {
      expect(calculateAge('2000-07-20', reference)).toBe(23);
    });

    test('returns null for future birthdates', () => {
      expect(calculateAge('2099-01-01', reference)).toBeNull();
    });

    test('returns null for invalid birthdates', () => {
      expect(calculateAge('invalid', reference)).toBeNull();
    });
  });

  describe('formatAge', () => {
    const reference = new Date(2024, 5, 1);

    test('formats age result in Chinese', () => {
      expect(formatAge('2000-05-20', reference)).toBe('24岁');
    });

    test('returns empty string when age cannot be calculated', () => {
      expect(formatAge('2099-01-01', reference)).toBe('');
    });
  });
});
