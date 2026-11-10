# Shared security mechanisms

This document summarizes security controls configured centrally. Domain-specific rules are covered in [Security](../08-security/security-checklist.md).

## HTTP layer

- Helmet is enabled; CSP is disabled because the service currently serves an API rather than HTML pages.
- Express `X-Powered-By` is disabled.
- CORS permits the configured `CLIENT_URL`, credentials, and a fixed set of methods and headers.
- A global rate limiter allows up to 300 requests per 15-minute window under its configured store.
- JSON and URL-encoded bodies are limited to 500 KB.
- Request processing has a 30-second timeout.

## Authentication

Protected routes use bearer access tokens. The authentication middleware also checks a persisted session and active user status. Refresh tokens are handled through an HTTP-only cookie.

## Organization access

Organization-scoped routes resolve the selected organization from `X-Organization-Id` and require an approved membership. Role checks are explicit middleware.

## Sensitive values

Do not expose internal errors, passwords, tokens, or provider credentials in responses or logs. Reset and invitation token handling is described in the relevant module documents.

## Limitations

The rate limiter uses the default in-memory store. In a multi-instance deployment, use a shared store if a consistent global limit is required. This documentation does not assert that a WAF, DDoS service, secret manager, or centralized security monitoring is configured.
