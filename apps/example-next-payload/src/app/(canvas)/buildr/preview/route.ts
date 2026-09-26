import { createPreviewRoute } from '@next-buildr/next/draft';
import { LOCALES } from '../../../../buildr.registry.ts';
import { isSignedIn } from '../../../../lib/auth.ts';

// `/buildr/preview?path=/blog/x&locale=en`: draft mode for a signed-in editor, then the page.
export const GET = createPreviewRoute({
  authorize: (request) => isSignedIn(request.headers),
  defaultPath: '/',
  locales: LOCALES,
});
