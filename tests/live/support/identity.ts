import type { AuthResponse } from '@/types/auth';
export type Identity = ReturnType<typeof uniqueIdentity>;
export type VerifiedUser = Awaited<ReturnType<typeof createVerifiedUser>>;
import { api, unwrap } from './client.ts';
import { extractTokenFromMail, waitForMailWithToken } from './mailpit.ts';

// Satisfies the documented policy: 8 to 64 characters, at least one uppercase, at least one
// digit or special character, no whitespace or invisible characters.
export const TEST_PASSWORD = 'LuvaxTest1!';

let counter = 0;

/**
 * Unique per call and per run, so repeated runs never collide on the username or email
 * unique index. Soft delete does not release either identifier, so reuse is not an option.
 */
export function uniqueIdentity() {
  counter += 1;
  const stamp = `${Date.now().toString(36)}${counter}${Math.random().toString(36).slice(2, 6)}`;
  const username = `t_${stamp}`.slice(0, 30);
  return { username, email: `${username}@luvax.test`, password: TEST_PASSWORD };
}

/** Registers an account and returns the identity plus the raw register result. */
export async function registerUser(identity = uniqueIdentity()) {
  const result = await api('/auth/register', {
    method: 'POST',
    body: {
      username: identity.username,
      email: identity.email,
      password: identity.password,
      displayName: `Test ${identity.username}`,
    },
  });
  return { identity, result };
}

/**
 * Reads the verification token out of Mailpit and consumes it against the API.
 *
 * Waits for a message carrying a token rather than the first message to arrive: registration
 * also sends a welcome email, which has no token and can land first.
 */
export async function verifyUser(identity: Identity) {
  const mail = await waitForMailWithToken(identity.email);
  const token = extractTokenFromMail(mail);
  const result = await api(`/auth/verify-email?token=${encodeURIComponent(token)}`);
  if (result.status !== 200) {
    throw new Error(`Verification failed: ${result.status} ${result.body?.code}`);
  }
  return token;
}

export async function loginUser(identity: Identity) {
  return api<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { identifier: identity.email, password: identity.password },
  });
}

/**
 * Full signup path: register, verify via the real email, then log in.
 *
 * Every live test needing an authenticated caller starts here, so the suite never depends on
 * SEED_DATA state and stays repeatable. Exercising the real signup path is a deliberate
 * side benefit rather than an accident.
 */
export async function createVerifiedUser() {
  const { identity, result: registerResult } = await registerUser();
  if (registerResult.status !== 200 && registerResult.status !== 201) {
    throw new Error(
      `Registration failed: ${registerResult.status} ${registerResult.body?.code} ${registerResult.body?.message}`
    );
  }

  await verifyUser(identity);
  const loginResult = await loginUser(identity);
  const session = unwrap(loginResult);

  return {
    ...identity,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    user: session.user,
  };
}
