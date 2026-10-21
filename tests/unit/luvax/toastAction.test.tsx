import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ToastHost, toast } from '@/features/luvax/components/Toast';
import { useAuthStore } from '@/store/useAuthStore';

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

  it('holds the toast while the pointer is over it and finishes the wait afterwards', () => {
    vi.useFakeTimers();
    render(<ToastHost />);
    act(() => toast('Post hidden hover', { action: { label: 'undo', onClick: vi.fn() } }));
    const status = screen.getByRole('status');

    act(() => vi.advanceTimersByTime(4000));
    fireEvent.mouseEnter(status);
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByText('Post hidden hover')).toBeInTheDocument();

    fireEvent.mouseLeave(status);
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByText('Post hidden hover')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByText('Post hidden hover')).toBeNull();
  });

  it('holds the toast while its action has keyboard focus', () => {
    vi.useFakeTimers();
    render(<ToastHost />);
    act(() => toast('Post hidden focus', { action: { label: 'undo', onClick: vi.fn() } }));
    const button = screen.getByRole('button', { name: 'undo' });

    fireEvent.focus(button);
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByText('Post hidden focus')).toBeInTheDocument();

    fireEvent.blur(button);
    act(() => vi.advanceTimersByTime(7000));
    expect(screen.queryByText('Post hidden focus')).toBeNull();
  });

  it('disables the action once the toast is leaving', () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    render(<ToastHost />);
    act(() => toast('Post hidden leaving', { action: { label: 'undo', onClick } }));
    const button = screen.getByRole('button', { name: 'undo' });

    act(() => vi.advanceTimersByTime(6050));
    expect(button).toBeDisabled();
    fireEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });

  it('drops a toast action when the signed-in account changes', () => {
    const onClick = vi.fn();
    act(() => useAuthStore.setState({ user: { id: 'user-a', username: 'a' } } as never));
    render(<ToastHost />);
    act(() => toast('Post hidden account', { action: { label: 'undo', onClick } }));
    act(() => toast('plain note'));

    act(() => useAuthStore.setState({ user: { id: 'user-b', username: 'b' } } as never));

    expect(screen.queryByRole('button', { name: 'undo' })).toBeNull();
    expect(screen.queryByText('Post hidden account')).toBeNull();
    expect(onClick).not.toHaveBeenCalled();
  });
});
