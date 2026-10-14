import { describe, expect, it, vi } from 'vitest';

import { resetOnUserChange } from '@/features/luvax/store/resetOnUserChange';
import { useAuthStore } from '@/store/useAuthStore';

const signInAs = (id: string) => useAuthStore.setState({ user: { id, username: id } } as never);

describe('resetOnUserChange', () => {
  it('runs the reset when the account changes and not when the same account refreshes', () => {
    const reset = vi.fn();
    signInAs('user-a');
    const stop = resetOnUserChange(reset);

    signInAs('user-a');
    expect(reset).not.toHaveBeenCalled();
    signInAs('user-b');
    expect(reset).toHaveBeenCalledTimes(1);

    stop();
  });

  it('stops running the reset once the returned function is called', () => {
    const reset = vi.fn();
    signInAs('user-a');
    const stop = resetOnUserChange(reset);

    stop();
    signInAs('user-b');

    expect(reset).not.toHaveBeenCalled();
  });
});
