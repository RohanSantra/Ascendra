# ADR 0004: Zod request validation and centralized errors

- Status: Accepted (current-state record)
- Date: 2026-11-10

## Context

Feature modules accept HTTP input and need consistent validation and error responses.

## Decision

Feature validation schemas use Zod and are applied through `validateRequest`. Parsed sections are attached to `req.validated`. Expected application failures use `AppError`; the global error middleware normalizes known errors and returns a standard error envelope.

## Alternatives considered

The repository does not record a formal comparison with alternative validation libraries or error-handling designs.

## Consequences

- Validation is declared at the route boundary.
- Controllers can consume parsed values from `req.validated`.
- Mongoose validation, casting, duplicate-key and malformed JSON errors are normalized centrally.
- Unexpected 5xx details are hidden from API clients.
- New modules should reuse the established patterns.

## References

- `src/middleware/validate.middleware.js`
- `src/core/errors/AppError.js`
- `src/middleware/error.middleware.js`
- `src/core/responses/ApiResponse.js`
