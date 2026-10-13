import { z } from 'zod';

// Shared Zod field validators mirroring backend @Size/@Pattern constraints, reused by any
// feature that collects the same underlying value (account registration, profile editing). The
// backend is the source of truth: these must not reject a value the server accepts, nor accept
// one the server rejects.

// Backend RegisterRequest.username / UpdateProfileRequest.username:
// @Size(min = 3, max = 30) @Pattern(^[a-zA-Z0-9_.]+$).
export const usernameField = z
  .string()
  .trim()
  .min(3, 'username must be at least 3 characters.')
  .max(30, 'username must be 30 characters or fewer.')
  .regex(/^[a-zA-Z0-9_.]+$/, 'username may only contain letters, digits, underscores and dots.');

// Backend RegisterRequest.displayName / UpdateProfileRequest.displayName: @Size(max = 100),
// optional.
export const displayNameField = z
  .string()
  .trim()
  .max(100, 'display name must be 100 characters or fewer.')
  .optional()
  .or(z.literal(''));

// Backend UpdateProfileRequest.bio: @Size(max = 500), optional; sending an empty string clears
// it. Not trimmed: the character count the server checks is the raw string it receives.
export const bioField = z
  .string()
  .max(500, 'bio must be 500 characters or fewer.')
  .optional()
  .or(z.literal(''));

// Backend UpdateProfileRequest.websiteUrl: @Size(max = 2048), optional. The server applies no
// format check - it stored "not a url" verbatim when probed - so length is the only constraint
// mirrored here. Rejecting a shape the server accepts would make this validator stricter than
// the contract it exists to mirror.
export const websiteUrlField = z
  .string()
  .trim()
  .max(2048, 'link must be 2048 characters or fewer.')
  .optional()
  .or(z.literal(''));
