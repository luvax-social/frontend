import { useNavigate } from 'react-router-dom';

import { authApi } from '@/api/authApi';
import { ROUTES } from '@/config/constants';
import { useAuthStore } from '@/store/useAuthStore';

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // We still clear local auth state even if the backend cookie is already gone.
    } finally {
      logout();
      navigate(ROUTES.LOGIN, { replace: true });
    }
  };

  return (
    <main className="dashboard-page">
      <section className="dashboard-card">
        <p className="dashboard-card__eyebrow">Dashboard</p>
        <h1>Welcome to Luvax.</h1>
        <p className="dashboard-card__copy">
          You are signed in as{' '}
          <strong>{user?.email || user?.username || user?.name || 'a Luvax member'}</strong>.
        </p>
        <dl className="dashboard-card__details">
          <div>
            <dt>Name</dt>
            <dd>{user?.name || 'Not provided'}</dd>
          </div>
          <div>
            <dt>Username</dt>
            <dd>{user?.username || 'Not provided'}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user?.email || 'Not provided'}</dd>
          </div>
        </dl>
        <button className="dashboard-card__logout" onClick={handleLogout}>
          Log out
        </button>
      </section>
    </main>
  );
}
