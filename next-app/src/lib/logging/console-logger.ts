import { LOG_LEVELS, type LogContext, type Logger, type LogLevel } from "./logger";

export type LogFormat = "pretty" | "json";

export type ConsoleLoggerOptions = {
  /** Entries below this level are dropped; `silent` drops everything. */
  minLevel: LogLevel | "silent";
  /** `pretty` for people reading a terminal, `json` (one object per line) for log collectors. */
  format: LogFormat;
};

/**
 * `Logger` that writes to the console (stdout/stderr), where Docker, Kubernetes and hosting platforms
 * collect logs.
 *
 * Entries carry no timestamp: collectors add one, and Cache Components forbids `new Date()` while
 * prerendering, which is when some of these entries are written.
 */
export function createConsoleLogger(scope: string, { minLevel, format }: ConsoleLoggerOptions): Logger {
  const threshold = minLevel === "silent" ? LOG_LEVELS.length : LOG_LEVELS.indexOf(minLevel);

  const write = (level: LogLevel, message: string, context?: LogContext) => {
    if (LOG_LEVELS.indexOf(level) < threshold) {
      return;
    }

    if (format === "json") {
      console[level](JSON.stringify({ level, scope, message, ...context }, serializeErrors));
    } else if (context) {
      console[level](`[${scope}] ${message}`, context);
    } else {
      console[level](`[${scope}] ${message}`);
    }
  };

  return {
    debug: (message, context) => write("debug", message, context),
    info: (message, context) => write("info", message, context),
    warn: (message, context) => write("warn", message, context),
    error: (message, context) => write("error", message, context),
  };
}

/** `JSON.stringify` turns an `Error` into `{}`; keep the fields that matter for debugging. */
function serializeErrors(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack, cause: value.cause };
  }
  return value;
}
