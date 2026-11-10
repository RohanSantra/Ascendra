# Sessions

## Purpose

Session records are created and rotated by auth services. Access-token authentication checks the associated persisted session on every protected request.

## Implementation status

**Implemented in the checked-in source.** The scope described below is limited to the files and routes listed here; future extensions should be documented separately until implemented.

## Responsibilities and boundaries

Persisted refresh-token sessions, token rotation, revocation, expiry, and session-aware access-token validation.

This module should own its domain rules. Cross-module workflows should use the existing service/repository conventions and validate that referenced records belong to the same organization where applicable.

## Source files

| Type | Files |
|---|---|
| Model | `src/modules/auth/passwordResetToken.model.js`, `src/modules/auth/user.model.js`, `src/modules/sessions/session.model.js` |
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

### `session`
Defined in `src/modules/sessions/session.model.js`.
Top-level schema fields identified from the current schema declaration: `user`, `refreshTokenHash`, `userAgent`, `ipAddress`, `device`, `lastUsedAt`, `expiresAt`, `isActive`, `revokedAt`, `revokedReason`.
Read the model file for exact types, defaults, nested schema details, validators, indexes, timestamps, and immutable/select behavior before changing the schema.

## API routes

There is no separate sessions router in the current route registry. Session creation, refresh, logout and revocation are exposed through the authentication endpoints documented in [Authentication](authentication.md). The `Session` model is managed by the auth service.

## Main workflow

Auth token creation persists a session with a refresh-token hash. Refresh rotates credentials/session state; logout revokes one session and logout-all revokes a user's active sessions. Authentication checks `isActive`, `revokedAt`, `expiresAt`, and password-change time.

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
