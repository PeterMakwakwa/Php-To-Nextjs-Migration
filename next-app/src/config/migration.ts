import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { createLogger } from "@/lib/logging";
import deployedMigrationFile from "../../migration.json";
import { env } from "./env";

/**
 * Which article slugs Next.js owns. The single source of truth is `migration.json` (path configurable
 * with MIGRATION_FILE): reviewed in pull requests like code, but re-read while the app runs, so
 * migrating or rolling back a page takes effect on the next request, with no restart or redeploy.
 *
 * Think `IOptionsMonitor<T>` over a JSON file with `reloadOnChange: true`.
 */

const MigrationFileSchema = z.object({
  migratedSlugs: z.array(z.string()),
});

const NOTHING_MIGRATED: ReadonlySet<string> = new Set();

const log = createLogger("migration");

/** Validates a parsed migration file and normalises case and whitespace. Throws on an invalid shape. */
function toSlugSet(value: unknown): ReadonlySet<string> {
  const { migratedSlugs } = MigrationFileSchema.parse(value);
  return new Set(migratedSlugs.map((slug) => slug.trim().toLowerCase()).filter(Boolean));
}

/** Parses the migration file's contents. Throws on invalid content. */
export function parseMigrationFile(contents: string): ReadonlySet<string> {
  return toSlugSet(JSON.parse(contents));
}

/**
 * The list as it was when the app was built, bundled into every module that uses this file. It is the
 * fallback until the live file has been read successfully. Reading the file "at startup" instead would not
 * work: Next.js loads the proxy and the pages as separate module instances, on first use, so a startup read
 * would land in a copy they never see. An invalid migration.json fails the build here, before deploy.
 */
export const DEPLOYED_MIGRATED_SLUGS: ReadonlySet<string> = toSlugSet(deployedMigrationFile);

export type MigrationList = {
  /** The current migrated slugs. Cheap enough to call on every request. */
  current(): ReadonlySet<string>;
};

/**
 * A migration list backed by a JSON file. Each call checks the file's modification time (one `stat`)
 * and only re-reads the file when it changed. A timer-based cache is not an option: Cache Components
 * forbids `Date.now()` while prerendering, and pages call this during prerender.
 *
 * Failure handling: a missing or invalid file never changes what is served.
 * - Before the first successful read, `fallback` applies (in the app: the list deployed with the build),
 *   so a file broken before the first request does not roll back every migrated page.
 * - After that, an invalid edit keeps the last good list.
 * - With an empty fallback and no good read, nothing is migrated and legacy serves every article, which is
 *   always safe because legacy still owns all content.
 */
export function createMigrationList(
  filePath: string,
  fallback: ReadonlySet<string> = NOTHING_MIGRATED,
): MigrationList {
  let lastGood: ReadonlySet<string> = fallback;
  let loadedVersion: number | null = null;
  let failedVersion: number | null = null;

  return {
    current() {
      let version: number;
      try {
        version = statSync(filePath).mtimeMs;
      } catch (error) {
        return fallBack(-1, "Cannot read the migration file", error);
      }

      if (version === loadedVersion || version === failedVersion) {
        return lastGood;
      }

      try {
        lastGood = parseMigrationFile(readFileSync(filePath, "utf8"));
        loadedVersion = version;
        failedVersion = null;
        return lastGood;
      } catch (error) {
        return fallBack(version, "Invalid migration file", error);
      }
    },
  };

  function fallBack(version: number, problem: string, error: unknown): ReadonlySet<string> {
    // Log once per broken version of the file, not on every request.
    if (version !== failedVersion) {
      failedVersion = version;
      const outcome =
        loadedVersion !== null
          ? "keeping the last good list"
          : lastGood.size > 0
            ? "using the list deployed with the build"
            : "serving every article from legacy";
      log.error(`${problem}; ${outcome}`, { file: filePath, migratedSlugs: [...lastGood], error });
    }
    return lastGood;
  }
}

// `turbopackIgnore`: the file is read at runtime, so the bundler must not trace the whole project for it.
const migrationList = createMigrationList(
  path.resolve(/* turbopackIgnore: true */ process.cwd(), env.MIGRATION_FILE),
  DEPLOYED_MIGRATED_SLUGS,
);

/** The slugs Next.js owns right now. */
export function getMigratedSlugs(): ReadonlySet<string> {
  return migrationList.current();
}

export function isMigrated(slug: string, slugs: ReadonlySet<string> = getMigratedSlugs()): boolean {
  return slugs.has(slug.toLowerCase());
}

/** Builds the legacy URL for a request, keeping the path and query string untouched. */
export function toLegacyUrl(pathname: string, search: string, origin: string = env.LEGACY_ORIGIN): URL {
  return new URL(`${pathname}${search}`, origin);
}
