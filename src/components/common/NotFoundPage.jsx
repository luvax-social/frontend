import { Link, Navigate } from 'react-router-dom';

import { ROUTES } from '@/config/constants';
import { useAuthStore } from '@/store/useAuthStore';
import RouteMetadata from './RouteMetadata';

export default function NotFoundPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // A signed-in user who mistypes a top-level address should not be pushed back
  // to the login page, which reads as a forced logout. They are sent into the
  // app instead, where the shell keeps the navigation bar and shows an
  // in-context notice before returning them to their feed.
  if (isAuthenticated) {
    return <Navigate to={`${ROUTES.APP}/not-found`} replace />;
  }

  return (
    <main className="not-found-page">
      <RouteMetadata error />
      <p>404</p>
      <h1>That page does not exist.</h1>
      <Link to={ROUTES.LOGIN}>Back to authentication</Link>
    </main>
  );
}
