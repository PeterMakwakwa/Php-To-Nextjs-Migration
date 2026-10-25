import type { Article } from "@/lib/articles/model";
import { formatDate } from "@/lib/format";

type Props = Pick<Article, "author" | "publishedAt" | "tags">;

export function ArticleMeta({ author, publishedAt, tags }: Props) {
  return (
    <div className="meta muted">
      {author && <span>By {author}</span>}
      {publishedAt && <time dateTime={publishedAt}>{formatDate(publishedAt)}</time>}
      {tags.length > 0 && (
        <ul className="tags" aria-label="Tags">
          {tags.map((tag) => (
            <li key={tag} className="tag">
              #{tag}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
