/**
 * The logging interface the app depends on (think `ILogger<T>`): code asks for a logger by scope and
 * never touches `console` directly, so output format, level and destination are decided in one place.
 */

export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

/** Structured fields attached to an entry, e.g. `{ slug, status }`. Errors are serialized with their stack. */
export type LogContext = Record<string, unknown>;

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}
