# Security Policy

## Reporting a vulnerability

Please use this repository's **Security → Report a vulnerability** flow
(GitHub private security advisories). Do not open a public issue containing
secrets, exploit details, wallet addresses, or user data.

If private advisories are unavailable, open a minimal public issue asking for a
private contact channel; do not include the sensitive details.

## Supported versions

Security fixes target the latest published release and the current `main`
branch. Older releases may not receive fixes.

## Response

Maintainers aim to acknowledge a report within 7 days and to provide a status
update after triage. This is a best-effort open-source project; there is no bug
bounty or guaranteed response time.

## Scope

In scope:

- TapeRelay client upload/read/delete flows
- Encrypted file format, key handling, and session authorization
- Object lifecycle, manifests, and release behavior
- Client source, verification scripts, and build scripts in this repository

Out of scope:

- Worker server, D1 control plane, and Cloudflare configuration
- Relay operator infrastructure and third-party RPC/storage providers
- Android shell, Web frontend, user devices, and social engineering

Never include private keys, seed phrases, session tokens, or exported browser
profiles in a report.
