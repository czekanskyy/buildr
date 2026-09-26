# Security Policy

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, use GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability):
open the **Security** tab on this repository and click **Report a vulnerability**. This opens a
private draft security advisory visible only to you and the maintainers, with room to attach
proof-of-concept code or logs without disclosing the issue publicly.

If you're unable to use that flow, email czekanski.dominik@proton.me with the same details.

Please include:

- A description of the vulnerability and its impact.
- Steps to reproduce, or a minimal proof of concept.
- The affected package(s) and version(s), if known.

## Response Targets

- **Acknowledgement**: within 72 hours of the report.
- We'll keep you updated as we investigate, and credit you in the advisory (unless you'd prefer
  to stay anonymous) once a fix ships.

## Supported Versions

Buildr 1.0.0 is the first stable release (see [the roadmap](docs/roadmap.md)). Only the latest published version of each `@buildr/*` package is supported with
security fixes.

## Scope

See [`docs/security.md`](docs/security.md) for the project's threat model and the mitigations
already built into the architecture.
