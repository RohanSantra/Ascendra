# Request validation

## Zod-based validation

Feature modules define schemas in `*.validation.js` files. Routes attach the shared `validateRequest` middleware from `src/middleware/validate.middleware.js`.

The middleware accepts a schema and options selecting request sections:
- `body`
- `params`
- `query`
- `headers`

At least one section must be enabled.

## Validated request data

The middleware builds an object containing only selected request sections, parses it asynchronously with `schema.parseAsync()`, and merges parsed values into:

```js
req.validated = {
    ...(req.validated || {}),
    ...validatedData
};
```

Controllers should prefer `req.validated.body`, `req.validated.params`, `req.validated.query`, or `req.validated.headers` for sections validated by the route.

## Validation errors

Zod issues are converted to `AppError` with HTTP 422 and `VALIDATION_ERROR`. Details contain a `field` path and human-readable `message`.

## Adding validation

1. Define a Zod schema next to the module.
2. Use explicit schemas for body, params and query as needed.
3. Attach `validateRequest` before the controller.
4. Read validated values in the controller.
5. Test accepted values, invalid values, missing required fields, and unknown-key behavior according to the schema's Zod configuration.

## Do not

- Trust `req.body` without validation on routes that require it.
- Assume a schema validates a request section that was not enabled.
- Duplicate validation logic in controllers when the route already validates it.
- Document fields that are not in the actual schema.
