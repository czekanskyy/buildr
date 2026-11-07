/** Keep this wire contract identical to the payload verifier; compute only on the client. */
export async function captchaCData(layoutRef: string, formNodeId: string): Promise<string> {
  const bytes = new TextEncoder().encode(
    JSON.stringify(['buildr/captcha', 1, layoutRef, formNodeId]),
  );
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
