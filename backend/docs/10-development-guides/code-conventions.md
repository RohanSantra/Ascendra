# Code conventions

These conventions summarize patterns visible in the repository. Follow the closest existing module when a detail differs.

## JavaScript

- Use ES modules (`import` / `export`).
- Use `.js` extensions in relative imports.
- Use descriptive camelCase names for variables and functions.
- Use PascalCase for classes and Mongoose model names.
- Keep feature code grouped under `src/modules/<feature>/`.

## Module layering

- Routes define method/path and middleware.
- Controllers adapt HTTP request/response.
- Services own business rules.
- Repositories are used where they clarify database operations.
- Models define persistence constraints.
- Validation schemas define accepted request data.

Do not create empty layers solely to satisfy a template.

## Errors and responses

- Use `AppError` for expected application failures.
- Use centralized constants for HTTP status and error codes.
- Use `ApiResponse` for successful JSON responses.
- Do not expose stack traces or database internals to clients.

## Async behavior

Use the established async handler/error propagation pattern. Avoid detached promises that can reject without being observed.

## Database access

- Scope organization-owned data by `org`.
- Validate referenced documents and tenant ownership.
- Use sessions consistently inside transaction workflows.
- Keep unique constraints in model indexes when uniqueness must hold under concurrency.

## Tests

Use `node:test` and `node:assert/strict`. Keep tests close to their domain under `test/unit/` and `test/integration/`. Test both allowed and denied behavior.

## Formatting

ESLint configuration is the authoritative style enforcement. Run `npm run lint` before committing. Avoid hand-formatting conventions that conflict with the repository's ESLint rules.
