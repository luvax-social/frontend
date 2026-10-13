import type { ReactNode } from 'react';
import { v } from '@/config/tokens';
import { LxIcon } from '@/components/ui/lx-icon';
import { LxBtn } from '@/features/luvax/components/primitives';

/**
 * Derived pattern: the four list states. The design export defines none of
 * them, so these are derived and used identically everywhere a list renders:
 * populated (the caller's own content), empty, loading, and failed.
 *
 * An empty state is worded as the healthy steady state where it is one; the
 * caller supplies the copy, so an empty report queue reads as "nothing waiting"
 * rather than as a failure.
 */

const Centered = ({ children }: { children?: ReactNode }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: '56px 24px',
      textAlign: 'center',
    }}
  >
    {children}
  </div>
);

export function EmptyState({
  icon = 'check',
  title,
  hint,
}: {
  icon?: string;
  title?: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <Centered>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          background: v.surface,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LxIcon name={icon} size={20} color={v.ink2} />
      </div>
      <div style={{ fontFamily: v.fontBody, fontSize: 15, fontWeight: 500, color: v.ink }}>
        {title}
      </div>
      {hint ? (
        <div style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink2, maxWidth: 340 }}>
          {hint}
        </div>
      ) : null}
    </Centered>
  );
}

export function LoadingState({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label="loading" style={{ padding: '8px 0' }}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          style={{
            height: 52,
            margin: '0 16px',
            borderBottom: `1px solid ${v.borderSubtle}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: '38%',
              height: 12,
              borderRadius: 6,
              background: v.surface,
              animation: 'lx-fade-in var(--duration-normal) var(--ease-out)',
            }}
          />
          <div style={{ width: '18%', height: 12, borderRadius: 6, background: v.surface }} />
          <div style={{ width: '14%', height: 12, borderRadius: 6, background: v.surface }} />
        </div>
      ))}
    </div>
  );
}

export function FailedState({
  message,
  onRetry,
}: {
  message?: ReactNode;
  onRetry?: () => unknown;
}) {
  return (
    <Centered>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          background: v.errorDim,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LxIcon name="alert" size={20} color={v.errorText} />
      </div>
      <div style={{ fontFamily: v.fontBody, fontSize: 15, fontWeight: 500, color: v.ink }}>
        something went wrong
      </div>
      {message ? (
        <div style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink2, maxWidth: 340 }}>
          {message}
        </div>
      ) : null}
      {onRetry ? (
        <LxBtn variant="secondary" size="sm" onClick={onRetry}>
          try again
        </LxBtn>
      ) : null}
    </Centered>
  );
}
