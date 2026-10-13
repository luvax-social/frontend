import { useAuthStore } from '@/store/useAuthStore';
import { v } from '@/config/tokens';

export default function SessionRestoreError() {
  const retry = useAuthStore((state) => state.retrySessionRestore);
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="page-loader" role="alert">
      <p>We couldn't restore your session. Check your connection and try again.</p>
      <button
        type="button"
        onClick={retry}
        style={{
          minHeight: 44,
          padding: '10px 20px',
          borderRadius: 999,
          background: v.accent,
          color: v.ink,
        }}
      >
        Try again
      </button>
      <button type="button" onClick={logout} style={{ minHeight: 44, color: v.ink }}>
        Sign in instead
      </button>
    </div>
  );
}
