import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { InteractionLimitsCategory } from '@/features/luvax/components/settings/InteractionLimitsCategory';
import { formatLimitEnd } from '@/features/luvax/utils/interactionLimitFormat';
import * as userService from '@/services/user.service';

import { apiError, envelope } from './settingsFixtures';
import { limitFixture } from './safetyFixtures';

vi.mock('@/services/user.service');

const service = vi.mocked(userService);

const END = '2026-10-17T14:40:00Z';
const activeLimit = limitFixture({
  limitNonFollowers: true,
  limitRecentFollowers: false,
  expiresAt: END,
  active: true,
});

const renderCategory = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<InteractionLimitsCategory />, { wrapper });
};

const turnOn = () => screen.getByRole('button', { name: 'turn on' });
const nonFollowers = () => screen.getByRole('switch', { name: "accounts that don't follow you" });
const recentFollowers = () =>
  screen.getByRole('switch', { name: 'accounts that followed you in the last 7 days' });
const duration = (name: string) => screen.getByRole('radio', { name });

const loadedForm = async () => {
  service.getMyInteractionLimit.mockResolvedValue(envelope(limitFixture()));
  renderCategory();
  await screen.findByRole('radiogroup', { name: 'for how long' });
};

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('limit interactions: the form', () => {
  it('offers both audiences, five durations with 7 days chosen, and the effects', async () => {
    await loadedForm();

    expect(nonFollowers()).toHaveAttribute('aria-checked', 'false');
    expect(recentFollowers()).toHaveAttribute('aria-checked', 'false');
    expect(screen.getAllByRole('radio').map((option) => option.textContent)).toEqual([
      '1 day',
      '3 days',
      '7 days',
      '14 days',
      '28 days',
    ]);
    expect(duration('7 days')).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByText(
        'Their new comments on your posts are hidden. You can review them on each post.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('Their new message requests go to hidden requests.')
    ).toBeInTheDocument();
    expect(screen.getByText("You won't be notified when they mention you.")).toBeInTheDocument();
  });

  it('keeps turn on disabled until an audience is chosen, then enables it', async () => {
    await loadedForm();
    expect(turnOn()).toBeDisabled();

    fireEvent.click(recentFollowers());
    expect(turnOn()).toBeEnabled();

    fireEvent.click(recentFollowers());
    expect(turnOn()).toBeDisabled();

    fireEvent.click(nonFollowers());
    expect(turnOn()).toBeEnabled();
  });

  it('sends the chosen audiences and duration, and waits for the server end time', async () => {
    let finish: (value: ReturnType<typeof envelope<typeof activeLimit>>) => void = () => {};
    service.setMyInteractionLimit.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await loadedForm();

    fireEvent.click(nonFollowers());
    fireEvent.click(duration('14 days'));
    fireEvent.click(turnOn());

    await waitFor(() =>
      expect(service.setMyInteractionLimit).toHaveBeenCalledWith({
        limitNonFollowers: true,
        limitRecentFollowers: false,
        durationDays: 14,
      })
    );
    expect(screen.queryByText(/limits are on until/)).toBeNull();
    expect(screen.getByRole('button', { name: 'turning on' })).toBeDisabled();

    finish(envelope(activeLimit));
    expect(await screen.findByText(/limits are on until/)).toBeInTheDocument();
  });

  it('keeps the form and says so when the server refuses', async () => {
    service.setMyInteractionLimit.mockRejectedValue(apiError('VALIDATION_ERROR', 400));
    await loadedForm();

    fireEvent.click(nonFollowers());
    fireEvent.click(turnOn());

    expect(
      await screen.findByText("We couldn't turn that on just now. Try again in a moment.")
    ).toBeInTheDocument();
    expect(nonFollowers()).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText(/limits are on until/)).toBeNull();
  });

  it('moves the duration with the arrow keys', async () => {
    await loadedForm();

    duration('7 days').focus();
    fireEvent.keyDown(duration('7 days'), { key: 'ArrowRight' });

    expect(duration('14 days')).toHaveAttribute('aria-checked', 'true');
    expect(duration('14 days')).toHaveFocus();
  });
});

describe('limit interactions: the active state', () => {
  it('replaces the form with the end time in the viewer local timezone', async () => {
    service.getMyInteractionLimit.mockResolvedValue(envelope(activeLimit));
    renderCategory();

    expect(
      await screen.findByText(`limits are on until ${formatLimitEnd(END)}`)
    ).toBeInTheDocument();
    expect(screen.getByText("Limiting accounts that don't follow you.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'turn on' })).toBeNull();
    expect(screen.getByRole('button', { name: 'turn off now' })).toBeInTheDocument();
  });

  it('describes both audiences when both are limited', async () => {
    service.getMyInteractionLimit.mockResolvedValue(
      envelope({ ...activeLimit, limitRecentFollowers: true })
    );
    renderCategory();

    expect(
      await screen.findByText(
        "Limiting accounts that don't follow you and accounts that followed you in the last 7 days."
      )
    ).toBeInTheDocument();
  });

  it('turns the limit off after the server confirms, then shows the form again', async () => {
    service.getMyInteractionLimit
      .mockResolvedValueOnce(envelope(activeLimit))
      .mockResolvedValue(envelope(limitFixture()));
    service.clearMyInteractionLimit.mockResolvedValue(undefined);
    renderCategory();

    fireEvent.click(await screen.findByRole('button', { name: 'turn off now' }));

    expect(await screen.findByRole('radiogroup', { name: 'for how long' })).toBeInTheDocument();
    expect(service.clearMyInteractionLimit).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/limits are on until/)).toBeNull();
  });

  it('keeps the status and says so when turning off fails', async () => {
    service.getMyInteractionLimit.mockResolvedValue(envelope(activeLimit));
    service.clearMyInteractionLimit.mockRejectedValue(apiError('INTERNAL_SERVER_ERROR', 500));
    renderCategory();

    fireEvent.click(await screen.findByRole('button', { name: 'turn off now' }));

    expect(
      await screen.findByText("We couldn't turn that off just now. Try again in a moment.")
    ).toBeInTheDocument();
    expect(screen.getByText(/limits are on until/)).toBeInTheDocument();
  });

  it('reopens the form with the current choices when change is pressed', async () => {
    service.getMyInteractionLimit.mockResolvedValue(
      envelope({ ...activeLimit, limitRecentFollowers: true })
    );
    renderCategory();

    fireEvent.click(await screen.findByRole('button', { name: 'change' }));

    expect(nonFollowers()).toHaveAttribute('aria-checked', 'true');
    expect(recentFollowers()).toHaveAttribute('aria-checked', 'true');
    expect(turnOn()).toBeEnabled();
  });

  it('treats an expired limit as no limit', async () => {
    service.getMyInteractionLimit.mockResolvedValue(envelope({ ...activeLimit, active: false }));
    renderCategory();

    expect(await screen.findByRole('radiogroup', { name: 'for how long' })).toBeInTheDocument();
    expect(screen.queryByText(/limits are on until/)).toBeNull();
  });
});

describe('limit interactions: reopening and resetting the form', () => {
  it('says the new duration starts now when the form is reopened with change', async () => {
    service.getMyInteractionLimit.mockResolvedValue(envelope(activeLimit));
    renderCategory();

    expect(screen.queryByText('The new duration starts now.')).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'change' }));

    expect(screen.getByText('The new duration starts now.')).toBeInTheDocument();
  });

  it('does not say it on the first form', async () => {
    await loadedForm();

    expect(screen.queryByText('The new duration starts now.')).toBeNull();
  });

  it('shows the initial form again after turn off, whatever was chosen before', async () => {
    service.getMyInteractionLimit.mockResolvedValue(envelope(limitFixture()));
    service.setMyInteractionLimit.mockResolvedValue(
      envelope({ ...activeLimit, limitRecentFollowers: true })
    );
    service.clearMyInteractionLimit.mockResolvedValue(undefined);
    await loadedForm();

    fireEvent.click(nonFollowers());
    fireEvent.click(recentFollowers());
    fireEvent.click(duration('14 days'));
    fireEvent.click(turnOn());
    fireEvent.click(await screen.findByRole('button', { name: 'turn off now' }));
    await screen.findByRole('radiogroup', { name: 'for how long' });

    expect(nonFollowers()).toHaveAttribute('aria-checked', 'false');
    expect(recentFollowers()).toHaveAttribute('aria-checked', 'false');
    expect(duration('7 days')).toHaveAttribute('aria-checked', 'true');
    expect(turnOn()).toBeDisabled();
  });
});

describe('limit interactions: alerts', () => {
  it('announces a failed turn on as an alert', async () => {
    service.setMyInteractionLimit.mockRejectedValue(apiError('VALIDATION_ERROR', 400));
    await loadedForm();

    fireEvent.click(nonFollowers());
    fireEvent.click(turnOn());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't turn that on just now. Try again in a moment."
    );
  });

  it('announces a failed turn off as an alert', async () => {
    service.getMyInteractionLimit.mockResolvedValue(envelope(activeLimit));
    service.clearMyInteractionLimit.mockRejectedValue(apiError('INTERNAL_SERVER_ERROR', 500));
    renderCategory();

    fireEvent.click(await screen.findByRole('button', { name: 'turn off now' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't turn that off just now. Try again in a moment."
    );
  });
});

describe('limit interactions: focus', () => {
  it('moves to the status line after turn on', async () => {
    service.setMyInteractionLimit.mockResolvedValue(envelope(activeLimit));
    await loadedForm();

    fireEvent.click(nonFollowers());
    turnOn().focus();
    fireEvent.click(turnOn());

    const status = await screen.findByText(/limits are on until/);
    await waitFor(() => expect(status).toHaveFocus());
    expect(status).toHaveAttribute('tabindex', '-1');
  });

  it('moves to the first audience switch after change', async () => {
    service.getMyInteractionLimit.mockResolvedValue(envelope(activeLimit));
    renderCategory();

    const change = await screen.findByRole('button', { name: 'change' });
    change.focus();
    fireEvent.click(change);

    await waitFor(() => expect(nonFollowers()).toHaveFocus());
  });

  it('moves to the status line after cancel', async () => {
    service.getMyInteractionLimit.mockResolvedValue(envelope(activeLimit));
    renderCategory();
    fireEvent.click(await screen.findByRole('button', { name: 'change' }));

    const cancel = await screen.findByRole('button', { name: 'cancel' });
    cancel.focus();
    fireEvent.click(cancel);

    await waitFor(() => expect(screen.getByText(/limits are on until/)).toHaveFocus());
  });

  it('moves to the first audience switch after turn off now', async () => {
    service.getMyInteractionLimit
      .mockResolvedValueOnce(envelope(activeLimit))
      .mockResolvedValue(envelope(limitFixture()));
    service.clearMyInteractionLimit.mockResolvedValue(undefined);
    renderCategory();

    const off = await screen.findByRole('button', { name: 'turn off now' });
    off.focus();
    fireEvent.click(off);

    await waitFor(() => expect(nonFollowers()).toHaveFocus());
  });

  it('does not steal focus when turning off fails', async () => {
    service.getMyInteractionLimit.mockResolvedValue(envelope(activeLimit));
    service.clearMyInteractionLimit.mockRejectedValue(apiError('INTERNAL_SERVER_ERROR', 500));
    renderCategory();

    const off = await screen.findByRole('button', { name: 'turn off now' });
    off.focus();
    fireEvent.click(off);
    await screen.findByRole('alert');

    expect(off).toHaveFocus();
  });

  it('does not pull focus back once the user has moved on to another control', async () => {
    let finish: (value: ReturnType<typeof envelope<typeof activeLimit>>) => void = () => {};
    service.setMyInteractionLimit.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    service.getMyInteractionLimit.mockResolvedValue(envelope(limitFixture()));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <button type="button">elsewhere</button>
        <InteractionLimitsCategory />
      </QueryClientProvider>
    );
    await screen.findByRole('radiogroup', { name: 'for how long' });

    fireEvent.click(nonFollowers());
    turnOn().focus();
    fireEvent.click(turnOn());
    await waitFor(() => expect(service.setMyInteractionLimit).toHaveBeenCalled());
    const elsewhere = screen.getByRole('button', { name: 'elsewhere' });
    elsewhere.focus();

    await act(async () => finish(envelope(activeLimit)));
    await screen.findByText(/limits are on until/);

    expect(elsewhere).toHaveFocus();
  });
});

describe('limit interactions: expiry while the page is open', () => {
  const now = new Date('2026-10-14T10:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(now);
  });

  it('refetches when the limit ends and shows the form again', async () => {
    service.getMyInteractionLimit
      .mockResolvedValueOnce(
        envelope({ ...activeLimit, expiresAt: new Date(now.getTime() + 60_000).toISOString() })
      )
      .mockResolvedValue(envelope(limitFixture({ limitNonFollowers: true })));
    renderCategory();
    await screen.findByText(/limits are on until/);
    expect(service.getMyInteractionLimit).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });

    expect(await screen.findByRole('radiogroup', { name: 'for how long' })).toBeInTheDocument();
    expect(service.getMyInteractionLimit).toHaveBeenCalledTimes(2);
  });

  it('does not fire early for an end further away than a timer can wait', async () => {
    service.getMyInteractionLimit.mockResolvedValue(
      envelope({
        ...activeLimit,
        expiresAt: new Date(now.getTime() + 28 * 86_400_000).toISOString(),
      })
    );
    renderCategory();
    await screen.findByText(/limits are on until/);

    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });

    expect(service.getMyInteractionLimit).toHaveBeenCalledTimes(1);
  });

  it('asks again later when the server still reports the limit after its end', async () => {
    const endsAt = new Date(now.getTime() + 60_000).toISOString();
    service.getMyInteractionLimit
      .mockResolvedValueOnce(envelope({ ...activeLimit, expiresAt: endsAt }))
      .mockResolvedValueOnce(envelope({ ...activeLimit, expiresAt: endsAt }))
      .mockResolvedValue(envelope(limitFixture()));
    renderCategory();
    await screen.findByText(/limits are on until/);

    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });
    await waitFor(() => expect(service.getMyInteractionLimit).toHaveBeenCalledTimes(2));

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });

    expect(await screen.findByRole('radiogroup', { name: 'for how long' })).toBeInTheDocument();
    expect(service.getMyInteractionLimit).toHaveBeenCalledTimes(3);
  });

  it('empties the draft when the limit ends while the change form is open', async () => {
    service.getMyInteractionLimit
      .mockResolvedValueOnce(
        envelope({ ...activeLimit, expiresAt: new Date(now.getTime() + 60_000).toISOString() })
      )
      .mockResolvedValue(envelope(limitFixture()));
    renderCategory();
    fireEvent.click(await screen.findByRole('button', { name: 'change' }));
    expect(nonFollowers()).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(duration('28 days'));

    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });

    await waitFor(() => expect(nonFollowers()).toHaveAttribute('aria-checked', 'false'));
    expect(duration('7 days')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('button', { name: 'cancel' })).toBeNull();
  });

  it('cancels the timer when the page is left', async () => {
    service.getMyInteractionLimit.mockResolvedValue(
      envelope({ ...activeLimit, expiresAt: new Date(now.getTime() + 60_000).toISOString() })
    );
    const view = renderCategory();
    await screen.findByText(/limits are on until/);

    view.unmount();
    await act(async () => {
      vi.advanceTimersByTime(120_000);
    });

    expect(service.getMyInteractionLimit).toHaveBeenCalledTimes(1);
  });
});
