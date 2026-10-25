import type { RawArticle } from "./schemas";
import type { Article } from "@/lib/articles/model";

/**
 * Maps the uneven legacy record onto the clean `Article` model.
 * Pure functions only — no I/O — so every rule is cheap to unit-test.
 */

const SUMMARY_MAX_LENGTH = 160;

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const TRUE_VALUES = new Set(["1", "true", "yes", "y", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "n", "off", ""]);

export function normalizeArticle(raw: RawArticle): Article {
  const paragraphs = splitParagraphs(firstText(raw.body, raw.content));

  return {
    id: String(raw.id ?? raw.article_id ?? raw.slug),
    slug: raw.slug.trim().toLowerCase(),
    title: firstText(raw.title, raw.headline) ?? "Untitled",
    summary: firstText(raw.summary) ?? deriveSummary(paragraphs),
    paragraphs,
    author: firstText(raw.author, raw.author_name),
    publishedAt: parseLegacyDate(raw.published_at ?? raw.date ?? raw.created ?? raw.publish_date),
    // Records without any published flag are treated as published: the legacy API only exposes live content.
    isPublished: parseLegacyBoolean(raw.is_published ?? raw.published) ?? true,
    isFeatured: parseLegacyBoolean(raw.featured) ?? false,
    tags: parseTags(raw.tags ?? raw.tag_list),
  };
}

/** Returns the first value that is a non-blank string, trimmed; otherwise `null`. */
export function firstText(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return null;
}

/** Interprets 1 / "1" / true / "yes" / "true" (and their opposites). Unknown values → `null`. */
export function parseLegacyBoolean(value: boolean | number | string | null | undefined): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (TRUE_VALUES.has(normalized)) return true;
    if (FALSE_VALUES.has(normalized)) return false;
  }
  return null;
}

/**
 * Parses every date format found in the legacy data into an ISO 8601 string (UTC).
 *
 *   2024-03-15                  ISO date                → midnight UTC
 *   15/04/2024                  UK day/month/year       → midnight UTC (legacy is a UK system)
 *   June 20, 2024               long-form English       → midnight UTC
 *   2024-07-01T09:30:00+02:00   ISO 8601 with offset    → exact instant
 *   1717200000                  Unix timestamp (s/ms)   → exact instant
 *
 * Anything unrecognised returns `null` rather than guessing.
 */
export function parseLegacyDate(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" || /^\d{9,13}$/.test(value.trim())) {
    const numeric = Number(value);
    const milliseconds = numeric < 1e12 ? numeric * 1000 : numeric;
    return toIso(new Date(milliseconds));
  }

  const text = value.trim();

  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (isoDate) {
    return utcDate(Number(isoDate[1]), Number(isoDate[2]), Number(isoDate[3]));
  }

  const ukDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (ukDate) {
    return utcDate(Number(ukDate[3]), Number(ukDate[2]), Number(ukDate[1]));
  }

  const longDate = /^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i.exec(text);
  if (longDate) {
    const month = MONTHS.indexOf(longDate[1].toLowerCase()) + 1;
    return month > 0 ? utcDate(Number(longDate[3]), month, Number(longDate[2])) : null;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(text)) {
    return toIso(new Date(text));
  }

  return null;
}

/** Accepts a comma-separated string or an array; trims, lower-cases, drops blanks and duplicates. */
export function parseTags(value: string | string[] | null | undefined): string[] {
  const items = Array.isArray(value) ? value : (value ?? "").split(",");
  const tags = items.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
  return [...new Set(tags)];
}

/** Splits plain-text bodies on blank lines, tolerating Windows (\r\n) line endings. */
export function splitParagraphs(body: string | null): string[] {
  if (!body) {
    return [];
  }
  return body
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

export function deriveSummary(paragraphs: string[]): string {
  const first = paragraphs[0] ?? "";
  if (first.length <= SUMMARY_MAX_LENGTH) {
    return first;
  }
  const cut = first.slice(0, SUMMARY_MAX_LENGTH);
  return `${cut.slice(0, cut.lastIndexOf(" ")).trimEnd()}…`;
}

function utcDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  // Reject impossible dates such as 31/02/2024, which Date would silently roll over.
  const valid =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return valid ? date.toISOString() : null;
}

function toIso(date: Date): string | null {
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
