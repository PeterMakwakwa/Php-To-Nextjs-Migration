import "server-only";
import { env } from "@/config/env";
import { createLogger } from "@/lib/logging";

const log = createLogger("legacy-api");

/**
 * Thin, typed HTTP client for the legacy PHP API (think: a typed `HttpClient`).
 * It knows about transport concerns only — timeouts, status codes, JSON — and
 * returns `unknown`; validation and mapping happen in the articles layer.
 */

export type LegacyErrorKind = "timeout" | "unavailable" | "bad-response";

export class LegacyApiError extends Error {
  constructor(
    message: string,
    readonly kind: LegacyErrorKind,
    readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "LegacyApiError";
  }
}

/** GETs a JSON resource. Resolves to `null` on 404; throws `LegacyApiError` otherwise. */
async function getJson(path: string): Promise<unknown | null> {
  const url = `${env.LEGACY_ORIGIN}${path}`;
  let response: Response;

  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(env.LEGACY_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      const message = `Legacy API timed out after ${env.LEGACY_TIMEOUT_MS}ms: ${path}`;
      throw logged(new LegacyApiError(message, "timeout", undefined, { cause: error }));
    }
    throw logged(
      new LegacyApiError(`Legacy API unreachable: ${path}`, "unavailable", undefined, { cause: error }),
    );
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw logged(
      new LegacyApiError(`Legacy API responded ${response.status}: ${path}`, "unavailable", response.status),
    );
  }

  try {
    return await response.json();
  } catch (error) {
    throw logged(
      new LegacyApiError(`Legacy API returned invalid JSON: ${path}`, "bad-response", response.status, {
        cause: error,
      }),
    );
  }
}

export async function fetchRawArticles(): Promise<unknown[]> {
  const payload = await getJson("/api/articles");
  if (!Array.isArray(payload)) {
    throw logged(new LegacyApiError("Legacy article list is not an array", "bad-response"));
  }
  return payload;
}

export async function fetchRawArticle(slug: string): Promise<unknown | null> {
  return getJson(`/api/articles/${encodeURIComponent(slug)}`);
}

/**
 * Logs a failed legacy call and returns the error for throwing. Pages may still be served from cache
 * while legacy fails, so without this a failing background refresh would leave no trace.
 */
function logged(error: LegacyApiError): LegacyApiError {
  log.warn(error.message, { kind: error.kind, status: error.status });
  return error;
}
