"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

/**
 * Shown when the legacy API is slow (timed out), down, or returns bad data and there is
 * no cached copy to fall back on. Covers both the list and the article pages.
 */
export default function ArticlesError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    // In production the message is redacted; `digest` links this to the server log entry.
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="state-panel">
      <h1>Articles are temporarily unavailable</h1>
      <p className="muted">
        We couldn&apos;t reach our content service. This is usually brief — please try again in a moment.
      </p>
      <button type="button" className="button" onClick={() => retry()}>
        Try again
      </button>
    </div>
  );
}
