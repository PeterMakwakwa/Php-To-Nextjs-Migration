import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArticleMeta } from "@/components/article-meta";
import { ArticleSkeleton } from "@/components/skeletons";
import { getMigratedSlugs, isMigrated } from "@/config/migration";
import { getArticle } from "@/lib/articles/repository";

/**
 * Only migrated slugs ever reach this page — the proxy hands every other slug to legacy PHP.
 * Slugs migrated at build time are prerendered, so they are fully static and instant; slugs migrated
 * later (by editing migration.json while the app runs) are rendered and cached on their first request.
 */
export function generateStaticParams() {
  return [...getMigratedSlugs()].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/articles/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const article = isMigrated(slug) ? await getArticle(slug) : null;

  if (!article) {
    return { title: "Article not found" };
  }

  return {
    title: article.title,
    description: article.summary,
    authors: article.author ? [{ name: article.author }] : undefined,
    keywords: article.tags,
    alternates: { canonical: `/articles/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.summary,
      url: `/articles/${article.slug}`,
      publishedTime: article.publishedAt ?? undefined,
      authors: article.author ? [article.author] : undefined,
      tags: article.tags,
    },
  };
}

export default function ArticlePage({ params }: PageProps<"/articles/[slug]">) {
  return (
    <>
      <Link href="/articles" className="back-link subtle-link">
        &larr; All articles
      </Link>
      <Suspense fallback={<ArticleSkeleton />}>
        <ArticleContent params={params} />
      </Suspense>
    </>
  );
}

async function ArticleContent({ params }: Pick<PageProps<"/articles/[slug]">, "params">) {
  const { slug } = await params;

  // Defence in depth: if the proxy were bypassed, never render a second copy of a legacy page.
  if (!isMigrated(slug)) {
    notFound();
  }

  const article = await getArticle(slug);
  if (!article) {
    notFound();
  }

  return (
    <article>
      <header className="article-header">
        <h1 className="article-title">{article.title}</h1>
        <ArticleMeta author={article.author} publishedAt={article.publishedAt} tags={article.tags} />
      </header>
      <div className="article-body">
        {article.paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </article>
  );
}
