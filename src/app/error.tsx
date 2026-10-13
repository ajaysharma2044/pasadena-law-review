"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="content" className="app-page narrow">
      <h1>Something went wrong</h1>
      <p className="lede">The page couldn’t be loaded. Nothing you entered was lost by this error.</p>
      <p>
        <button type="button" className="button" onClick={() => reset()}>
          Try again
        </button>
      </p>
    </main>
  );
}
