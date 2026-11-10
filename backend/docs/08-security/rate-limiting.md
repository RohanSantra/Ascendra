# Rate limiting

## Global limiter

`src/app.js` creates a global limiter using `createRateLimiter()` with:
- Window: 15 minutes.
- Maximum: 300 requests.
- Standard rate-limit headers enabled.
- Legacy headers disabled.

The shared helper returns a JSON 429 response with the `RATE_LIMIT_EXCEEDED` error code and request ID.

## Password-reset limiter

`src/modules/auth/auth.routes.js` adds a dedicated limiter to `POST /auth/forgot-password`:
- Window: 15 minutes.
- Maximum: 5 requests.

This is in addition to the global limiter.

## Store limitation

The helper uses express-rate-limit's default in-memory store. That is suitable for a single process but does not share counters across multiple instances or survive restarts. Use a compatible shared store when deploying horizontally, and document the chosen store in deployment configuration.

## Operational notes

Rate limits should be monitored and tuned using actual traffic and abuse patterns. Do not weaken password-reset protection without a security review.
