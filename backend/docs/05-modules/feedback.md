# Feedback

## Purpose

Stores course-related trainee feedback and status updates for administrative handling.

## Implementation status

**Implemented in the checked-in source.** The scope described below is limited to the files and routes listed here; future extensions should be documented separately until implemented.

## Responsibilities and boundaries

Course-related trainee feedback and administrative status handling.

This module should own its domain rules. Cross-module workflows should use the existing service/repository conventions and validate that referenced records belong to the same organization where applicable.

## Source files

| Type | Files |
|---|---|
| Model | `src/modules/feedback/feedback.model.js` |
| Route | `src/modules/feedback/feedback.routes.js` |
| Controller | `src/modules/feedback/feedback.controller.js` |
| Service / repository / engine | `src/modules/feedback/feedback.repository.js`, `src/modules/feedback/feedback.service.js` |
| Validation | `src/modules/feedback/feedback.validation.js` |

## Data model

### `feedback`
Defined in `src/modules/feedback/feedback.model.js`.
Top-level schema fields identified from the current schema declaration: `org`, `course`, `enrollment`, `trainee`, `trainer`, `category`, `rating`, `comment`, `status`, `statusUpdatedBy`, `statusUpdatedAt`.
Read the model file for exact types, defaults, nested schema details, validators, indexes, timestamps, and immutable/select behavior before changing the schema.

## API routes

| Method | Endpoint | Access note | Description |
|---|---|---|---|
| `POST` | `/api/v1/courses/:courseId/feedback` | Trainee | Submits feedback for a completed course. |
| `GET` | `/api/v1/feedback` | Organisation Admin, Trainer, Trainee | Retrieves feedback records within the user's organisation. |
| `GET` | `/api/v1/feedback/:feedbackId` | Organisation Admin, Trainer, Trainee | Retrieves a feedback record. |
| `PATCH` | `/api/v1/feedback/:feedbackId/status` | Organisation Admin | Hides or restores a feedback record. |

These paths include the default `/api/v1` prefix. The prefix is configurable through `API_VERSION`. Access notes are taken from route annotations; confirm the actual middleware chain in the listed route file.

## Main workflow

A trainee submits feedback in a course/enrollment context. Authorized organization actors can list/read feedback and update its moderation/status fields.

## Authorization and organization isolation

Organization-scoped operations use `X-Organization-Id`, `loadOrganizationMembership`, and role authorization as configured on each route. Services must also scope resource queries and referenced documents by `req.user.orgId`; middleware alone does not secure an unscoped database query.

## Validation and errors

Request schemas are defined in: `src/modules/feedback/feedback.validation.js`. The route specifies which request sections are parsed. Validation errors are returned through the shared 422 error format.
Use `AppError` and shared error codes for expected domain failures. Unexpected failures should flow to centralized error handling.

## Tests

Relevant test files found in the archive:
- `test/unit/feedback/feedback.controller.test.js`
- `test/unit/feedback/feedback.repository.test.js`
- `test/unit/feedback/feedback.service.test.js`

## Safe extension guidance

1. Read the route, validation schema, controller, service, repository and model before editing.
2. Preserve the distinction between global identity and organization-scoped records.
3. Validate all referenced IDs and confirm they belong to the same organization.
4. Preserve existing lifecycle transitions and historical records.
5. Add positive, negative, authorization and cross-organization tests.
6. Update the API reference and this document when externally observable behavior changes.

## Known limitations and future extensions

Only the implementation present in the listed files is guaranteed. Do not infer background jobs, push delivery, external event processing, advanced analytics, or additional workflow states unless source code explicitly implements them.
