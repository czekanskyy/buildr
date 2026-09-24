export type RateLimitResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly retryAfterSeconds: number };

/**
 * Counts attempts per key. `hit` records one attempt and says whether it may go on. The bundled
 * implementation lives in one process's memory; behind several serverless instances supply one
 * backed by a shared store (Redis, ...) through the `forms.rateLimiter` option.
 */
export interface RateLimiter {
  hit(key: string): RateLimitResult | Promise<RateLimitResult>;
}

export interface MemoryRateLimiterOptions {
  /** Attempts allowed per window. */
  readonly limit: number;
  readonly windowMs: number;
  /** Replaceable clock, for tests. */
  readonly now?: () => number;
}

/** Entries kept at most: a flood of distinct keys cannot grow the map without bound. */
const MAX_KEYS = 10_000;

/** A fixed-window counter in memory. Each call creates an independent limiter (no shared state). */
export function createMemoryRateLimiter(options: MemoryRateLimiterOptions): RateLimiter {
  const now = options.now ?? Date.now;
  const windows = new Map<string, { count: number; resetAt: number }>();
  return {
    hit(key) {
      const at = now();
      if (windows.size >= MAX_KEYS) {
        for (const [candidate, window] of windows) {
          if (window.resetAt <= at) windows.delete(candidate);
        }
        // Still full of live windows: drop the oldest ones.
        for (const candidate of windows.keys()) {
          if (windows.size < MAX_KEYS) break;
          windows.delete(candidate);
        }
      }
      const current = windows.get(key);
      if (current === undefined || current.resetAt <= at) {
        windows.set(key, { count: 1, resetAt: at + options.windowMs });
        return { allowed: true };
      }
      current.count += 1;
      if (current.count <= options.limit) return { allowed: true };
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - at) / 1000)),
      };
    },
  };
}
