import Link from "next/link";

export default function ArticleNotFound() {
  return (
    <div className="state-panel">
      <h1>Article not found</h1>
      <p className="muted">It may have been moved or unpublished.</p>
      <Link href="/articles">Browse all articles</Link>
    </div>
  );
}
