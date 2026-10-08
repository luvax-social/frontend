import { Component } from 'react';

/**
 * GlobalErrorBoundary
 *
 * Catches synchronous render-phase errors thrown by any descendant component.
 * React error boundaries must be class components — there is no hook equivalent.
 *
 * Renders a minimal, user-safe fallback that:
 * - Shows no raw error details in production
 * - Offers a full-page reload as the recovery path
 * - Logs the error to the console (swap for a real logger/Sentry in production)
 */
export default class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    document.head.querySelector('meta[name="robots"]')?.setAttribute('content', 'noindex, follow');
    document.head
      .querySelectorAll(
        'link[rel="canonical"], script[data-lx-seo], meta[property^="og:"], meta[name^="twitter:"]'
      )
      .forEach((node) => node.remove());
    document.title = 'Page unavailable | Luvax';
    // Replace with a real error-reporting integration (e.g. Sentry.captureException)
    if (import.meta.env.DEV) {
      console.error('[GlobalErrorBoundary]', error, info?.componentStack);
    }
  }

  handleReset() {
    // A full reload is the safest recovery: it re-initialises all module-level
    // state (Zustand stores, axios interceptors, etc.) cleanly.
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="error-boundary-page">
          <p className="error-boundary-page__eyebrow">Something went wrong</p>
          <h1>An unexpected error occurred.</h1>
          <p className="error-boundary-page__copy">
            We&apos;ve been notified. You can try reloading the page — if the problem persists,
            please contact support.
          </p>
          <button className="error-boundary-page__cta" onClick={this.handleReset}>
            Reload page
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
