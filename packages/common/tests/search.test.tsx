import { buildSearchTokens, searchMatch, searchQueryTokens } from '../src/data/search';
import { createdAtMatch, fillBuckets, resolveRange } from '../src/data/dates';

describe('search tokens', () => {
  it('indexes every prefix of every word, case- and accent-insensitively', () => {
    const tokens = buildSearchTokens(['Dr. José Núñez', 'Cardiology']);
    for (const t of ['dr', 'j', 'jo', 'jos', 'jose', 'nunez', 'c', 'card', 'cardiology']) {
      expect(tokens).toContain(t);
    }
  });

  it('makes phone numbers searchable with or without the country code', () => {
    const tokens = buildSearchTokens(['+1 555 123 4567']);
    expect(tokens).toContain('15551234567');
    expect(tokens).toContain('5551234');
    expect(tokens).toContain('1234567');
  });

  it('caps very long words at the stored prefix length', () => {
    const [token] = searchQueryTokens('gastroenterologist');
    expect(token).toBe('gastroenterolog');
    expect(buildSearchTokens(['gastroenterologist'])).toContain(token);
  });

  it('builds an $all match from the query words and ignores empty searches', () => {
    expect(searchMatch('  Sarah  CHEN ')).toEqual({ searchTokens: { $all: ['sarah', 'chen'] } });
    expect(searchMatch('')).toEqual({});
    expect(searchMatch('!!!')).toEqual({});
  });
});

describe('date helpers', () => {
  const now = new Date('2026-03-15T10:00:00Z');

  it('produces a continuous daily axis', () => {
    const r = resolveRange('7d', now);
    expect(r.buckets).toEqual([
      '2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14', '2026-03-15',
    ]);
    expect(r.from.toISOString()).toBe('2026-03-09T00:00:00.000Z');
  });

  it('produces 12 monthly buckets across a year boundary', () => {
    const r = resolveRange('12m', now);
    expect(r.buckets[0]).toBe('2025-04');
    expect(r.buckets[11]).toBe('2026-03');
    expect(r.unit).toBe('month');
  });

  it('zero-fills missing buckets', () => {
    expect(fillBuckets(['a', 'b', 'c'], [{ _id: 'b', count: 4 }])).toEqual([
      { bucket: 'a', count: 0 },
      { bucket: 'b', count: 4 },
      { bucket: 'c', count: 0 },
    ]);
  });

  it('treats the "to" date as inclusive', () => {
    expect(createdAtMatch('2026-01-01', '2026-01-31')).toEqual({
      createdAt: { $gte: new Date('2026-01-01T00:00:00.000Z'), $lte: new Date('2026-01-31T23:59:59.999Z') },
    });
  });
});
