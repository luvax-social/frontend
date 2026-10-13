import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { v } from '@/config/tokens';
import { ROUTES } from '@/config/constants';
import { LxBtn, LxIcon } from './primitives';

/**
 * Shown for an address inside the authenticated area that matches no screen.
 *
 * It renders within the shell so the navigation bar stays in place, states that
 * the content cannot be viewed, and returns the user to their feed shortly
 * after, rather than handing off to the global 404 which reads as a logout.
 */
export function ScreenNotFound() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => navigate(ROUTES.FEED, { replace: true }), 2500);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: 40,
        fontFamily: v.fontBody,
      }}
    >
      <LxIcon name="explore" size={32} color={v.ink3} />
      <div style={{ fontSize: 15, fontWeight: 500, color: v.ink2 }}>
        you cannot view this content
      </div>
      <div style={{ fontSize: 13, color: v.ink3 }}>taking you back to your feed...</div>
      <LxBtn variant="secondary" size="sm" onClick={() => navigate(ROUTES.FEED, { replace: true })}>
        back to feed
      </LxBtn>
    </div>
  );
}
