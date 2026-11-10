# Error handling

## Controlled errors

Use `AppError` for expected application failures:

```js
throw new AppError(
    "The requested resource was not found.",
    HTTP_STATUS.NOT_FOUND,
    ERROR_CODES.RESOURCE_NOT_FOUND
);
```

The constructor accepts a message, HTTP status, application error code, optional details, and optional underlying cause. Status codes must be integers from 400 through 599. `isOperational` distinguishes expected application failures from unexpected errors.

## Error normalization

`src/middleware/error.middleware.js` recognizes:

- Existing `AppError` instances.
- Mongoose validation errors → 422 validation errors.
- Mongoose cast errors → 400 invalid parameter.
- MongoDB duplicate-key errors (`11000`) → 409 conflict.
- Malformed JSON → 400.
- Oversized request bodies → 413.

Unknown errors remain unexpected internal failures.

## Response behavior

The global handler:
- Delegates to Express if headers have already been sent.
- Uses controlled status/message/code/details for operational errors.
- Returns a generic `Internal server error` message for 5xx failures.
- Logs unexpected failures with request context.
- Avoids logging request bodies, credentials, or tokens.
- Includes the request ID in the response.

## Not-found behavior

`notFoundHandler` creates a controlled `ROUTE_NOT_FOUND` error. It is registered after routes and before the global error handler.

## Developer rules

- Use `AppError` for expected business and input failures.
- Use constants from `src/core/constants/`.
- Preserve the original cause when wrapping a lower-level error where useful.
- Do not return stack traces or database internals to clients.
- Do not catch an error merely to log and swallow it.
- Do not create ad hoc error JSON in controllers.

Source: `src/core/errors/AppError.js`, `src/core/constants/`, `src/middleware/notFound.middleware.js`, and `src/middleware/error.middleware.js`.
