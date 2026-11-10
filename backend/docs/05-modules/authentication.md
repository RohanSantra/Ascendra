# Authentication

## Purpose

Owns account registration, login, token refresh, logout, logout-all, password change, password reset, and the authentication middleware that protects downstream routes.

## Implementation status

**Implemented in the checked-in source.** The scope described below is limited to the files and routes listed here; future extensions should be documented separately until implemented.

## Responsibilities and boundaries

User sign-up and sign-in, access-token authentication, refresh-token rotation, logout, password reset, and current-user operations.

This module should own its domain rules. Cross-module workflows should use the existing service/repository conventions and validate that referenced records belong to the same organization where applicable.

## Source files

| Type | Files |
|---|---|
| Model | `src/modules/auth/passwordResetToken.model.js`, `src/modules/auth/user.model.js` |
| Route | `src/modules/auth/auth.routes.js` |
| Controller | `src/modules/auth/auth.controller.js` |
| Service / repository / engine | `src/modules/auth/auth.service.js` |
| Validation | `src/modules/auth/auth.validation.js` |

## Data model

### `passwordResetToken`
Defined in `src/modules/auth/passwordResetToken.model.js`.
Top-level schema fields identified from the current schema declaration: `user`, `tokenHash`, `expiresAt`.
Read the model file for exact types, defaults, nested schema details, validators, indexes, timestamps, and immutable/select behavior before changing the schema.

### `user`
Defined in `src/modules/auth/user.model.js`.
Top-level schema fields identified from the current schema declaration: `firstName`, `lastName`, `email`, `passwordHash`, `phone`, `profileImage`, `platformRole`, `status`, `lastLoginAt`, `passwordChangedAt`.
Read the model file for exact types, defaults, nested schema details, validators, indexes, timestamps, and immutable/select behavior before changing the schema.

## API routes

| Method | Endpoint | Access note | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Public | Registers a new global user account. |
| `POST` | `/api/v1/auth/login` | Public | Authenticates a user. |
| `POST` | `/api/v1/auth/forgot-password` | Public | Sends a password-reset link when an active account exists. |
| `POST` | `/api/v1/auth/reset-password` | Public | Resets a password using a single-use email token. |
| `POST` | `/api/v1/auth/refresh` | Public (refresh cookie required) | Rotates the refresh token. |
| `POST` | `/api/v1/auth/logout` | Public (refresh cookie used for revocation) | Revokes the current session. |
| `POST` | `/api/v1/auth/logout-all` | Private | Revokes all sessions for the authenticated user. |
| `GET` | `/api/v1/auth/me` | Private | Retrieves the authenticated user's profile. |
| `PATCH` | `/api/v1/auth/change-password` | Private | Changes the authenticated user's password. |

These paths include the default `/api/v1` prefix. The prefix is configurable through `API_VERSION`. Access notes are taken from route annotations; confirm the actual middleware chain in the listed route file.

## Main workflow

Registration/login establishes a user identity and session. Access tokens are sent as bearer tokens. Refresh/logout operations use the refresh cookie and persisted session. Password reset uses a token record; password changes affect existing access-token validity.

## Authorization and organization isolation

Authentication is global-user scoped. `authenticate` verifies bearer access token and persisted session. Organization membership is only loaded on routes that explicitly use `loadOrganizationMembership`.

## Validation and errors

Request schemas are defined in: `src/modules/auth/auth.validation.js`. The route specifies which request sections are parsed. Validation errors are returned through the shared 422 error format.
Use `AppError` and shared error codes for expected domain failures. Unexpected failures should flow to centralized error handling.

## Tests

Relevant test files found in the archive:
- `test/integration/auth/auth.routes.integration.test.js`
- `test/integration/auth/auth.service.integration.test.js`
- `test/integration/auth/passwordReset.integration.test.js`
- `test/unit/modules/auth/auth.middleware.test.js`
- `test/unit/modules/auth/auth.utils.test.js`
- `test/unit/modules/auth/authorization.middleware.test.js`
- `test/unit/modules/auth/session.model.test.js`

## Safe extension guidance

1. Read the route, validation schema, controller, service, repository and model before editing.
2. Preserve the distinction between global identity and organization-scoped records.
3. Validate all referenced IDs and confirm they belong to the same organization.
4. Preserve existing lifecycle transitions and historical records.
5. Add positive, negative, authorization and cross-organization tests.
6. Update the API reference and this document when externally observable behavior changes.

## Known limitations and future extensions

Only the implementation present in the listed files is guaranteed. Do not infer background jobs, push delivery, external event processing, advanced analytics, or additional workflow states unless source code explicitly implements them.
