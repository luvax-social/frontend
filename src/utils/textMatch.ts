/**
 * Hidden Words text normalisation, mirroring the backend `TextMatchNormalizer`.
 *
 * The contract is the "Text match normalisation" section of the backend's
 * `docs/modules/GLOBAL_RULES.md`. The Hidden Words settings screen previews matches with these
 * functions, so a divergence shows the user a match the server will not make, or the reverse.
 * The shared cases are `tests/unit/fixtures/text-match-vectors.json`, a byte copy of the backend
 * file; change the contract, the backend normaliser and both vector files together.
 */
const LEET: Readonly<Record<string, string>> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  '!': 'i',
};
const TOKEN = /[\p{L}\p{N}@$!]+/gu;

/**
 * Splits text into the normalised tokens that Hidden Words entries are compared by.
 *
 * Returns an empty array for null, undefined or blank input.
 */
export function tokens(raw: string | null | undefined): string[] {
  if (!raw || !raw.trim()) return [];
  // đ and Đ have no canonical decomposition, so NFD leaves them and they are folded by hand.
  const folded = raw
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
  return (folded.match(TOKEN) ?? [])
    .map((token) => token.replace(/^@+/, '').replace(/!+$/, ''))
    .filter((token) => token.length > 0)
    .map((token) =>
      // A token of only digits is a number, not obfuscated text, so it is left alone.
      /\p{L}/u.test(token) ? Array.from(token, (char) => LEET[char] ?? char).join('') : token
    );
}

/** Joins the tokens of a word or phrase with single spaces, the form entries are compared in. */
export function normalizePhrase(raw: string | null | undefined): string {
  return tokens(raw).join(' ');
}
