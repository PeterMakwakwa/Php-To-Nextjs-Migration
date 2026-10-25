/**
 * The normalized article model used everywhere in the app.
 * Only plain, serializable values (no `Date` objects) so it can safely cross
 * cache and Server → Client Component boundaries.
 */
export type Article = {
  id: string;
  slug: string;
  title: string;
  /** Always present: the legacy summary, or an excerpt derived from the body. */
  summary: string;
  /** Body split into paragraphs; legacy bodies are plain text with blank-line separators. */
  paragraphs: string[];
  author: string | null;
  /** ISO 8601 timestamp, or `null` when legacy had no parseable date. */
  publishedAt: string | null;
  isPublished: boolean;
  isFeatured: boolean;
  /** Lower-case, trimmed, de-duplicated. */
  tags: string[];
};
