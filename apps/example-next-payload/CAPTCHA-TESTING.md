# Captcha build-output check

Run these commands from this app directory (PowerShell or any shell):

```powershell
pnpm check:captcha-secret:build --build-only
pnpm check:captcha-secret
```

The dependency-free wrapper builds Next.js with exactly these four test values:
`TURNSTILE_SITE_KEY=1x00000000000000000000AA`,
`TURNSTILE_SECRET_KEY=buildr-captcha-client-leak-test-secret`,
`CAPTCHA_HOSTNAMES=localhost`, and `CLIENT_IP_HEADER=x-real-ip`.
It writes `.next/captcha-sentinel.json` only after a successful build, tied to that
build's `BUILD_ID`. The scanner requires this provenance; a plain `pnpm build`
cannot pass, even if it contains no secret. Use the wrapper rather than setting env
variables manually. `pnpm check:captcha-secret:build` builds and scans in one command.

Before inspecting output, the scanner plants the sentinel in temporary files for
all eight supported text extensions and requires its own scanner to detect each.
It then recursively reports file counts for:

- `.next/static`: every file, including client chunks, source maps and other assets.
- `.next/server/app`: all `.html`, `.rsc`, `.body`, `.meta`, `.json`, `.js`, `.txt`
  and `.map` files, including prerendered HTML, RSC payloads and route content.
- `.next/server/pages`: the same text extensions for Pages Router output.

No content-bearing subdirectories are excluded. An absent optional Pages Router
directory reports zero files. Missing or empty static output fails. Leaks report
artifact paths only. The marker contains an intentionally public test sentinel,
never a production credential. A different scanner argument must match the marker;
the wrapper deliberately uses the fixed sentinel above.

To verify rejection, run `pnpm build` without the four captcha variables, then
`pnpm check:captcha-secret`: it must fail with
"build was not made with the captcha sentinel env; run the documented command".
Restore the sentinel build with the two-command sequence above afterwards.

For a manual challenge test, use the
[published Cloudflare dummy key pair](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).
The example requires a proxy that overwrites the configured client IP header and
prevents direct access to the origin. `hops: 1` selects the rightmost address.
The app's unit tests do not build Next.js or start Payload.
