# API conventions

## Base path

`src/app.js` mounts all routes at `/api/${env.app.apiVersion}`. The default version is `v1`.

## Authentication header

Protected routes use:

```http
Authorization: Bearer <access-token>
```

The token is an access JWT associated with a persisted session. A valid JWT without a valid session is not sufficient.

## Organization context

Routes that use `loadOrganizationMembership` require:

```http
X-Organization-Id: <organization ObjectId>
```

The middleware validates organization existence/status and the authenticated user's approved membership. Routes that do not use this middleware do not automatically require this header.

## Request validation

Route-level Zod schemas validate selected sections of the request. Parsed data is attached to `req.validated`. Validation failures return HTTP 422 with field details.

## Successful response envelope

Successful responses use the `ApiResponse` helper and include `success`, `statusCode`, `message`, `data`, `meta`, and `requestId` fields (the exact data/meta vary by endpoint). A 204 response has no body.

## Error response envelope

Errors use `success: false`, `statusCode`, `message`, `error.code`, `error.details`, and `requestId`. Internal 5xx messages are hidden.

## Request correlation

The server returns `X-Request-ID`. A valid incoming UUID may be reused; otherwise the server generates one. Include this value when reporting a server issue.

## Pagination and filtering

List endpoints define their own query schemas. Do not assume that all modules share identical parameter names, defaults, sorting, or metadata. Consult the specific validation schema and service.
