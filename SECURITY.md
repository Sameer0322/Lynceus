# Security Policy

## Supported versions

Only the latest version on the `master` branch receives security fixes.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, report them privately by opening a [GitHub Security Advisory](../../security/advisories/new).

Include:
- A description of the vulnerability
- Steps to reproduce
- The potential impact
- Any suggested fix (optional)

We aim to acknowledge reports within 72 hours and to release a patch within 14 days for critical issues.

## Scope

In-scope:
- Authentication bypass or privilege escalation in the backend
- JWT secret exposure or forgery
- SQL injection via backend endpoints
- Stored XSS in the frontend
- Sensitive data exposure (e.g., GitHub PAT leaking to the browser)

Out of scope:
- Issues that require physical access to the server
- Issues in third-party dependencies that have no available fix
- Brute-force attacks against a self-hosted instance (rate limiting is the deployer's responsibility)
