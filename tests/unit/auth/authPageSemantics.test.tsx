import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import AuthPage from '@/features/auth/components/AuthPage';

function Address() {
  const location = useLocation();
  return <output aria-label="address">{location.pathname + location.search}</output>;
}

describe('authentication page semantics', () => {
  it('keeps the primary heading inside the main landmark on the mobile form', () => {
    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.closest('main')).not.toBeNull();
    expect(heading.closest('.lx-brand')).toBeNull();
  });

  it('gives registration a main landmark and a shareable view address', () => {
    render(
      <MemoryRouter>
        <AuthPage />
        <Address />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(screen.getByRole('heading', { level: 1 }).closest('main')).not.toBeNull();
    expect(screen.getByLabelText('address')).toHaveTextContent('/?view=register');
  });
});
