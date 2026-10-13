import type { MouseEventHandler, ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { LxIcon } from '@/components/ui/lx-icon';
import { v } from '@/config/tokens';

import './AuthPage.css';

/**
 * The outcome page for an authentication flow that ended somewhere other than
 * signed in.
 *
 * It reuses the auth surface's own centred-card composition - `lx-shell`,
 * `lx-col`, `lx-card`, `lx-head` - rather than inventing a second one, so an
 * outcome looks like the page the person just came from.
 *
 * `tone` changes only the badge, never the layout:
 *
 *   calm    - nothing went wrong. The person chose this, or it simply did not
 *             finish. Drawn in the ink tone, with no alarm.
 *   problem - something actually failed and the person needs to know. Drawn in
 *             the error tone.
 *
 * A cancelled sign-in is `calm`. Treating a deliberate choice as an error is
 * the thing this component exists to stop.
 *
 * Nothing here ever renders a server message, an error code, or an exception.
 * The caller passes a sentence written for a person; the mapping from a
 * backend code to that sentence happens at the call site and is exhaustive, so
 * an unrecognised code falls through to a generic sentence rather than being
 * printed.
 */
export interface NoticeOutcome {
  tone: 'calm' | 'problem';
  icon?: string;
  title: string;
  message: string;
}
interface NoticeProps extends NoticeOutcome {
  actions: {
    label: string;
    to?: string;
    primary?: boolean;
    onClick?: MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
  }[];
  children?: ReactNode;
}

export function AuthNotice({
  tone = 'calm',
  icon,
  title,
  message,
  actions,
  children,
}: Omit<NoticeProps, 'tone'> & { tone?: NoticeOutcome['tone'] }) {
  const isProblem = tone === 'problem';

  return (
    <div className="lx-shell">
      <div className="lx-col lx-enter">
        <div className="lx-card">
          <div
            className="lx-sent-badge"
            style={isProblem ? { background: v.errorDim } : undefined}
            aria-hidden="true"
          >
            <LxIcon
              name={icon ?? (isProblem ? 'alert' : 'mail')}
              size={22}
              color={isProblem ? v.errorText : v.ink2}
            />
          </div>

          <div className="lx-head">
            <h1 className="lx-h2">{title}</h1>
            <p className="lx-sub">{message}</p>
          </div>

          {children}

          {/* Every outcome offers a way onward. A page that states a failure and
              leaves the person with nothing to press is the dead end this
              replaces. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {actions.map((action) =>
              action.to ? (
                <Link
                  key={action.label}
                  to={action.to}
                  className={action.primary ? 'lx-btn-primary' : 'lx-btn-secondary'}
                  style={{ textAlign: 'center', textDecoration: 'none' }}
                >
                  {action.label}
                </Link>
              ) : (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={action.primary ? 'lx-btn-primary' : 'lx-btn-secondary'}
                >
                  {action.label}
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
