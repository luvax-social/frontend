import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/config/constants';
import { v } from '@/config/tokens';
import { LxIcon, LxTag, LxBtn } from './primitives';

function inputStyle() {
  return {
    width: '100%',
    fontFamily: v.fontBody,
    fontSize: 15,
    color: v.ink,
    background: v.surfaceSunken,
    border: `1px solid ${v.border}`,
    borderRadius: 8,
    padding: '11px 14px',
    // No outline reset: an inline style outranks the stylesheet, so this suppressed the global
    // :focus-visible ring on every field here. The ring is drawn by src/index.css.
    boxSizing: 'border-box',
  };
}

export function OnboardingScreen() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    email: '',
    password: '',
    username: '',
    displayName: '',
    bio: '',
    interests: [],
  });

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => Math.max(0, s - 1));
  const update = (k, val) => setData((d) => ({ ...d, [k]: val }));
  const toggleInterest = (i) =>
    setData((d) => ({
      ...d,
      interests: d.interests.includes(i) ? d.interests.filter((x) => x !== i) : [...d.interests, i],
    }));

  const steps = [
    // 0 — welcome
    {
      validate: () => true,
      render: () => (
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
          <div
            style={{
              fontFamily: v.fontDisplay,
              fontSize: 72,
              fontWeight: 800,
              color: v.ink,
              letterSpacing: '-0.04em',
              lineHeight: 0.95,
              marginBottom: 16,
            }}
          >
            luvax
          </div>
          <p
            style={{
              fontFamily: v.fontBody,
              fontSize: 17,
              color: v.ink2,
              lineHeight: 1.5,
              maxWidth: 320,
              margin: '0 auto 40px',
              letterSpacing: '-0.01em',
            }}
          >
            a light-first social network.
            <br />
            pure social, no noise.
          </p>
          <LxBtn variant="primary" size="lg" onClick={next} style={{ minWidth: 200 }}>
            get started
          </LxBtn>
          <div style={{ marginTop: 16, fontFamily: v.fontBody, fontSize: 13, color: v.ink3 }}>
            already have an account?{' '}
            <span
              style={{ color: v.ink, cursor: 'pointer', fontWeight: 500 }}
              onClick={() => navigate(ROUTES.FEED)}
            >
              sign in
            </span>
          </div>
        </div>
      ),
    },
    // 1 — email + password
    {
      validate: () => data.email.includes('@') && data.password.length >= 8,
      render: () => (
        <div>
          <h1
            style={{
              fontFamily: v.fontDisplay,
              fontSize: 30,
              fontWeight: 700,
              color: v.ink,
              letterSpacing: '-0.02em',
              marginBottom: 4,
            }}
          >
            create your account
          </h1>
          <p style={{ fontFamily: v.fontBody, fontSize: 14, color: v.ink2, marginBottom: 28 }}>
            start with the basics. you can change everything later.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontFamily: v.fontBody,
                  fontSize: 12,
                  fontWeight: 500,
                  color: v.ink2,
                  marginBottom: 6,
                }}
              >
                email
              </label>
              <input
                type="email"
                value={data.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="you@example.com"
                style={inputStyle()}
              />
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontFamily: v.fontBody,
                  fontSize: 12,
                  fontWeight: 500,
                  color: v.ink2,
                  marginBottom: 6,
                }}
              >
                password
              </label>
              <input
                type="password"
                value={data.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder="at least 8 characters"
                style={inputStyle()}
              />
              <div style={{ fontFamily: v.fontMono, fontSize: 10, color: v.ink3, marginTop: 6 }}>
                {data.password.length >= 8 ? '✓ strong enough' : `${data.password.length}/8`}
              </div>
            </div>
          </div>
        </div>
      ),
    },
    // 2 — username
    {
      validate: () => data.username.length >= 3 && /^[a-z0-9._]+$/.test(data.username),
      render: () => (
        <div>
          <h1
            style={{
              fontFamily: v.fontDisplay,
              fontSize: 30,
              fontWeight: 700,
              color: v.ink,
              letterSpacing: '-0.02em',
              marginBottom: 4,
            }}
          >
            pick a handle
          </h1>
          <p style={{ fontFamily: v.fontBody, fontSize: 14, color: v.ink2, marginBottom: 28 }}>
            this is how people will find you. lowercase letters, numbers, periods, and underscores.
          </p>

          <label
            style={{
              display: 'block',
              fontFamily: v.fontBody,
              fontSize: 12,
              fontWeight: 500,
              color: v.ink2,
              marginBottom: 6,
            }}
          >
            username
          </label>
          <div style={{ position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                fontFamily: v.fontMono,
                fontSize: 14,
                color: v.ink3,
              }}
            >
              @
            </span>
            <input
              value={data.username}
              onChange={(e) => update('username', e.target.value.toLowerCase())}
              placeholder="your.handle"
              style={{ ...inputStyle(), paddingLeft: 30 }}
            />
          </div>
          {data.username.length > 0 && (
            <div
              style={{
                fontFamily: v.fontMono,
                fontSize: 10,
                color:
                  data.username.length >= 3 && /^[a-z0-9._]+$/.test(data.username)
                    ? v.successText
                    : v.errorText,
                marginTop: 6,
              }}
            >
              {data.username.length >= 3 && /^[a-z0-9._]+$/.test(data.username)
                ? '✓ looks good'
                : 'min 3 chars, lowercase only'}
            </div>
          )}

          <div style={{ marginTop: 28 }}>
            <label
              style={{
                display: 'block',
                fontFamily: v.fontBody,
                fontSize: 12,
                fontWeight: 500,
                color: v.ink2,
                marginBottom: 6,
              }}
            >
              display name <span style={{ color: v.ink3, fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              value={data.displayName}
              onChange={(e) => update('displayName', e.target.value)}
              placeholder="what to call you"
              style={inputStyle()}
            />
          </div>
        </div>
      ),
    },
    // 3 — bio
    // The interest picker was removed with the rest of the invented data. The
    // categories were a hardcoded list, nothing stored a selection, and the
    // copy promised the choices would shape the feed. The feed is built from
    // who the viewer follows, so that promise could not be kept.
    {
      validate: () => true,
      render: () => (
        <div>
          <h1
            style={{
              fontFamily: v.fontDisplay,
              fontSize: 30,
              fontWeight: 700,
              color: v.ink,
              letterSpacing: '-0.02em',
              marginBottom: 4,
            }}
          >
            tell people who you are
          </h1>
          <p style={{ fontFamily: v.fontBody, fontSize: 14, color: v.ink2, marginBottom: 24 }}>
            a short bio, if you want one.
          </p>

          <div>
            <label
              style={{
                display: 'block',
                fontFamily: v.fontBody,
                fontSize: 12,
                fontWeight: 500,
                color: v.ink2,
                marginBottom: 6,
              }}
            >
              bio <span style={{ color: v.ink3, fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea
              value={data.bio}
              onChange={(e) => update('bio', e.target.value.slice(0, 160))}
              placeholder="a sentence about you"
              style={{ ...inputStyle(), resize: 'none', minHeight: 64, lineHeight: 1.5 }}
            />
            <div
              style={{
                fontFamily: v.fontMono,
                fontSize: 10,
                color: v.ink3,
                marginTop: 4,
                textAlign: 'right',
              }}
            >
              {160 - data.bio.length}
            </div>
          </div>
        </div>
      ),
    },
    // 4 — done
    {
      validate: () => true,
      render: () => (
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
          <div
            style={{
              fontFamily: v.fontDisplay,
              fontSize: 44,
              fontWeight: 700,
              color: v.ink,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              marginBottom: 16,
            }}
          >
            welcome,
            <br />@{data.username || 'friend'}.
          </div>
          <p
            style={{
              fontFamily: v.fontBody,
              fontSize: 15,
              color: v.ink2,
              lineHeight: 1.5,
              maxWidth: 300,
              margin: '0 auto 40px',
            }}
          >
            we sent a verification link to{' '}
            <strong style={{ color: v.ink }}>{data.email || 'your email'}</strong>. you can keep
            going while you wait.
          </p>
          <LxBtn
            variant="primary"
            size="lg"
            onClick={() => navigate(ROUTES.FEED)}
            style={{ minWidth: 200 }}
          >
            open feed
          </LxBtn>
        </div>
      ),
    },
  ];

  const current = steps[step];

  return (
    <div
      style={{
        // Zoom-corrected: see shell.jsx for why a raw 100vh renders taller than the real
        // viewport inside this app's root-scaled shell.
        minHeight: 'calc(100vh / var(--lx-scale))',
        background: v.base,
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      {/* Progress / back */}
      {step > 0 && step < steps.length - 1 && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', gap: 12 }}>
          <button
            onClick={back}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <LxIcon name="back" size={20} color={v.ink} />
          </button>
          <div style={{ flex: 1, display: 'flex', gap: 4 }}>
            {steps.slice(1, -1).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  background: i + 1 <= step ? v.accent : v.border,
                }}
              />
            ))}
          </div>
          <span style={{ fontFamily: v.fontMono, fontSize: 10, color: v.ink3 }}>
            {step}/{steps.length - 2}
          </span>
        </div>
      )}

      <div style={{ flex: 1, padding: '20px 24px 24px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }}>{current.render()}</div>

        {step > 0 && step < steps.length - 1 && (
          <LxBtn
            variant="primary"
            size="lg"
            onClick={() => (current.validate() ? next() : null)}
            disabled={!current.validate()}
            style={{ marginTop: 24, width: '100%' }}
          >
            {step === steps.length - 2 ? 'finish' : 'continue'}
          </LxBtn>
        )}
      </div>
    </div>
  );
}
