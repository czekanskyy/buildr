import type { Diagnostic } from '@next-buildr/core';
import type { ErrorResponse, InvalidResponse } from '../../contract.ts';

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export const fail = (status: number, error: string): Response =>
  json({ error } satisfies ErrorResponse, status);

export const unauthorized = (): Response => fail(401, 'Authentication is required.');
export const notFound = (what: string): Response => fail(404, `${what} was not found.`);
export const conflict = (currentRevision: number): Response => json({ currentRevision }, 409);

/** The contract carries plain JSON; a diagnostic detail that is not JSON never gets here. */
export const invalid = (diagnostics: readonly Diagnostic[]): Response =>
  json({ diagnostics } as InvalidResponse, 422);
