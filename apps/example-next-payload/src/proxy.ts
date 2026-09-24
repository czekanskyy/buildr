import { createLocaleMiddleware } from '@buildr/next';
import { NextResponse } from 'next/server';
import { DEFAULT_LOCALE, LOCALES } from './buildr.registry.ts';

const locale = createLocaleMiddleware({ locales: LOCALES, default: DEFAULT_LOCALE });

// `/` goes to `/{locale}` by Accept-Language; nothing else depends on a header, so pages stay cacheable.
export function proxy(request: Request) {
  return locale(request) ?? NextResponse.next();
}

export const config = { matcher: '/' };
