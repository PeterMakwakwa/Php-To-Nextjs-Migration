import { z } from "zod";

/**
 * The raw article shape as the legacy PHP API actually returns it — every known field
 * variant is optional and loosely typed. This is the anti-corruption boundary: nothing
 * outside `lib/legacy` should ever see this type.
 *
 * `slug` is the only field we require, because URLs are built from it.
 */
const looseBoolean = z.union([z.boolean(), z.number(), z.string()]).nullish();
const looseText = z.string().nullish();

export const RawArticleSchema = z.object({
  id: z.union([z.number(), z.string()]).nullish(),
  article_id: z.union([z.number(), z.string()]).nullish(),
  slug: z.string().trim().min(1),

  title: looseText,
  headline: looseText,
  summary: looseText,
  body: looseText,
  content: looseText,
  author: looseText,
  author_name: looseText,

  published_at: z.union([z.string(), z.number()]).nullish(),
  date: z.union([z.string(), z.number()]).nullish(),
  created: z.union([z.string(), z.number()]).nullish(),
  publish_date: z.union([z.string(), z.number()]).nullish(),

  is_published: looseBoolean,
  published: looseBoolean,
  featured: looseBoolean,

  tags: z.union([z.string(), z.array(z.string())]).nullish(),
  tag_list: z.union([z.string(), z.array(z.string())]).nullish(),
});

export type RawArticle = z.infer<typeof RawArticleSchema>;
