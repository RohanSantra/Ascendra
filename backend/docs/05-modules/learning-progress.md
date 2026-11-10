# Learning progress

## Purpose

Tracks a trainee's progress against course materials and provides course-level progress queries/summaries.

## Implementation status

**Implemented in the checked-in source.** The scope described below is limited to the files and routes listed here; future extensions should be documented separately until implemented.

## Responsibilities and boundaries

Per-enrollment material progress and course-level learning summaries.

This module should own its domain rules. Cross-module workflows should use the existing service/repository conventions and validate that referenced records belong to the same organization where applicable.

## Source files

| Type | Files |
|---|---|
| Model | `src/modules/learningProgress/learningProgress.model.js` |
| Route | `src/modules/learningProgress/learningProgress.routes.js` |
| Controller | `src/modules/learningProgress/learningProgress.controller.js` |
| Service / repository / engine | `src/modules/learningProgress/learningProgress.repository.js`, `src/modules/learningProgress/learningProgress.service.js` |
| Validation | `src/modules/learningProgress/learningProgress.validation.js` |

## Data model

### `learningProgress`
Defined in `src/modules/learningProgress/learningProgress.model.js`.
Top-level schema fields identified from the current schema declaration: `org`, `course`, `enrollment`, `trainee`, `material`, `status`, `startedAt`, `lastAccessedAt`, `completedAt`.
Read the model file for exact types, defaults, nested schema details, validators, indexes, timestamps, and immutable/select behavior before changing the schema.

## API routes

| Method | Endpoint | Access note | Description |
|---|---|---|---|
| `GET` | `/api/v1/courses/:courseId/materials/:materialId/progress` | Trainee | Retrieves or initializes a trainee's material progress. |
| `PATCH` | `/api/v1/courses/:courseId/materials/:materialId/progress` | Trainee | Updates a trainee's material progress status. |
| `GET` | `/api/v1/courses/:courseId/learning-progress/summary` | Trainee | Retrieves a trainee's course-level learning progress summary. |
| `GET` | `/api/v1/courses/:courseId/learning-progress` | Trainer, Admin, Trainee | Retrieves learning progress records for a course. |

These paths include the default `/api/v1` prefix. The prefix is configurable through `API_VERSION`. Access notes are taken from route annotations; confirm the actual middleware chain in the listed route file.

## Main workflow

A trainee or authorized course actor reads and updates material-level progress. The service can return per-course progress lists and summaries associated with enrollments.

## Authorization and organization isolation

Organization-scoped operations use `X-Organization-Id`, `loadOrganizationMembership`, and role authorization as configured on each route. Services must also scope resource queries and referenced documents by `req.user.orgId`; middleware alone does not secure an unscoped database query.

## Validation and errors

Request schemas are defined in: `src/modules/learningProgress/learningProgress.validation.js`. The route specifies which request sections are parsed. Validation errors are returned through the shared 422 error format.
Use `AppError` and shared error codes for expected domain failures. Unexpected failures should flow to centralized error handling.

## Tests

Relevant test files found in the archive:
- `test/unit/learningProgress/learningProgress.controller.test.js`
- `test/unit/learningProgress/learningProgress.repository.test.js`
- `test/unit/learningProgress/learningProgress.service.test.js`

## Safe extension guidance

1. Read the route, validation schema, controller, service, repository and model before editing.
2. Preserve the distinction between global identity and organization-scoped records.
3. Validate all referenced IDs and confirm they belong to the same organization.
4. Preserve existing lifecycle transitions and historical records.
5. Add positive, negative, authorization and cross-organization tests.
6. Update the API reference and this document when externally observable behavior changes.

## Known limitations and future extensions

Only the implementation present in the listed files is guaranteed. Do not infer background jobs, push delivery, external event processing, advanced analytics, or additional workflow states unless source code explicitly implements them.
