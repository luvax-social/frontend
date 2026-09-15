import { createRef } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TurnstileWidget } from '@/components/common/TurnstileWidget';
import AuthPage from '@/features/auth/components/AuthPage';
import { authApi } from '@/api/authApi';

/**
 * A Turnstile token is single-use.
 *
 * What these cover is that a failed submission re-arms the challenge - for any
 * failure, not only a refused one. Without it, a wrong password followed by a
 * second attempt sends a token the server has already spent, and the reader is
 * refused for a reason nothing on screen explains.
 */

vi.mock('@/api/authApi', () => ({
  authApi: {
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    getCurrentUser: vi.fn(),
    getGoogleLoginUrl: vi.fn(() => 'https://example.invalid/oauth'),
  },
}));

let solveChallenge;
let expireChallenge;

/**
 * Stands in for Cloudflare's script, which the widget injects lazily and which
 * jsdom will not load. Captures the callbacks the widget registers so a test
 * can drive a solve or an expiry.
 */
const installFakeTurnstile = () => {
  const api = {
    render: vi.fn((_container, options) => {
      solveChallenge = () => act(() => options.callback('solved-token'));
      expireChallenge = () => act(() => options['expired-callback']());
      return 'widget-1';
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  };
  window.turnstile = api;
  return api;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '1x00000000000000000000AA');
});

afterEach(() => {
  delete window.turnstile;
  vi.unstubAllEnvs();
});

describe('TurnstileWidget', () => {
  it('hands the solved token upward and clears it on expiry', async () => {
    const api = installFakeTurnstile();
    const onToken = vi.fn();
    render(<TurnstileWidget onToken={onToken} />);

    await waitFor(() => expect(api.render).toHaveBeenCalled());

    solveChallenge();
    expect(onToken).toHaveBeenLastCalledWith('solved-token');

    expireChallenge();
    expect(onToken).toHaveBeenLastCalledWith(null);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'The challenge expired. Complete it again.'
    );
  });

  it('re-arms the challenge and clears the token when reset is called', async () => {
    const api = installFakeTurnstile();
    const onToken = vi.fn();
    const ref = createRef();
    render(<TurnstileWidget ref={ref} onToken={onToken} />);

    await waitFor(() => expect(api.render).toHaveBeenCalled());
    solveChallenge();
    expect(onToken).toHaveBeenLastCalledWith('solved-token');

    act(() => ref.current.reset());

    expect(api.reset).toHaveBeenCalledWith('widget-1');
    expect(onToken).toHaveBeenLastCalledWith(null);
  });

  it('tolerates reset before the challenge has drawn', () => {
    const ref = createRef();
    render(<TurnstileWidget ref={ref} onToken={vi.fn()} />);

    expect(() => act(() => ref.current.reset())).not.toThrow();
  });

  it('shows the caller-supplied sentence when the challenge cannot run', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
    const onUnavailable = vi.fn();
    render(
      <TurnstileWidget
        onToken={vi.fn()}
        onUnavailable={onUnavailable}
        unavailableMessage="A sentence only this surface would use."
      />
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A sentence only this surface would use.'
    );
    expect(onUnavailable).toHaveBeenCalled();
  });
});

describe('the login form', () => {
  const renderLogin = () =>
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthPage />
      </MemoryRouter>
    );

  const fillCredentials = () => {
    fireEvent.change(screen.getByLabelText('Username or email'), {
      target: { value: 'someone@example.invalid' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'S3cur3P@ssword' } });
  };

  it('keeps the submit control inert until the challenge is solved', async () => {
    const api = installFakeTurnstile();
    renderLogin();
    await waitFor(() => expect(api.render).toHaveBeenCalled());

    const submit = screen.getByRole('button', { name: 'Log in' });
    expect(submit).toBeDisabled();
    expect(screen.getByText('Complete the challenge above to continue.')).toBeInTheDocument();

    solveChallenge();

    await waitFor(() => expect(submit).toBeEnabled());
  });

  it('re-arms the challenge when the password is wrong, not only when the challenge is refused', async () => {
    const api = installFakeTurnstile();
    const refusal = new Error('refused');
    refusal.response = { data: { code: 'AUTH_INVALID_CREDENTIALS' } };
    authApi.login.mockRejectedValue(refusal);

    renderLogin();
    await waitFor(() => expect(api.render).toHaveBeenCalled());
    solveChallenge();
    fillCredentials();

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(api.reset).toHaveBeenCalledWith('widget-1'));
    expect(
      await screen.findByText('That email or password is not right. Check them and try again.')
    ).toBeInTheDocument();
    // Cleared by the reset, so the reader cannot re-send the spent token.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Log in' })).toBeDisabled());
  });

  it('names the challenge when the server refuses it, rather than blaming the credentials', async () => {
    const api = installFakeTurnstile();
    const refusal = new Error('refused');
    refusal.response = { data: { code: 'AUTH_CAPTCHA_FAILED' } };
    authApi.login.mockRejectedValue(refusal);

    renderLogin();
    await waitFor(() => expect(api.render).toHaveBeenCalled());
    solveChallenge();
    fillCredentials();

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(
      await screen.findByText('The challenge was not accepted. Try it again.')
    ).toBeInTheDocument();
    expect(api.reset).toHaveBeenCalledWith('widget-1');
  });

  it('returns the submit control to its disabled state when the token expires', async () => {
    const api = installFakeTurnstile();
    renderLogin();
    await waitFor(() => expect(api.render).toHaveBeenCalled());

    solveChallenge();
    const submit = screen.getByRole('button', { name: 'Log in' });
    await waitFor(() => expect(submit).toBeEnabled());

    expireChallenge();

    await waitFor(() => expect(submit).toBeDisabled());
    expect(screen.getByRole('status')).toHaveTextContent(
      'The challenge expired. Complete it again.'
    );
  });
});
