# ADR 0005: Session-aware JWT authentication

- Status: Accepted (current-state record)
- Date: 2026-11-10

## Context

The API uses bearer access tokens but also needs server-side control over active sessions, logout, refresh rotation and password-change invalidation.

## Decision

The backend issues JWT access and refresh tokens. A session record is persisted. The raw refresh token is delivered through an HTTP-only cookie, while a SHA-256 hash is stored in MongoDB. Access-token authentication verifies the JWT and checks the associated session and user state.

## Alternatives considered

No historical comparison of stateless-only JWT or alternative session systems is documented in the repository.

## Consequences

- Access-token validity depends on database session state.
- Logout and logout-all can revoke sessions.
- Refresh-token hashes can be stored without persisting the raw secret.
- Session expiry is also indexed for TTL cleanup, but authorization must explicitly check expiry/revocation.
- Authentication requests depend on MongoDB availability.

## References

- `src/modules/auth/auth.utils.js`
- `src/modules/auth/auth.middleware.js`
- `src/modules/auth/auth.service.js`
- `src/modules/sessions/session.model.js`
