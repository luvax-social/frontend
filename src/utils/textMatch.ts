/**
 * Hidden Words text normalisation, written to follow the backend `TextMatchNormalizer`.
 *
 * The contract is the "Text match normalisation" section of the backend's
 * `docs/modules/GLOBAL_RULES.md`. The Hidden Words settings screen previews the normalised form of
 * what is typed and refuses a duplicate entry with these functions.
 * `tests/unit/fixtures/text-match-vectors.json` holds the cases both normalisers are checked
 * against; the tests run them here, and the backend runs its copy of the same file. The file
 * guarantees only that those cases agree, so a change to the contract, either normaliser or the
 * vectors has to be made to all of them together.
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
