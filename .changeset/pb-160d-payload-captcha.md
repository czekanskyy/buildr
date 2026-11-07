---
"@next-buildr/payload": minor
---

Add forms.captcha for server-side Turnstile verification and forms.clientIp for trusted client address selection. Captcha verification has a separate bounded per-IP limiter, IPv6 /64 buckets, concurrency limits and a five-second deadline. Invalid tokens log once at warn; unavailable/configuration failures log at error through the request logger, including before onInit. Existing host onInit hooks remain chained.

The author field name buildr-captcha is now reserved: a published form containing an author field with this name answers 503, whether or not the form has a captcha block (HTML submissions use the existing invalid redirect).

The new optional `failClosed` flag on memory rate limiter options makes a full limiter reject new keys instead of evicting; the default is unchanged.
