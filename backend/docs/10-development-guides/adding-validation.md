# Adding validation

## Schema location

Define Zod schemas in the owning module's `*.validation.js` file. Export named schemas for route use and tests.

## Middleware integration

The shared middleware is `validateRequest` from `src/middleware/validate.middleware.js`.

Example:

```js
router.patch(
    "/:id",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin"),
    validateRequest(updateExampleSchema, {
        params: true,
        body: true
    }),
    updateExampleController
);
```

The schema receives an object containing the enabled request sections. Parsed output is attached to `req.validated`.

## Controller usage

```js
const { id } = req.validated.params;
const input = req.validated.body;
```

Only read a section from `req.validated` if the route enabled and schema validated it.

## Validation errors

Zod issues are normalized to HTTP 422 and include a field path and message. Do not manually return a separate validation response format.

## Test cases

Test required values, type mismatch, string formats, min/max constraints, enums, optional/null distinctions, nested arrays/objects and unknown-key behavior. Confirm the schema's actual Zod settings rather than assuming unknown fields are stripped or rejected.
