import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ToastHost, toast } from '@/features/luvax/components/Toast';

afterEach(() => {
  vi.useRealTimers();
});

describe('toast action', () => {
  it('renders the action as a labelled button inside the status message', () => {
    render(<ToastHost />);

    act(() => toast('Post hidden', { action: { label: 'undo', onClick: vi.fn() } }));

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Post hidden');
    const button = screen.getByRole('button', { name: 'undo' });
    expect(status).toContainElement(button);
    button.focus();
    expect(button).toHaveFocus();
  });

  it('runs the handler once and removes the toast when the action is used', async () => {
    const onClick = vi.fn();
    render(<ToastHost />);
    act(() => toast('Post hidden again', { action: { label: 'undo', onClick } }));

    fireEvent.click(screen.getByRole('button', { name: 'undo' }));

    expect(onClick).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });

  it('can be pressed with the keyboard on a focused action', () => {
    const onClick = vi.fn();
    render(<ToastHost />);
    act(() => toast('Post hidden keyboard', { action: { label: 'undo', onClick } }));

    const button = screen.getByRole('button', { name: 'undo' });
    button.focus();
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('stays long enough to reach, unlike a plain toast', () => {
    vi.useFakeTimers();
    render(<ToastHost />);
    act(() => toast('plain one'));
    act(() => toast('with action', { action: { label: 'undo', onClick: vi.fn() } }));

    act(() => vi.advanceTimersByTime(2500));

    expect(screen.queryByText('plain one')).toBeNull();
    expect(screen.getByText('with action')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(6000));
    expect(screen.queryByText('with action')).toBeNull();
  });

  it('keeps a plain toast free of buttons', () => {
    render(<ToastHost />);
    act(() => toast('just a note'));

    expect(screen.queryByRole('button')).toBeNull();
  });
});
