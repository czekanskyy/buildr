import { createHash } from 'node:crypto';
import type { BuilderDocument, PageNode } from '@next-buildr/core';
import { z } from 'zod';

export const CAPTCHA_FIELD = 'buildr-captcha';
export const CAPTCHA_ACTION = 'buildr_form';
export const CAPTCHA_TYPE = 'buildr/captcha';
const FORM_TYPE = 'buildr/form';
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TOKEN = /^[A-Za-z0-9._-]{1,2048}$/;
const CODE = /^[a-z0-9-]{1,64}$/;
const MAX_RESPONSE_BYTES = 16 * 1024;

export type CaptchaVerification =
  | { ok: true; hostname: string; action: string; cdata: string }
  | { ok: false; reason: 'invalid' | 'expired-or-reused' | 'unavailable'; log?: CaptchaLog };

export interface CaptchaVerifier {
  verify(input: { token: string; signal: AbortSignal }): Promise<CaptchaVerification>;
}

export const isCaptchaToken = (token: unknown): token is string =>
  typeof token === 'string' && TOKEN.exec(token)?.[0] === token;

/** Shared with the widget: hash the UTF-8 JSON tuple, never a request-derived layout reference. */
export function captchaCData(layoutRef: string, formNodeId: string): string {
  return createHash('sha256')
    .update(JSON.stringify([CAPTCHA_TYPE, 1, layoutRef, formNodeId]), 'utf8')
    .digest('hex');
}

export interface CaptchaGate {
  tryAcquire(): (() => void) | null;
}

/** Each plugin instance owns its gate. Releases are idempotent (deadline and finally may race). */
export function createCaptchaGate(maxInFlight: number): CaptchaGate {
  let active = 0;
  return {
    tryAcquire() {
      if (active >= maxInFlight) return null;
      active += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        active -= 1;
      };
    },
  };
}

const responseSchema = z.object({
  success: z.boolean(),
  'error-codes': z.array(z.string()).optional(),
  hostname: z.string().optional(),
  action: z.string().optional(),
  cdata: z.string().optional(),
});
type CaptchaLog = {
  reason: 'configuration' | 'invalid' | 'expired-or-reused' | 'unavailable';
  codes: readonly string[];
};
const unavailable = (): CaptchaVerification => ({ ok: false, reason: 'unavailable' });

/** A fixed origin and bounded, abortable response reader keep secret-bearing requests contained. */
export function createTurnstileVerifier(options: {
  secretKey: string;
  fetch?: typeof globalThis.fetch;
  log?: (entry: CaptchaLog) => void;
}): CaptchaVerifier {
  const fetcher = options.fetch ?? globalThis.fetch;
  return {
    async verify({ token, signal }) {
      if (!isCaptchaToken(token)) return { ok: false, reason: 'invalid' };
      if (signal.aborted) return unavailable();
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      let onAbort: () => void = () => {};
      const cancelled = new Promise<CaptchaVerification>((resolve) => {
        onAbort = () => {
          void reader?.cancel().catch(() => {});
          resolve(unavailable());
        };
        signal.addEventListener('abort', onAbort, { once: true });
      });
      const run = async (): Promise<CaptchaVerification> => {
        try {
          const response = await fetcher(SITEVERIFY, {
            method: 'POST',
            body: new URLSearchParams({ secret: options.secretKey, response: token }),
            redirect: 'error',
            cache: 'no-store',
            signal,
          });
          if (!response.ok || response.body === null || signal.aborted) {
            void response.body?.cancel().catch(() => {});
            return unavailable();
          }
          reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let size = 0;
          while (true) {
            const chunk = await reader.read();
            if (signal.aborted) return unavailable();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > MAX_RESPONSE_BYTES) {
              void reader.cancel().catch(() => {});
              return unavailable();
            }
            chunks.push(chunk.value);
          }
          const bytes = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
          }
          const parsed = responseSchema.safeParse(
            JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
          );
          if (!parsed.success) return unavailable();
          const body = parsed.data;
          if (body.success) {
            if (typeof body.hostname !== 'string' || typeof body.action !== 'string')
              return unavailable();
            return {
              ok: true,
              hostname: body.hostname,
              action: body.action,
              cdata: body.cdata ?? '',
            };
          }
          const codes = body['error-codes'] ?? [];
          const config =
            codes.includes('missing-input-secret') || codes.includes('invalid-input-secret');
          const reason =
            config || codes.includes('internal-error')
              ? 'unavailable'
              : codes.includes('timeout-or-duplicate')
                ? 'expired-or-reused'
                : 'invalid';
          const log: CaptchaLog = {
            reason: config ? 'configuration' : reason,
            codes: codes
              .filter(
                (code) =>
                  CODE.exec(code)?.[0] === code &&
                  !code.includes(token) &&
                  !code.includes(options.secretKey),
              )
              .slice(0, 10),
          };
          options.log?.(log);
          return { ok: false, reason, ...(options.log === undefined ? { log } : {}) };
        } catch {
          return unavailable();
        }
      };
      try {
        return await Promise.race([run(), cancelled]);
      } finally {
        signal.removeEventListener('abort', onAbort);
      }
    },
  };
}

/** Literal graph traversal: registry metadata and render-time conditions cannot waive a challenge. */
export function formSubtreeNodes(snapshot: BuilderDocument, formNodeId: string): PageNode[] {
  const visited = new Set<string>();
  const stack = [formNodeId];
  const nodes: PageNode[] = [];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || visited.has(id)) continue;
    visited.add(id);
    const node = Object.hasOwn(snapshot.nodes, id) ? snapshot.nodes[id] : undefined;
    if (node === undefined || (id !== formNodeId && node.type === FORM_TYPE)) continue;
    if (id !== formNodeId) nodes.push(node);
    for (const children of Object.values(node.slots ?? {})) {
      for (const child of children) stack.push(child);
    }
  }
  return nodes;
}

export function findFormCaptchas(snapshot: BuilderDocument, formNodeId: string): PageNode[] {
  return formSubtreeNodes(snapshot, formNodeId).filter((node) => node.type === CAPTCHA_TYPE);
}

/** All reverse edges count, including corrupt multiple-parent graphs; cycles cannot hide an ancestor. */
export function ancestorFormHasCaptcha(snapshot: BuilderDocument, formNodeId: string): boolean {
  const parents = new Map<string, string[]>();
  for (const [id, node] of Object.entries(snapshot.nodes)) {
    for (const children of Object.values(node.slots ?? {})) {
      for (const child of children) {
        const list = parents.get(child);
        if (list === undefined) parents.set(child, [id]);
        else list.push(id);
      }
    }
  }
  const visited = new Set([formNodeId]);
  const stack = [...(parents.get(formNodeId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || visited.has(id)) continue;
    visited.add(id);
    const node = Object.hasOwn(snapshot.nodes, id) ? snapshot.nodes[id] : undefined;
    if (node?.type === FORM_TYPE && findFormCaptchas(snapshot, id).length > 0) return true;
    for (const parent of parents.get(id) ?? []) stack.push(parent);
  }
  return false;
}
