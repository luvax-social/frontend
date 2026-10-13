import { Link } from 'react-router-dom';

import { v } from '@/config/tokens';
import { ROUTES } from '@/config/constants';
import { LxIcon } from '@/components/ui/lx-icon';

/**
 * A full-page "not available" state. Rendered when a signed-in reviewer reaches
 * a route their role does not include, instead of an empty table or a control
 * that fires a 403. The route is genuinely unreachable: the screen behind it
 * never mounts.
 */
export function NotAvailable({
  title = 'not available',
  message = 'this area is not part of your panel.',
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: '80px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 999,
          background: v.surface,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LxIcon name="lock" size={22} color={v.ink2} />
      </div>
      <div style={{ fontFamily: v.fontDisplay, fontSize: 20, fontWeight: 700, color: v.ink }}>
        {title}
      </div>
      <div style={{ fontFamily: v.fontBody, fontSize: 14, color: v.ink2, maxWidth: 360 }}>
        {message}
      </div>
      <Link
        to={ROUTES.ADMIN_REPORTS}
        style={{
          fontFamily: v.fontBody,
          fontSize: 14,
          color: v.accentText,
          textDecoration: 'none',
        }}
      >
        back to reports
      </Link>
    </div>
  );
}
