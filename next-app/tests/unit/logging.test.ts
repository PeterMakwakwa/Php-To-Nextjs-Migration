import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createConsoleLogger } from "@/lib/logging/console-logger";

const levels = ["debug", "info", "warn", "error"] as const;

let output: Record<(typeof levels)[number], unknown[][]>;

beforeEach(() => {
  output = { debug: [], info: [], warn: [], error: [] };
  for (const level of levels) {
    jest.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      output[level].push(args);
    });
  }
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("console logger", () => {
  it("writes each level to the matching console method, dropping entries below the minimum", () => {
    const log = createConsoleLogger("test", { minLevel: "info", format: "pretty" });

    log.debug("d");
    log.info("i");
    log.warn("w");
    log.error("e");

    expect(output).toEqual({ debug: [], info: [["[test] i"]], warn: [["[test] w"]], error: [["[test] e"]] });
  });

  it("writes nothing when silent", () => {
    const log = createConsoleLogger("test", { minLevel: "silent", format: "pretty" });

    log.error("e");

    expect(output.error).toEqual([]);
  });

  it("passes context through as-is in pretty format", () => {
    const error = new Error("boom");
    createConsoleLogger("migration", { minLevel: "debug", format: "pretty" }).error("Failed", { error });

    expect(output.error).toEqual([["[migration] Failed", { error }]]);
  });

  it("writes one JSON object per entry in json format, keeping error details", () => {
    const error = new Error("boom", { cause: "disk" });
    createConsoleLogger("legacy-api", { minLevel: "debug", format: "json" }).warn("Timed out", {
      status: 504,
      error,
    });

    const entry = JSON.parse(output.warn[0][0] as string);
    expect(entry).toEqual({
      level: "warn",
      scope: "legacy-api",
      message: "Timed out",
      status: 504,
      error: { name: "Error", message: "boom", stack: expect.stringContaining("boom"), cause: "disk" },
    });
  });
});
