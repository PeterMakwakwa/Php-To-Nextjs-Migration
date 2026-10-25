import { env } from "@/config/env";
import { createConsoleLogger } from "./console-logger";
import type { Logger } from "./logger";

export type { LogContext, Logger, LogLevel } from "./logger";

/**
 * Returns the logger for one area of the app (think `ILogger<ArticleSource>`), configured from
 * LOG_LEVEL and LOG_FORMAT. Server-side only: browser code (error boundaries) keeps using `console`.
 *
 *   const log = createLogger("migration");
 *   log.warn("Invalid migration file", { path, error });
 */
export function createLogger(scope: string): Logger {
  return createConsoleLogger(scope, {
    minLevel: env.LOG_LEVEL,
    format: env.LOG_FORMAT ?? (process.env.NODE_ENV === "production" ? "json" : "pretty"),
  });
}
