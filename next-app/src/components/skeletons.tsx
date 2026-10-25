import type { CSSProperties } from "react";

function Bar({
  width = "100%",
  height,
}: {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
}) {
  return <div className="skeleton-bar" style={{ width, height }} />;
}

export function ArticleListSkeleton() {
  return (
    <div role="status" aria-label="Loading articles" className="skeleton-list">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="card skeleton-card">
          <Bar width="66%" height="1.5rem" />
          <Bar />
          <Bar width="33%" />
        </div>
      ))}
    </div>
  );
}

export function ArticleSkeleton() {
  return (
    <div role="status" aria-label="Loading article" className="skeleton-article">
      <Bar width="75%" height="2.25rem" />
      <Bar width="33%" />
      <Bar />
      <Bar />
      <Bar width="83%" />
    </div>
  );
}
