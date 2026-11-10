# Routing

## Route composition

`src/app.js` mounts the central router at:

```text
/api/{API_VERSION}
```

The default `API_VERSION` is `v1`. `src/routes/index.js` imports feature routers and mounts them under domain prefixes such as `/auth`, `/organizations`, `/courses`, and `/matching`.

Feature route files define HTTP methods, relative paths, middleware and controller handlers.

## Route conventions

- Use HTTP methods according to the operation's semantics.
- Keep routes grouped by business module.
- Validate route parameters, query strings and request bodies at the route boundary.
- Put authentication and authorization before the controller.
- Keep controllers focused on HTTP adaptation and delegate business rules to services.
- Register new feature routers in `src/routes/index.js`.

## API prefix

With defaults, a route such as `router.post("/login", ...)` in `auth.routes.js` becomes:

```text
POST /api/v1/auth/login
```

The version is configurable; documentation examples use `/api/v1`.

## Route inventory

The [OpenAPI file](../07-api-reference/openapi.yaml) and [API reference index](../07-api-reference/README.md) provide the generated inventory. Route-level authorization should always be confirmed in the source file before relying on a summary.

## Duplicate route warning

The organization-admin dashboard routers currently register `GET /reports/activity` and `GET /reports/assessment-performance` in both route files mounted at `/organization-admin`. This is recorded in [known limitations](../12-reference/known-limitations.md) and should be resolved in the source in a separate reviewed code change.
