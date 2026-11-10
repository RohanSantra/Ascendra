# Enrollments

## Purpose

Tracks a trainee's relationship with a course and enrollment lifecycle timestamps.

## Implementation status

**Implemented in the checked-in source.** The scope described below is limited to the files and routes listed here; future extensions should be documented separately until implemented.

## Responsibilities and boundaries

Trainee participation lifecycle for courses.

This module should own its domain rules. Cross-module workflows should use the existing service/repository conventions and validate that referenced records belong to the same organization where applicable.

## Source files

| Type | Files |
|---|---|
| Model | `src/modules/enrollments/enrollment.model.js` |
| Route | `src/modules/enrollments/enrollment.routes.js` |
| Controller | `src/modules/enrollments/enrollment.controller.js` |
| Service / repository / engine | `src/modules/enrollments/enrollment.repository.js`, `src/modules/enrollments/enrollment.service.js` |
| Validation | `src/modules/enrollments/enrollment.validation.js` |

## Data model

### `enrollment`
Defined in `src/modules/enrollments/enrollment.model.js`.
Top-level schema fields identified from the current schema declaration: `org`, `course`, `trainee`, `status`, `enrolledAt`, `startedAt`, `completedAt`, `withdrawnAt`, `cancelledAt`.
Read the model file for exact types, defaults, nested schema details, validators, indexes, timestamps, and immutable/select behavior before changing the schema.

## API routes

| Method | Endpoint | Access note | Description |
|---|---|---|---|
| `POST` | `/api/v1/courses/:courseId/enrollments` | Trainee, Organisation Admin | Creates an enrollment for a trainee in a course. |
| `GET` | `/api/v1/enrollments` | Trainee, Trainer, Organisation Admin | Retrieves enrollments belonging to the active organisation. |
| `GET` | `/api/v1/enrollments/:enrollmentId` | Trainee, Trainer, Organisation Admin | Retrieves an enrollment by its ID. |
| `PATCH` | `/api/v1/enrollments/:enrollmentId/status` | Trainee, Trainer, Organisation Admin | Updates the status of an enrollment. |

These paths include the default `/api/v1` prefix. The prefix is configurable through `API_VERSION`. Access notes are taken from route annotations; confirm the actual middleware chain in the listed route file.

## Main workflow

An eligible trainee enrolls in a course. Organization/course authorization and enrollment state are checked by the service. Admin/trainer actors may inspect enrollments and update permitted statuses according to route middleware.

## Authorization and organization isolation

Organization-scoped operations use `X-Organization-Id`, `loadOrganizationMembership`, and role authorization as configured on each route. Services must also scope resource queries and referenced documents by `req.user.orgId`; middleware alone does not secure an unscoped database query.

## Validation and errors

Request schemas are defined in: `src/modules/enrollments/enrollment.validation.js`. The route specifies which request sections are parsed. Validation errors are returned through the shared 422 error format.
Use `AppError` and shared error codes for expected domain failures. Unexpected failures should flow to centralized error handling.

## Tests

Relevant test files found in the archive:
- `test/unit/modules/enrollments/enrollment.controller.behavior.test.js`
- `test/unit/modules/enrollments/enrollment.controller.test.js`
- `test/unit/modules/enrollments/enrollment.model.test.js`
- `test/unit/modules/enrollments/enrollment.repository.test.js`
- `test/unit/modules/enrollments/enrollment.service.behavior.test.js`
- `test/unit/modules/enrollments/enrollment.service.test.js`
- `test/unit/modules/enrollments/enrollment.validation.test.js`

## Safe extension guidance

1. Read the route, validation schema, controller, service, repository and model before editing.
2. Preserve the distinction between global identity and organization-scoped records.
3. Validate all referenced IDs and confirm they belong to the same organization.
4. Preserve existing lifecycle transitions and historical records.
5. Add positive, negative, authorization and cross-organization tests.
6. Update the API reference and this document when externally observable behavior changes.

## Known limitations and future extensions

Only the implementation present in the listed files is guaranteed. Do not infer background jobs, push delivery, external event processing, advanced analytics, or additional workflow states unless source code explicitly implements them.
