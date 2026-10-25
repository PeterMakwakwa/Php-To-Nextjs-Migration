import type { Metadata } from "next";
import { Suspense } from "react";
import { ArticleCard } from "@/components/article-card";
import { ArticleListSkeleton } from "@/components/skeletons";
import { isMigrated } from "@/config/migration";
import { getArticles } from "@/lib/articles/repository";

export const metadata: Metadata = {
  title: "All articles",
  description: "Browse every article on the platform.",
  alternates: { canonical: "/articles" },
};

export default function ArticlesPage() {
  return (
    <>
      <h1 className="page-title">Articles</h1>
      <Suspense fallback={<ArticleListSkeleton />}>
        <ArticleList />
      </Suspense>
    </>
  );
}

async function ArticleList() {
  const articles = await getArticles();

  if (articles.length === 0) {
    return <p className="muted">No articles have been published yet.</p>;
  }

  return (
    <ul className="article-list">
      {articles.map((article) => (
        <li key={article.id}>
          <ArticleCard article={article} migrated={isMigrated(article.slug)} />
        </li>
      ))}
    </ul>
  );
}
