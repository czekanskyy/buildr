import { headers } from 'next/headers';
import { getPayloadClient } from '../buildr.server.ts';

/** Whether the request comes from a signed-in Payload user (any role may open the builder). */
export async function isSignedIn(requestHeaders?: Headers): Promise<boolean> {
  const payload = await getPayloadClient();
  const { user } = await payload.auth({ headers: requestHeaders ?? (await headers()) });
  return user !== null && user !== undefined;
}
