import Link from "next/link";

export default function NotFound() {
  return (
    <main id="content" className="app-page narrow">
      <h1>Page not found</h1>
      <p className="lede">
        There’s nothing published at this address. It may not be published yet, or it may have been taken down.
      </p>
      <p>
        <Link href="/">Front page</Link> · <Link href="/journal">The Journal</Link> · <Link href="/forum">Forum</Link>
      </p>
    </main>
  );
}
