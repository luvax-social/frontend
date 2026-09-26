import { describe, expect, it } from 'vitest';

import {
  authPageRegisterSchema,
  emailSchema,
  loginSchema,
  resetPasswordSchema,
} from '@/features/auth/utils/authSchemas';

/**
 * The challenge token is required on every form that carries one, so a
 * submission cannot reach the server without it.
 *
 * The bound mirrors the backend DTOs, which cap `turnstileToken` at 2048
 * characters; the schema must not reject a value the server accepts, nor accept
 * one it rejects.
 */

const TOKEN = 'a-solved-turnstile-token';
const PASSWORD = 'S3cur3P@ssword';

const VALID = {
  login: { identifier: 'someone@example.invalid', password: PASSWORD, turnstileToken: TOKEN },
  register: {
    username: 'john_doe',
    name: 'John Doe',
    email: 'someone@example.invalid',
    password: PASSWORD,
    turnstileToken: TOKEN,
  },
  email: { email: 'someone@example.invalid', turnstileToken: TOKEN },
  reset: { password: PASSWORD, confirmPassword: PASSWORD, turnstileToken: TOKEN },
};

const SCHEMAS = [
  ['loginSchema', loginSchema, VALID.login],
  ['authPageRegisterSchema', authPageRegisterSchema, VALID.register],
  ['emailSchema', emailSchema, VALID.email],
  ['resetPasswordSchema', resetPasswordSchema, VALID.reset],
];

describe('auth schemas carrying a Turnstile challenge', () => {
  it.each(SCHEMAS)('%s accepts a solved token', (_name, schema, values) => {
    expect(schema.safeParse(values).success).toBe(true);
  });

  it.each(SCHEMAS)('%s rejects an absent token', (_name, schema, values) => {
    const { turnstileToken, ...withoutToken } = values;
    expect(turnstileToken).toBe(TOKEN);
    expect(schema.safeParse(withoutToken).success).toBe(false);
  });

  it.each(SCHEMAS)('%s rejects an empty token', (_name, schema, values) => {
    expect(schema.safeParse({ ...values, turnstileToken: '' }).success).toBe(false);
  });

  it.each(SCHEMAS)('%s accepts a token at the 2048-character bound', (_name, schema, values) => {
    expect(schema.safeParse({ ...values, turnstileToken: 't'.repeat(2048) }).success).toBe(true);
  });

  it.each(SCHEMAS)('%s rejects a token past the 2048-character bound', (_name, schema, values) => {
    expect(schema.safeParse({ ...values, turnstileToken: 't'.repeat(2049) }).success).toBe(false);
  });

  it('names the challenge rather than the field when the token is missing', () => {
    const result = loginSchema.safeParse({ ...VALID.login, turnstileToken: '' });
    expect(result.success).toBe(false);
    const issue = result.error.issues.find((i) => i.path[0] === 'turnstileToken');
    expect(issue.message).toBe('Complete the challenge to continue.');
  });

  it('still enforces every rule it enforced before the token was added', () => {
    expect(loginSchema.safeParse({ ...VALID.login, identifier: '' }).success).toBe(false);
    expect(authPageRegisterSchema.safeParse({ ...VALID.register, password: 'short' }).success).toBe(
      false
    );
    expect(emailSchema.safeParse({ ...VALID.email, email: 'not-an-email' }).success).toBe(false);
    expect(
      resetPasswordSchema.safeParse({ ...VALID.reset, confirmPassword: 'Different1!' }).success
    ).toBe(false);
  });
});
