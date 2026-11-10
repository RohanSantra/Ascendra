# Trainer assignments

## Purpose

Creates and manages formal trainer assignments. Assignment state changes are constrained by service rules and capacity reservation must be coordinated with trainer profile counters.

## Implementation status

**Implemented in the checked-in source.** The scope described below is limited to the files and routes listed here; future extensions should be documented separately until implemented.

## Responsibilities and boundaries

Reservation and lifecycle management for trainers selected against training requirements.

This module should own its domain rules. Cross-module workflows should use the existing service/repository conventions and validate that referenced records belong to the same organization where applicable.

## Source files

| Type | Files |
|---|---|
| Model | `src/modules/trainerAssignments/trainerAssignment.model.js` |
| Route | `src/modules/trainerAssignments/trainerAssignment.routes.js` |
| Controller | `src/modules/trainerAssignments/trainerAssignment.controller.js` |
| Service / repository / engine | `src/modules/trainerAssignments/trainerAssignment.repository.js`, `src/modules/trainerAssignments/trainerAssignment.service.js` |
| Validation | `src/modules/trainerAssignments/trainerAssignment.validation.js` |

## Data model

### `trainerAssignment`
Defined in `src/modules/trainerAssignments/trainerAssignment.model.js`.
Top-level schema fields identified from the current schema declaration: `org`, `requirement`, `matchRun`, `trainer`, `trainerProfile`, `assignedBy`, `status`, `startDate`, `endDate`, `assignedAt`, `cancelledAt`, `completedAt`, `cancellationReason`.
Read the model file for exact types, defaults, nested schema details, validators, indexes, timestamps, and immutable/select behavior before changing the schema.

## API routes

| Method | Endpoint | Access note | Description |
|---|---|---|---|
| `GET` | `/api/v1/trainer-assignments` | Organization Admin | Retrieves paginated trainer assignments. |
| `POST` | `/api/v1/trainer-assignments/requirements/:requirementId` | Organization Admin | Assigns a trainer to a training requirement. |
| `PATCH` | `/api/v1/trainer-assignments/:id/start` | Organization Admin | Starts an assigned training engagement. |
| `PATCH` | `/api/v1/trainer-assignments/:id/complete` | Organization Admin | Completes an in-progress training engagement. |
| `PATCH` | `/api/v1/trainer-assignments/:id/cancel` | Organization Admin | Cancels an assigned or in-progress engagement. |
| `GET` | `/api/v1/trainer-assignments/:id` | Organization Admin | Retrieves an individual trainer assignment. |

These paths include the default `/api/v1` prefix. The prefix is configurable through `API_VERSION`. Access notes are taken from route annotations; confirm the actual middleware chain in the listed route file.

## Main workflow

An organization administrator creates an assignment against a requirement and match run. The service reserves trainer capacity with the assignment write, then supports start, completion and cancellation transitions.

## Authorization and organization isolation

Organization-scoped operations use `X-Organization-Id`, `loadOrganizationMembership`, and role authorization as configured on each route. Services must also scope resource queries and referenced documents by `req.user.orgId`; middleware alone does not secure an unscoped database query.

## Validation and errors

Request schemas are defined in: `src/modules/trainerAssignments/trainerAssignment.validation.js`. The route specifies which request sections are parsed. Validation errors are returned through the shared 422 error format.
Use `AppError` and shared error codes for expected domain failures. Unexpected failures should flow to centralized error handling.

## Tests

Relevant test files found in the archive:
- `test/unit/modules/trainerAssignments/controller.behavior.test.js`
- `test/unit/modules/trainerAssignments/module.contracts.test.js`
- `test/unit/modules/trainerAssignments/repositories.test.js`
- `test/unit/modules/trainerAssignments/repository.behavior.test.js`
- `test/unit/modules/trainerAssignments/service.behavior.test.js`

## Safe extension guidance

1. Read the route, validation schema, controller, service, repository and model before editing.
2. Preserve the distinction between global identity and organization-scoped records.
3. Validate all referenced IDs and confirm they belong to the same organization.
4. Preserve existing lifecycle transitions and historical records.
5. Add positive, negative, authorization and cross-organization tests.
6. Update the API reference and this document when externally observable behavior changes.

## Known limitations and future extensions

Only the implementation present in the listed files is guaranteed. Do not infer background jobs, push delivery, external event processing, advanced analytics, or additional workflow states unless source code explicitly implements them.
