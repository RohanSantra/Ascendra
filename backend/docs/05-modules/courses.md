# Courses

## Purpose

Owns course metadata and lifecycle. A course may reference a trainer, trainer profile, trainer assignment and training requirement.

## Implementation status

**Implemented in the checked-in source.** The scope described below is limited to the files and routes listed here; future extensions should be documented separately until implemented.

## Responsibilities and boundaries

Organization-owned course records associated with trainers, assignments, and training requirements.

This module should own its domain rules. Cross-module workflows should use the existing service/repository conventions and validate that referenced records belong to the same organization where applicable.

## Source files

| Type | Files |
|---|---|
| Model | `src/modules/courses/course.model.js` |
| Route | `src/modules/courses/course.routes.js` |
| Controller | `src/modules/courses/course.controller.js` |
| Service / repository / engine | `src/modules/courses/course.repository.js`, `src/modules/courses/course.service.js` |
| Validation | `src/modules/courses/course.validation.js` |

## Data model

### `course`
Defined in `src/modules/courses/course.model.js`.
Top-level schema fields identified from the current schema declaration: `org`, `title`, `description`, `trainer`, `trainerProfile`, `trainerAssignment`, `requirement`, `startDate`, `endDate`, `status`, `createdBy`.
Read the model file for exact types, defaults, nested schema details, validators, indexes, timestamps, and immutable/select behavior before changing the schema.

## API routes

| Method | Endpoint | Access note | Description |
|---|---|---|---|
| `POST` | `/api/v1/courses` | Trainer | Creates a course from a trainer assignment. |
| `GET` | `/api/v1/courses` | Trainer, Organisation Admin | Retrieves courses for the active organisation. |
| `GET` | `/api/v1/courses/:id` | Trainer, Organisation Admin | Retrieves a course by ID. |
| `PATCH` | `/api/v1/courses/:id` | Trainer, Organisation Admin | Updates a draft course. |
| `PATCH` | `/api/v1/courses/:id/status` | Trainer, Organisation Admin | Changes the lifecycle status of a course. |

These paths include the default `/api/v1` prefix. The prefix is configurable through `API_VERSION`. Access notes are taken from route annotations; confirm the actual middleware chain in the listed route file.

## Main workflow

Organization admins or permitted trainers create and maintain courses according to route authorization. Courses may reference a requirement and assignment; course status is changed through a dedicated status route.

## Authorization and organization isolation

Organization-scoped operations use `X-Organization-Id`, `loadOrganizationMembership`, and role authorization as configured on each route. Services must also scope resource queries and referenced documents by `req.user.orgId`; middleware alone does not secure an unscoped database query.

## Validation and errors

Request schemas are defined in: `src/modules/courses/course.validation.js`. The route specifies which request sections are parsed. Validation errors are returned through the shared 422 error format.
Use `AppError` and shared error codes for expected domain failures. Unexpected failures should flow to centralized error handling.

## Tests

Relevant test files found in the archive:
- `test/integration/courses/courseContent.integration.test.js`
- `test/unit/modules/courses/course.controller.behavior.test.js`
- `test/unit/modules/courses/course.controller.test.js`
- `test/unit/modules/courses/course.model.test.js`
- `test/unit/modules/courses/course.repository.test.js`
- `test/unit/modules/courses/course.service.behavior.test.js`
- `test/unit/modules/courses/course.service.test.js`
- `test/unit/modules/courses/course.validation.test.js`

## Safe extension guidance

1. Read the route, validation schema, controller, service, repository and model before editing.
2. Preserve the distinction between global identity and organization-scoped records.
3. Validate all referenced IDs and confirm they belong to the same organization.
4. Preserve existing lifecycle transitions and historical records.
5. Add positive, negative, authorization and cross-organization tests.
6. Update the API reference and this document when externally observable behavior changes.

## Known limitations and future extensions

Only the implementation present in the listed files is guaranteed. Do not infer background jobs, push delivery, external event processing, advanced analytics, or additional workflow states unless source code explicitly implements them.
