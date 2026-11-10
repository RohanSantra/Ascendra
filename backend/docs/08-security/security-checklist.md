# Security checklist

This checklist distinguishes controls visible in the repository from operational practices that must be supplied by the deployment environment.

## Before production

- [ ] Set `NODE_ENV=production`.
- [ ] Use strong, independently generated access and refresh JWT secrets.
- [ ] Store secrets in a secret manager or protected deployment environment, not in Git.
- [ ] Configure the exact trusted frontend origin in `CLIENT_URL`.
- [ ] Use HTTPS at the public edge and secure production cookies.
- [ ] Use a transaction-capable MongoDB replica set/cluster.
- [ ] Restrict database network access and use least-privilege database credentials.
- [ ] Confirm organization-scoped services filter every resource query by `org`.
- [ ] Confirm role checks are applied to every privileged route.
- [ ] Confirm upload type, size, ownership and storage access rules.
- [ ] Configure shared rate-limit storage if running multiple backend instances.
- [ ] Configure log retention, monitoring, alerting and backup procedures.
- [ ] Reconcile the MIT `LICENSE` and ISC package metadata before distribution.
- [ ] Review the known route duplication and other open limitations.

## Implemented controls visible in source

- Helmet security headers; Express `X-Powered-By` disabled.
- CORS restricted to configured `CLIENT_URL`.
- Global request rate limiter and request timeout.
- Request body size limits.
- Zod request validation.
- bcrypt password hashing.
- Bearer JWT authentication with persisted session validation.
- HTTP-only refresh-token cookie.
- Refresh-token and invitation-token hashes stored rather than raw token values.
- Organization membership and role middleware.
- Organization reference validation helper.
- Centralized error handling that hides unexpected internal details.
- Request ID correlation and safe logging conventions.

## Controls that require deployment configuration or further review

The repository does not configure a hosted WAF, distributed rate-limit store, secret manager, centralized log platform, alerting provider, backup service, or disaster-recovery process. Do not describe these as implemented.

## Incident response basics

1. Preserve relevant request IDs and safe log metadata.
2. Revoke affected sessions where account/token compromise is suspected.
3. Rotate compromised secrets through the deployment environment.
4. Review database access and organization scoping for affected records.
5. Avoid copying tokens, passwords, or sensitive personal data into issue trackers.
