import type { ReactNode } from 'react';
import { v } from '@/config/tokens';

/**
 * The page header shared by every panel screen: a display title and an optional
 * one-line description, with an optional slot on the right for a screen-level
 * control. Kept small and consistent so a reviewer moving between screens sees
 * the same heading shape everywhere.
 */
export function PageHeader({ title, right }: { title: ReactNode; right?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 20,
        flexWrap: 'wrap',
      }}
    >
      <h1
        style={{
          margin: 0,
          minWidth: 0,
          fontFamily: v.fontDisplay,
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: v.ink,
        }}
      >
        {title}
      </h1>
      {right ? <div style={{ flexShrink: 0 }}>{right}</div> : null}
    </div>
  );
}

/** A framed card used to group a region on a detail screen. */
export function PanelCard({
  title,
  right,
  children,
  padded = true,
}: {
  title?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  padded?: boolean;
}) {
  return (
    <section className="lx-admin-panel-card" style={{ marginBottom: 20 }}>
      {title ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 16px',
            borderBottom: `1px solid ${v.border}`,
          }}
        >
          <span
            style={{
              fontFamily: v.fontMono,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: v.ink2,
            }}
          >
            {title}
          </span>
          {right ?? null}
        </div>
      ) : null}
      <div style={{ padding: padded ? 16 : 0 }}>{children}</div>
    </section>
  );
}
