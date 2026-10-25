import { z } from "zod";

/**
 * Typed, validated environment configuration — the TypeScript equivalent of
 * `IOptions<T>` with `ValidateOnStart()`. Invalid values fail fast at startup
 * with a readable message instead of surfacing as odd runtime behaviour.
 *
 * Contains no secrets, so it is safe to import from `next.config.ts` and `proxy.ts`.
 */
const EnvSchema = z.object({
  /** Origin of the legacy PHP app (API + legacy HTML pages). */
  LEGACY_ORIGIN: z
    .url()
    .default("http://localhost:8000")
    .transform((url) => url.replace(/\/+$/, "")),
  /** How long to wait for the legacy API before giving up. */
  LEGACY_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  /** JSON file listing the migrated slugs, relative to the app directory. Re-read when it changes. */
  MIGRATION_FILE: z.string().trim().min(1).default("migration.json"),
  /** Public origin of this app, used for canonical URLs and Open Graph metadata. */
  SITE_URL: z.url().default("http://localhost:3000"),
  /** Lowest log level written by the server-side logger. */
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "silent"]).default("info"),
  /** `pretty` or `json`; when unset, `json` in production (`next start`) and `pretty` otherwise. */
  LOG_FORMAT: z.enum(["pretty", "json"]).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export const env = loadEnv();
