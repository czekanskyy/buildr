import type { z } from 'zod';
import { errorResponseSchema } from '../contract.ts';

/**
 * A call that did not come to an answer the caller can act on: no network, a `5xx`, `401`/`403`/
 * `404`, a body that breaks the contract. (A `409` or `422` of a save is a value, not this.)
 */
export class AdapterError extends Error {
  readonly status: number | undefined;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AdapterError';
    this.status = status;
  }
}

export interface HttpOptions {
  /** Payload's API root, e.g. `/api` or `https://cms.example.com/api`. */
  readonly baseUrl: string;
  /** Defaults to the global `fetch` (looked up per call, so tests can replace it). */
  readonly fetch?: typeof globalThis.fetch | undefined;
  /** Cookies travel with a same-origin request by default; use `include` for a cross-origin CMS. */
  readonly credentials?: 'same-origin' | 'include' | 'omit' | undefined;
}

export interface Reply {
  readonly status: number;
  readonly body: unknown;
}

export interface Http {
  /** `path` is relative to `baseUrl` (`/buildr/session`). Never rejects for an HTTP status, only for the network. */
  send(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    init?: { readonly query?: Record<string, string | undefined>; readonly body?: unknown },
  ): Promise<Reply>;
}

const trimEnd = (value: string): string => value.replace(/\/+$/, '');

export function createHttp(options: HttpOptions): Http {
  const base = trimEnd(options.baseUrl);
  return {
    async send(method, path, init = {}) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(init.query ?? {})) {
        if (value !== undefined) params.set(key, value);
      }
      const search = params.toString();
      const url = `${base}${path}${search === '' ? '' : `?${search}`}`;
      const body = init.body;
      const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
      let response: Response;
      try {
        const doFetch = options.fetch ?? globalThis.fetch;
        response = await doFetch(url, {
          method,
          credentials: options.credentials ?? 'same-origin',
          headers: body === undefined || isForm ? {} : { 'content-type': 'application/json' },
          ...(body === undefined
            ? {}
            : { body: isForm ? (body as FormData) : JSON.stringify(body) }),
        });
      } catch (error) {
        throw new AdapterError(error instanceof Error ? error.message : 'The request failed.');
      }
      const text = await response.text().catch(() => '');
      let parsed: unknown;
      if (text !== '') {
        try {
          parsed = JSON.parse(text);
        } catch {
          if (response.ok) throw new AdapterError('The response is not JSON.', response.status);
        }
      }
      return { status: response.status, body: parsed };
    },
  };
}

/** The message of an `{ error }` body, else a generic one. */
export function errorOf(reply: Reply): AdapterError {
  const parsed = errorResponseSchema.safeParse(reply.body);
  return new AdapterError(
    parsed.success ? parsed.data.error : `The server answered ${reply.status}.`,
    reply.status,
  );
}

/** The body of a successful reply, checked against the contract; anything else is an `AdapterError`. */
export function expectBody<S extends z.ZodType>(
  reply: Reply,
  schema: S,
  accepted: readonly number[] = [200],
): z.infer<S> {
  if (!accepted.includes(reply.status)) throw errorOf(reply);
  const parsed = schema.safeParse(reply.body);
  if (!parsed.success) {
    throw new AdapterError('The response does not match the contract.', reply.status);
  }
  return parsed.data;
}
