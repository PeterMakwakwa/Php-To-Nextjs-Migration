"use client"; // Error boundaries must be Client Components

/** Last-resort boundary for errors in the root layout. Renders its own document. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "4rem 1rem" }}>
        <title>Something went wrong</title>
        <h1>Something went wrong</h1>
        <p>Please try again.</p>
        <button type="button" onClick={() => retry()}>
          Try again
        </button>
      </body>
    </html>
  );
}
