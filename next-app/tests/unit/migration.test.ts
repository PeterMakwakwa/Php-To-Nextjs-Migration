import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  createMigrationList,
  DEPLOYED_MIGRATED_SLUGS,
  getMigratedSlugs,
  isMigrated,
  parseMigrationFile,
  toLegacyUrl,
} from "@/config/migration";

describe("parseMigrationFile", () => {
  it("parses the slug list, normalising case and whitespace", () => {
    expect(parseMigrationFile('{ "migratedSlugs": [" Hello-NextJS", "typescript-tips ", ""] }')).toEqual(
      new Set(["hello-nextjs", "typescript-tips"]),
    );
  });

  it.each(["not json", "{}", '{ "migratedSlugs": "hello-nextjs" }'])("rejects %j", (contents) => {
    expect(() => parseMigrationFile(contents)).toThrow();
  });
});

describe("createMigrationList", () => {
  let dir: string;
  let file: string;
  let version = 0;

  // Explicit, increasing modification times: writes within the same millisecond would otherwise look unchanged.
  const write = (contents: string) => {
    writeFileSync(file, contents);
    version += 1;
    utimesSync(file, version, version);
  };
  const slugs = (...values: string[]) => JSON.stringify({ migratedSlugs: values });

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "migration-"));
    file = path.join(dir, "migration.json");
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it("picks up edits to the file without a restart", () => {
    write(slugs("a"));
    const list = createMigrationList(file);
    expect(list.current()).toEqual(new Set(["a"]));

    write(slugs("a", "b")); // migrate a page
    expect(list.current()).toEqual(new Set(["a", "b"]));

    write(slugs("b")); // roll one back
    expect(list.current()).toEqual(new Set(["b"]));
  });

  it("re-reads only when the file changed", () => {
    write(slugs("a"));
    const list = createMigrationList(file);

    expect(list.current()).toBe(list.current());
  });

  it("keeps the last good list when an edit is invalid, and logs it once", () => {
    write(slugs("a"));
    const list = createMigrationList(file);
    list.current();

    write('{ "migratedSlugs": [ "a", ');
    expect(list.current()).toEqual(new Set(["a"]));
    expect(list.current()).toEqual(new Set(["a"]));
    expect(console.error).toHaveBeenCalledTimes(1);

    write(slugs("a", "c")); // fixed
    expect(list.current()).toEqual(new Set(["a", "c"]));
  });

  it("uses the fallback (the deployed list) when the file is broken before the first read", () => {
    const deployed = new Set(["a", "b"]);
    write("not json");
    const list = createMigrationList(file, deployed);

    expect(list.current()).toBe(deployed);
    expect(console.error).toHaveBeenCalledWith(
      "[migration] Invalid migration file; using the list deployed with the build",
      expect.objectContaining({ migratedSlugs: ["a", "b"] }),
    );

    write(slugs("a")); // fixed: the live file wins from now on
    expect(list.current()).toEqual(new Set(["a"]));
  });

  it("uses the fallback when the file is missing", () => {
    const deployed = new Set(["a"]);
    expect(createMigrationList(path.join(dir, "missing.json"), deployed).current()).toBe(deployed);
  });

  it("migrates nothing (legacy serves everything) when there is no fallback and no good read", () => {
    expect(createMigrationList(path.join(dir, "missing.json")).current()).toEqual(new Set());

    write("not json");
    expect(createMigrationList(file).current()).toEqual(new Set());
  });
});

describe("DEPLOYED_MIGRATED_SLUGS", () => {
  it("is migration.json as bundled at build time", () => {
    expect(DEPLOYED_MIGRATED_SLUGS).toEqual(
      new Set(["hello-nextjs", "typescript-tips", "migrating-without-downtime"]),
    );
  });
});

describe("isMigrated", () => {
  it("uses the slugs in migration.json", () => {
    expect([...getMigratedSlugs()]).toEqual([
      "hello-nextjs",
      "typescript-tips",
      "migrating-without-downtime",
    ]);
    expect(isMigrated("hello-nextjs")).toBe(true);
    expect(isMigrated("php-legacy-patterns")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isMigrated("Hello-NextJS")).toBe(true);
  });

  it("supports an injected slug set", () => {
    expect(isMigrated("x", new Set(["x"]))).toBe(true);
  });
});

describe("toLegacyUrl", () => {
  it("keeps the path and query string exactly as requested", () => {
    expect(
      toLegacyUrl("/articles/php-legacy-patterns", "?utm_source=mail&ref=a%20b", "http://legacy:8000").href,
    ).toBe("http://legacy:8000/articles/php-legacy-patterns?utm_source=mail&ref=a%20b");
  });
});
