# Authentication API

All paths below are relative to `/api/v1` by default.

| Method | Endpoint | Access | Behavior |
|---|---|---|---|
| POST | `/auth/register` | Public | Registers a global user account |
| POST | `/auth/login` | Public | Authenticates a user and establishes a session |
| POST | `/auth/forgot-password` | Public; route-specific rate limit | Requests a password-reset email when an active account exists |
| POST | `/auth/reset-password` | Public | Resets a password using a single-use email token |
| POST | `/auth/refresh` | Refresh cookie required | Rotates refresh credentials |
| POST | `/auth/logout` | Refresh cookie used for revocation | Revokes the current session |
| POST | `/auth/logout-all` | Bearer access token | Revokes all sessions for the authenticated user |
| GET | `/auth/me` | Bearer access token | Retrieves the authenticated user's profile |
| PATCH | `/auth/change-password` | Bearer access token | Changes the authenticated user's password |

## Token handling

Access tokens are JWTs containing the subject user ID and session ID. Refresh tokens contain session identity and a unique token identifier. The raw refresh token is stored in an HTTP-only cookie and its SHA-256 hash is stored in the session document.

The default refresh cookie is named `refreshToken`, has `httpOnly: true`, uses `sameSite: "lax"`, and is marked secure in production. Its path is `/api/{API_VERSION}/auth`, where `API_VERSION` defaults to `v1`. The cookie name, expiry and max age are configurable.

## Password reset

The forgot-password endpoint has a dedicated limit of five requests per 15 minutes. Password-reset tokens are represented by a hash and expiry in `PasswordResetToken`; do not store or log raw reset tokens.

## Request and response schemas

The authoritative schemas are in `src/modules/auth/auth.validation.js`. The controller and service determine cookie behavior and response payloads. Refer to the [OpenAPI specification](openapi.yaml) for route-level security metadata, and inspect the source before implementing a client.
