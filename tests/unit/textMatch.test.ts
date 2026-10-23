import { describe, expect, it } from 'vitest';

import { normalizeName, normalizePhrase, tokens } from '@/utils/textMatch';
import vectors from './fixtures/text-match-vectors.json';
import placeVectors from './fixtures/place-name-vectors.json';

describe('tokens', () => {
  it.each(vectors)('tokenises $raw as the shared contract vector', ({ raw, tokens: expected }) => {
    expect(tokens(raw)).toEqual(expected);
  });

  it.each([null, undefined, '', '   ', '\n\t'])('returns no tokens for %j', (raw) => {
    expect(tokens(raw)).toEqual([]);
  });

  it('keeps a digits-only token unchanged and maps leetspeak inside a word', () => {
    expect(tokens('2024 b4d')).toEqual(['2024', 'bad']);
  });
});

describe('normalizePhrase', () => {
  it('joins the tokens with single spaces', () => {
    expect(normalizePhrase('  Đồ   NGU!!! ')).toBe('do ngu');
  });

  it('folds leetspeak and markers the same way as tokens', () => {
    expect(normalizePhrase('@anna h3ll0 $hit')).toBe('anna hello shit');
  });

  it.each([null, undefined, '', '   ', '@@!!!', '🇻🇳❤️'])(
    'returns an empty string for %j',
    (raw) => {
      expect(normalizePhrase(raw)).toBe('');
    }
  );
});

describe('normalizeName', () => {
  it.each(placeVectors)('keys $raw as the shared place name vector', ({ raw, name }) => {
    expect(normalizeName(raw)).toBe(name);
  });

  it.each([null, undefined])('returns an empty string for %j', (raw) => {
    expect(normalizeName(raw)).toBe('');
  });
});
