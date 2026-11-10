# Troubleshooting

## Startup reports a missing environment variable

`src/config/env.js` requires `CLIENT_URL`, `MONGODB_URI`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET`. Check that `.env` exists in the working directory from which the process starts and that values are non-empty.

## MongoDB connection fails

- Confirm the MongoDB process or managed cluster is reachable.
- Check the URI, credentials, network allowlist, and database name.
- Check that the deployment supports transactions if a workflow uses them.
- The initial connection uses finite server-selection and connect timeouts; inspect the startup log for the underlying error.

## Transaction / replica-set errors

Multi-document transactions require a replica set or a transaction-capable MongoDB deployment. A standalone local MongoDB process will not support those operations. Configure a local single-node replica set or use a suitable managed cluster.

## CORS errors in the browser

`CLIENT_URL` is the single configured allowed origin in `src/app.js`. It must match the browser origin, including scheme and port. The application enables credentials and explicitly permits `X-Organization-Id` and `Authorization`.

## Authentication returns 401

- Send the access token in `Authorization: Bearer <token>`.
- Confirm the token is not expired.
- Confirm its persisted session exists, is active, unrevoked, and unexpired.
- A password change can invalidate older access tokens through `passwordChangedAt`.
- Refresh-token operations use the configured cookie name and cookie settings.

## Organization access returns 400 or 403

Organization-scoped routes require `X-Organization-Id`. The ID must be a valid MongoDB ObjectId; the organization must exist and be active; the user must have an approved membership and an allowed role.

## Validation returns 422

Inspect the validation schema used by the route. Validation errors include field paths and messages in the standard error structure. The validated request data is attached to `req.validated`.

## Duplicate-key errors

MongoDB error code `11000` is normalized to a conflict response. Inspect the model's unique index and the values used by the test or request. Do not remove a unique index merely to suppress a test failure.

## Email does not arrive

Check SMTP host, port, secure mode, username, password, sender identity, provider restrictions, and application logs. Do not log credentials or email tokens.

## Course-material upload fails

Check Cloudinary configuration, upload intent expiry/status, MIME type and size validation, organization/course access, and the storage adapter implementation.

## Tests fail because of duplicate records

Check test database cleanup and unique indexes. Integration tests share a test database lifecycle; use the helpers in `test/helpers/database.js` and ensure each test creates isolated records or cleans up correctly.

## Need more context?

Use the request ID returned in `X-Request-ID` to correlate a client error with server logs. Do not share access tokens, passwords, or full production connection strings when reporting a problem.
