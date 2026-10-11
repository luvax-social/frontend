import type { AuthResponse } from '@/types/auth';
import type { UserProfileResponse } from '@/types/domain';
import { beforeAll, describe, expect, it } from 'vitest';
import { api, assertStackReachable, expectEnvelope, unwrap } from './support/client.ts';
import {
  TEST_PASSWORD,
  createVerifiedUser,
  loginUser,
  registerUser,
  uniqueIdentity,
  verifyUser,
} from './support/identity.ts';

beforeAll(async () => {
  await assertStackReachable();
});

describe('registration', () => {
  it('registers a new account and returns the standard envelope', async () => {
    const { result } = await registerUser();
    expectEnvelope(result);
    expect([200, 201]).toContain(result.status);
    expect(result.body!.success).toBe(true);
  });

  it('rejects a duplicate email', async () => {
    const identity = uniqueIdentity();
    await registerUser(identity);

    const second = await registerUser({
      ...identity,
      username: `${identity.username}b`.slice(0, 30),
    });
    expect(second.result.status).toBeGreaterThanOrEqual(400);
    expect(second.result.body!.success).toBe(false);
  });

  it('rejects a password that fails the policy', async () => {
    const identity = uniqueIdentity();
    const result = await api('/auth/register', {
      method: 'POST',
      body: { ...identity, password: 'weak', displayName: 'Weak Password' },
    });
    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(result.body!.success).toBe(false);
  });

  it('rejects an unrecognised field, guarding against mass assignment', async () => {
    const identity = uniqueIdentity();
    const result = await api('/auth/register', {
      method: 'POST',
      body: { ...identity, displayName: 'Extra Field', role: 'admin' },
    });
    expect(result.status).toBeGreaterThanOrEqual(400);
  });
});

describe('email verification', () => {
  it('refuses login before verification and allows it after', async () => {
    const identity = uniqueIdentity();
    await registerUser(identity);

    const before = await loginUser(identity);
    expect(before.status).toBeGreaterThanOrEqual(400);

    await verifyUser(identity);

    const after = await loginUser(identity);
    expect(after.status).toBe(200);
    expect(unwrap(after).accessToken).toBeTruthy();
  });
});

describe('login', () => {
  it('issues a token pair for correct credentials', async () => {
    const user = await createVerifiedUser();
    const session = unwrap(await loginUser(user));
    expect(session.accessToken).toBeTruthy();
    expect(session.tokenType).toBe('Bearer');
    expect(session.accessTokenExpiresIn).toBeGreaterThan(0);
  });

  it('rejects a wrong password without revealing which field failed', async () => {
    const user = await createVerifiedUser();
    const result = await loginUser({ ...user, password: `${TEST_PASSWORD}x` });
    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(result.body!.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('accepts a username as the identifier', async () => {
    const user = await createVerifiedUser();
    const result = await api('/auth/login', {
      method: 'POST',
      body: { identifier: user.username, password: user.password },
    });
    expect(result.status).toBe(200);
  });
});

describe('session lifecycle', () => {
  it('authenticates /users/me with the access token', async () => {
    const user = await createVerifiedUser();
    const me = unwrap(await api<UserProfileResponse>('/users/me', { token: user.accessToken }));
    expect(me.username).toBe(user.username);
  });

  it('rejects /users/me without a token', async () => {
    const result = await api<UserProfileResponse>('/users/me');
    expect(result.status).toBe(401);
  });

  it('rotates the session via refresh', async () => {
    const user = await createVerifiedUser();
    const result = await api<AuthResponse>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken: user.refreshToken },
    });
    expect(result.status).toBe(200);
    expect(unwrap(result).accessToken).toBeTruthy();
  });

  it('rejects a refresh with a garbage token', async () => {
    const result = await api<AuthResponse>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken: 'not-a-real-token' },
    });
    expect(result.status).toBeGreaterThanOrEqual(400);
  });

  it('blacklists the access token on logout', async () => {
    const user = await createVerifiedUser();

    const before = await api<UserProfileResponse>('/users/me', { token: user.accessToken });
    expect(before.status).toBe(200);

    const logout = await api('/auth/logout', {
      method: 'POST',
      token: user.accessToken,
      body: { refreshToken: user.refreshToken },
    });
    expect([200, 204]).toContain(logout.status);

    const after = await api<UserProfileResponse>('/users/me', { token: user.accessToken });
    expect(after.status).toBe(401);
  });
});
