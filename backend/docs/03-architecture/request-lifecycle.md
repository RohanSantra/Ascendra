# Request lifecycle

## Global middleware order

The order in `src/app.js` is significant:

1. Disable Express `X-Powered-By`.
2. Helmet security headers (CSP disabled because the service is an API).
3. Request ID assignment.
4. CORS.
5. Response compression.
6. Global rate limiter (15-minute window, maximum 300 requests per client key under the configured default store).
7. Request timeout (30 seconds).
8. JSON body parsing (500 KB limit).
9. URL-encoded body parsing (500 KB limit).
10. Cookie parsing.
11. Versioned feature routers under `/api/{API_VERSION}`.
12. Not-found handler.
13. Centralized error handler.

## Typical protected organization request

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant Express as Global Express middleware
    participant Router as Feature router
    participant Auth as authenticate
    participant Org as loadOrganizationMembership
    participant Role as authorizeRoles
    participant Validate as validateRequest
    participant Controller
    participant Service
    participant Model as Mongoose / MongoDB
    Client->>Express: HTTP request + Bearer token + X-Organization-Id
    Express->>Express: request ID, CORS, compression, rate limit, timeout, parsers
    Express->>Router: Match /api/v1 feature route
    Router->>Auth: Verify access token and persisted session
    Auth->>Org: Attach authenticated user context
    Org->>Org: Resolve active organization and approved membership
    Org->>Role: Attach orgId, membershipId and role
    Role->>Validate: Check allowed organization role
    Validate->>Validate: Parse selected body/params/query with Zod
    Validate->>Controller: Attach req.validated
    Controller->>Service: Invoke business operation
    Service->>Model: Read/write organization-scoped documents
    Model-->>Service: Database result
    Service-->>Controller: Domain result
    Controller-->>Client: ApiResponse success
```

The sequence is representative of routes that use all these middleware layers. Public routes, platform-admin routes, and authenticated routes without organization membership have different chains.

## Authentication context

`authenticate` reads `Authorization: Bearer <token>`, verifies the access JWT, checks the persisted session, loads the user, verifies active account status, and checks whether the token predates a password change. It attaches `req.user` with global identity and platform role.

## Organization context

`loadOrganizationMembership` reads `X-Organization-Id`, validates the ObjectId, loads an active organization, finds the user's membership, and requires approved status. It then attaches `orgId`, `membershipId`, and organization `role` to `req.user`.

## Validation

`validateRequest(schema, options)` can validate body, params, query, and headers. Parsed data is stored in `req.validated`. Controllers should use validated values rather than re-reading untrusted request sections.

## Success and failure

Successful controllers use `ApiResponse` helpers. Errors are forwarded to `errorHandler`, which normalizes known Mongoose, duplicate-key, and parsing errors, hides internal error details, logs unexpected failures, and returns the standard error envelope.

## Request IDs

The request ID middleware accepts a syntactically valid UUID from `X-Request-ID` or creates a new UUID. It stores it on `req.requestId` and returns it in the response header and response envelope.
