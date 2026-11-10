# Authentication and authorization

## Authentication

The `authenticate` middleware in `src/modules/auth/auth.middleware.js`:

1. Requires `Authorization: Bearer <access-token>`.
2. Verifies the JWT signature, issuer and audience.
3. Requires subject user ID, session ID and issued-at timestamp.
4. Loads a matching active, unrevoked, unexpired `Session`.
5. Loads the user and requires active account status.
6. Rejects access tokens issued before `passwordChangedAt`.
7. Attaches global identity and `platformRole` to `req.user`.

A JWT is not accepted solely because its signature is valid; the database session and user state are also checked.

## Refresh and logout

Refresh tokens are signed separately from access tokens. The raw refresh token is delivered in an HTTP-only cookie; the session stores a SHA-256 hash. Refresh/logout operations read the configured cookie. Session records include expiry and revocation state.

## Authorization

Authorization is layered:

- `authorizePlatformAdmin` checks the global `platformRole`.
- `loadOrganizationMembership` establishes organization context and requires an approved membership.
- `authorizeRoles("admin", "trainer", "trainee")` checks the organization role.

Use the narrowest applicable middleware chain. Do not infer an organization role from the platform role.

## Password handling

Passwords are hashed with bcryptjs using `BCRYPT_SALT_ROUNDS` (default 12). Password-reset tokens are represented by hashes and expiry. Do not log raw passwords or tokens.

## Source references

- `src/modules/auth/auth.utils.js`
- `src/modules/auth/auth.middleware.js`
- `src/modules/auth/authorization.middleware.js`
- `src/modules/auth/auth.service.js`
- `src/modules/sessions/session.model.js`
- `src/modules/auth/passwordResetToken.model.js`
