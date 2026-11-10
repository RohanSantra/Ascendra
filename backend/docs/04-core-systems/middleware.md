# Middleware

## Global middleware

The Express app registers these shared middleware in order:

| Middleware | Responsibility | Configuration |
|---|---|---|
| Helmet | Security response headers | CSP disabled for this API |
| `requestId` | Assign or reuse a UUID correlation ID | `X-Request-ID` |
| CORS | Restrict browser origin and configure credentials/headers | `CLIENT_URL` |
| Compression | Compress eligible responses | Package defaults |
| Rate limiter | Limit request volume | 15 minutes / 300 requests |
| Request timeout | Forward a timeout error for long requests | 30 seconds |
| JSON parser | Parse JSON body | 500 KB |
| URL-encoded parser | Parse form-encoded body | `extended: false`, 500 KB |
| Cookie parser | Parse request cookies | Used by auth refresh/logout flows |
| Not-found handler | Convert unmatched routes to controlled error | After routes |
| Error handler | Normalize and serialize errors | Last middleware |

## Feature middleware

Authentication and organization authorization live under `src/modules/auth/`:
- `authenticate`
- `loadOrganizationMembership`
- `authorizeRoles`
- `authorizePlatformAdmin`

Request validation lives in `src/middleware/validate.middleware.js`.

## Middleware ordering

A route's middleware order is part of its security contract. Typical organization-admin routes authenticate first, load membership second, authorize role third, validate input, and finally invoke the controller. Public and platform-admin routes intentionally use different chains.

## Adding middleware

- Keep shared technical middleware under `src/middleware/`.
- Keep domain-specific authorization near the relevant domain when it depends on domain rules.
- Ensure middleware forwards errors with `next(error)` or uses the existing async wrapper.
- Add unit tests for both pass and reject paths.
- Update [request lifecycle](../03-architecture/request-lifecycle.md) if global ordering changes.
