/**
 * Edge n-gram search tokens.
 *
 * A MongoDB `$text` index only matches whole stemmed words, so typing "Joh"
 * would not find "John". Unanchored case-insensitive regexes cannot use an index
 * at all. Instead each document stores the lowercase prefixes of every word in
 * its searchable fields (`john` → j, jo, joh, john) in a multikey-indexed array,
 * and a query becomes `{ searchTokens: { $all: [...] } }`: prefix matching, any
 * word order, served by an index.
 */
export const MAX_TOKEN_LENGTH = 15;

export function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function prefixes(word: string): string[] {
  const capped = word.slice(0, MAX_TOKEN_LENGTH);
  const out: string[] = [];
  for (let i = 1; i <= capped.length; i += 1) out.push(capped.slice(0, i));
  return out;
}

/** Tokens to store on a document. Phone-like values also get a digits-only token. */
export function buildSearchTokens(values: Array<string | null | undefined>): string[] {
  const tokens = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    for (const word of tokenize(value)) prefixes(word).forEach((p) => tokens.add(p));
    // Phone numbers: index the digit run starting at every group, so "+1 555 123 4567"
    // is found by "15551234567", "5551234567" and "1234567" (with or without country code).
    const groups = value.match(/\d+/g) ?? [];
    if (groups.join('').length >= 6) {
      for (let i = 0; i < groups.length - 1; i += 1) prefixes(groups.slice(i).join('')).forEach((p) => tokens.add(p));
    }
  }
  return [...tokens];
}

/** Tokens to query with: each word of the search, capped to the stored prefix length. */
export function searchQueryTokens(search: string): string[] {
  return [...new Set(tokenize(search).map((w) => w.slice(0, MAX_TOKEN_LENGTH)))];
}

/** Mongo filter fragment for a free-text search, or `{}` when the search is empty. */
export function searchMatch(search?: string): Record<string, unknown> {
  if (!search) return {};
  const tokens = searchQueryTokens(search);
  return tokens.length ? { searchTokens: { $all: tokens } } : {};
}
