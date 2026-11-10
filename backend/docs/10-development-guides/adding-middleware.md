# Adding middleware

## Decide where it belongs

- Put reusable HTTP infrastructure under `src/middleware/`.
- Keep domain authorization close to the domain that owns the rule.
- Keep authentication and organization membership middleware under `src/modules/auth/`, where the current implementation lives.

## Middleware contract

An Express middleware receives `(req, res, next)`. It should either complete the response or call `next()` / `next(error)` exactly as appropriate.

For asynchronous middleware, follow the project's `asyncHandler` convention or Express 5's async error propagation pattern used by neighboring code.

## Safe implementation checklist

1. Define one clear responsibility.
2. Validate configuration arguments at creation time.
3. Avoid mutating unrelated request properties.
4. Use a documented request-context property when attaching data.
5. Never log credentials or raw tokens.
6. Forward expected failures as `AppError`.
7. Add tests for pass, reject, thrown error, and response-already-started cases where relevant.
8. Register global middleware in `src/app.js` only when it truly applies to all routes.
9. Document ordering requirements; middleware order can change security behavior.
