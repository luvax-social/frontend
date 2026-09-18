import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ROUTES } from '@/config/constants';
import { appealPath, appealableActionId } from '@/utils/appealEntry';
import { isAppealTicket, requiresAdminDecision } from '@/features/admin/lib/supportTicketSchema';
import { describeSupportError } from '@/features/support/utils/supportErrors';
import { AppealStatusScreen } from '@/features/support/components/AppealStatusScreen';
import { AppealResendScreen } from '@/features/support/components/AppealResendScreen';

/**
 * The screens and rules behind the appeal reachability work.
 *
 * Several of these pin security properties rather than behaviour: that the
 * status screen cannot be used to tell one dead token from another, that a spent
 * captcha is always re-armed, and that the staff console decides what an appeal
 * is from the audit row rather than from anything the submitter chose.
 */

const publicGet = vi.fn();
const publicPost = vi.fn();
const post = vi.fn();

vi.mock('@/api/axiosClient', () => ({
  axiosClient: {
    post: (...args) => post(...args),
    get: vi.fn(),
  },
  publicClient: {
    post: (...args) => publicPost(...args),
    get: (...args) => publicGet(...args),
  },
}));

/** An Axios-shaped rejection carrying the envelope code the interceptor preserves. */
const refusal = (code, status = 400) =>
  Object.assign(new Error('Request failed'), { response: { status, data: { code } } });

const renderScreen = (ui, route) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={ROUTES.SUPPORT_APPEAL_STATUS} element={ui} />
          <Route path={ROUTES.SUPPORT_APPEAL_RESEND} element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

let solveChallenge;

/** Stands in for Cloudflare's script, which jsdom will not load. */
const installFakeTurnstile = () => {
  const api = {
    render: vi.fn((_container, options) => {
      solveChallenge = () => act(() => options.callback('solved-token'));
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

describe('the shared appeal entry point', () => {
  const ACTION_ID = '8f14e45f-ceea-467a-9e7c-6f1a2b3c4d5e';

  // One form stands behind both entries. What each entry has to get right is the
  // identifier it seeds, and both reach it through one builder precisely so the
  // route and the parameter name cannot disagree.
  it('builds the same address from a warning and from a removal notification', () => {
    const fromWarning = appealPath(ACTION_ID);
    const fromNotification = appealPath(
      appealableActionId({
        type: 'comment_removed',
        entityType: 'admin_action',
        entityId: ACTION_ID,
      })
    );

    expect(fromWarning).toBe(fromNotification);
    expect(new URLSearchParams(fromWarning.split('?')[1]).get('appeal')).toBe(ACTION_ID);
  });

  it('offers no appeal for a removal notification that points at the content', () => {
    // POST_REMOVED predates this work and points at the post. Seeding an appeal
    // with a post id would open one against nothing.
    expect(
      appealableActionId({ type: 'post_removed', entityType: 'post', entityId: ACTION_ID })
    ).toBeFalsy();
  });
});

describe('the anonymous status screen', () => {
  /** Renders the screen against one refusal and returns everything the reader sees. */
  const renderRefusal = async (code) => {
    publicGet.mockRejectedValueOnce(refusal(code));
    const { unmount } = renderScreen(
      <AppealStatusScreen />,
      `${ROUTES.SUPPORT_APPEAL_STATUS}?token=whatever`
    );
    const alert = await screen.findByRole('alert');
    const seen = {
      alert: alert.textContent,
      links: screen
        .queryAllByRole('link')
        .map((link) => link.textContent)
        .filter(Boolean)
        .sort(),
      buttons: screen.queryAllByRole('button').map((button) => button.textContent),
    };
    unmount();
    return seen;
  };

  // Unknown, expired and malformed all answer SUPPORT_TOKEN_INVALID, and the
  // screen must not guess which. Differentiating any of the three - in copy, in
  // layout, or by offering a control for one and not another - would turn the
  // page into an oracle for which guesses named something real.
  it('renders one identical state for an unknown, an expired and a malformed token', async () => {
    const unknown = await renderRefusal('SUPPORT_TOKEN_INVALID');
    const expired = await renderRefusal('SUPPORT_TOKEN_INVALID');
    const malformed = await renderRefusal('SUPPORT_TOKEN_INVALID');

    expect(expired).toEqual(unknown);
    expect(malformed).toEqual(unknown);
    // The recovery route, and nothing that varies between the three.
    expect(unknown.links).toHaveLength(1);
  });

  it('never writes the status token to browser storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    publicGet.mockResolvedValueOnce({
      data: { data: { status: 'OPEN', subject: 'My appeal', body: 'Please review' } },
    });

    renderScreen(<AppealStatusScreen />, `${ROUTES.SUPPORT_APPEAL_STATUS}?token=a-real-token`);
    await screen.findByText('My appeal');

    const persisted = setItem.mock.calls.filter(([, value]) =>
      String(value).includes('a-real-token')
    );
    expect(persisted).toEqual([]);
    setItem.mockRestore();
  });

  it('offers no control that could change anything', async () => {
    publicGet.mockResolvedValueOnce({
      data: { data: { status: 'OPEN', subject: 'My appeal', body: 'Please review' } },
    });

    renderScreen(<AppealStatusScreen />, `${ROUTES.SUPPORT_APPEAL_STATUS}?token=a-real-token`);
    await screen.findByText('My appeal');

    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(screen.queryAllByRole('textbox')).toEqual([]);
  });
});

describe('the lost-link recovery form', () => {
  /** Fills the address, solves the challenge and submits. */
  const submit = async (address) => {
    const input = await screen.findByLabelText(/your email/i);
    act(() => {
      input.focus();
    });
    fireChange(input, address);
    solveChallenge();
    const button = await screen.findByRole('button', { name: /send the link/i });
    await act(async () => {
      button.click();
    });
  };

  /** React tracks the value setter, so a plain assignment does not reach state. */
  const fireChange = (input, value) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    act(() => {
      setter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  // A Turnstile token is spent by the request that carries it, whatever the
  // server then decides. Leaving the solved token in place after a refusal means
  // the retry sends one the server has already consumed, and the second refusal
  // has nothing on screen to explain it.
  it('re-arms the challenge after a failed submission', async () => {
    const api = installFakeTurnstile();
    publicPost.mockRejectedValueOnce(refusal('SUPPORT_CAPTCHA_FAILED'));

    renderScreen(<AppealResendScreen />, ROUTES.SUPPORT_APPEAL_RESEND);
    await waitFor(() => expect(api.render).toHaveBeenCalled());

    await submit('banned@example.com');

    await waitFor(() => expect(api.reset).toHaveBeenCalled());
  });

  it('shows one success state, whatever the address turned out to be', async () => {
    const api = installFakeTurnstile();
    publicPost.mockResolvedValueOnce({ data: { data: null } });

    renderScreen(<AppealResendScreen />, ROUTES.SUPPORT_APPEAL_RESEND);
    await waitFor(() => expect(api.render).toHaveBeenCalled());

    await submit('nobody@example.com');

    // The server answers identically either way, so nothing it returned can
    // reach the copy. The confirmation is unconditional and the form is gone.
    await screen.findByText(/check your email/i);
    expect(screen.queryByRole('button', { name: /send the link/i })).toBeNull();
  });
});

describe('the staff console', () => {
  const appealFromSession = {
    category: 'APPEAL_BAN',
    source: 'AUTHENTICATED',
    adminActionId: '8f14e45f-ceea-467a-9e7c-6f1a2b3c4d5e',
  };
  const ordinaryTicket = { category: 'BUG_REPORT', source: 'AUTHENTICATED', adminActionId: null };
  const selfDeclaredAppeal = {
    category: 'APPEAL_BAN',
    source: 'AUTHENTICATED',
    adminActionId: null,
  };

  // An appeal opened from a session carries the same source as an ordinary
  // authenticated ticket, so source separates nothing here.
  it('distinguishes an appeal by its audit row, not by its source', () => {
    expect(isAppealTicket(appealFromSession)).toBe(true);
    expect(isAppealTicket(ordinaryTicket)).toBe(false);
    expect(appealFromSession.source).toBe(ordinaryTicket.source);
  });

  // The authenticated ticket form takes its category straight from the client,
  // so category alone would let anyone label an ordinary request as an appeal.
  it('does not treat a self-declared appeal category as an appeal', () => {
    expect(isAppealTicket(selfDeclaredAppeal)).toBe(false);
  });

  // Labelling and gating are different questions. Gating must keep mirroring the
  // server, which refuses a moderator on category; gating on the audit row
  // instead would offer a decision form whose every outcome is a refusal.
  it('still gates the decision on the rule the server actually applies', () => {
    expect(requiresAdminDecision(selfDeclaredAppeal)).toBe(true);
    expect(requiresAdminDecision(appealFromSession)).toBe(true);
    expect(requiresAdminDecision(ordinaryTicket)).toBe(false);
  });
});

describe('the appeal error copy', () => {
  const FALLBACK = 'FALLBACK';

  it('names each of the three appeal refusals rather than falling back', () => {
    expect(describeSupportError(refusal('SUPPORT_APPEAL_ALREADY_FILED'), FALLBACK)).not.toBe(
      FALLBACK
    );
    expect(describeSupportError(refusal('SUPPORT_APPEAL_ACTION_NOT_FOUND'), FALLBACK)).not.toBe(
      FALLBACK
    );
    expect(describeSupportError(refusal('SUPPORT_APPEAL_NOT_APPEALABLE'), FALLBACK)).not.toBe(
      FALLBACK
    );
  });

  // The same code answers an identifier that names nothing and one belonging to
  // another account. Copy hinting at the second case would tell a caller that
  // the decision exists and is somebody else's.
  it('says nothing about ownership when a decision cannot be found', () => {
    const copy = describeSupportError(refusal('SUPPORT_APPEAL_ACTION_NOT_FOUND')).toLowerCase();
    for (const leak of ['another', 'someone', 'somebody', 'belongs', 'permission']) {
      expect(copy).not.toContain(leak);
    }
  });
});
