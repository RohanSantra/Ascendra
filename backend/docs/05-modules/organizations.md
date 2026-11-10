# Organizations

## Purpose

Owns public organization discovery and the platform-admin application review and organization lifecycle operations.

## Implementation status

**Implemented in the checked-in source.** The scope described below is limited to the files and routes listed here; future extensions should be documented separately until implemented.

## Responsibilities and boundaries

Organization discovery and applications, platform-admin approval/rejection, suspension, and reactivation.

This module should own its domain rules. Cross-module workflows should use the existing service/repository conventions and validate that referenced records belong to the same organization where applicable.

## Source files

| Type | Files |
|---|---|
| Model | `src/modules/organizations/organization.model.js` |
| Route | `src/modules/organizations/organization.routes.js` |
| Controller | `src/modules/organizations/organization.controller.js` |
| Service / repository / engine | `src/modules/organizations/organization.service.js` |
| Validation | `src/modules/organizations/organization.validation.js` |

## Data model

### `organization`
Defined in `src/modules/organizations/organization.model.js`.
Top-level schema fields identified from the current schema declaration: `name`, `slug`, `description`, `logo`, `contactEmail`, `contactPhone`, `address`, `status`, `statusChangedAt`, `statusChangedBy`, `statusChangeReason`, `settings`, `createdBy`.
Read the model file for exact types, defaults, nested schema details, validators, indexes, timestamps, and immutable/select behavior before changing the schema.

## API routes

| Method | Endpoint | Access note | Description |
|---|---|---|---|
| `GET` | `/api/v1/organizations` | Public | Lists active organizations available for discovery. |
| `POST` | `/api/v1/organizations/applications` | Authenticated user | Submits an organization application; the applicant receives a pending admin membership. |
| `GET` | `/api/v1/organizations/applications/pending` | Platform Administrator | Lists pending organization applications for platform review. |
| `PATCH` | `/api/v1/organizations/applications/:id/approve` | Platform Administrator | Approves an organization application. |
| `PATCH` | `/api/v1/organizations/applications/:id/reject` | Platform Administrator | Rejects an organization application. |
| `PATCH` | `/api/v1/organizations/:id/suspend` | Platform Administrator | Suspends an active organization. |
| `PATCH` | `/api/v1/organizations/:id/reactivate` | Platform Administrator | Reactivates a suspended organization. |

These paths include the default `/api/v1` prefix. The prefix is configurable through `API_VERSION`. Access notes are taken from route annotations or the visible middleware chain; the route file is authoritative.

## Main workflow

Public users can discover active organizations. Authenticated users can submit applications. Platform admins review pending applications and can approve/reject them, suspend active organizations, or reactivate suspended organizations.

## Authorization and organization isolation

Some routes in this module are public or platform-scoped. Follow the route-level middleware; do not assume all operations require organization context.

## Validation and errors

Request schemas are defined in: `src/modules/organizations/organization.validation.js`. The route specifies which request sections are parsed. Validation errors are returned through the shared 422 error format.
Use `AppError` and shared error codes for expected domain failures. Unexpected failures should flow to centralized error handling.

## Tests

Relevant test files found in the archive:
- `test/unit/modules/organizations/controller.behavior.test.js`
- `test/unit/modules/organizations/module-wiring.test.js`
- `test/unit/modules/organizations/module.contracts.test.js`
- `test/unit/modules/organizations/service.behavior.test.js`

## Safe extension guidance

1. Read the route, validation schema, controller, service, repository and model before editing.
2. Preserve the distinction between global identity and organization-scoped records.
3. Validate all referenced IDs and confirm they belong to the same organization.
4. Preserve existing lifecycle transitions and historical records.
5. Add positive, negative, authorization and cross-organization tests.
6. Update the API reference and this document when externally observable behavior changes.

## Known limitations and future extensions

Only the implementation present in the listed files is guaranteed. Do not infer background jobs, push delivery, external event processing, advanced analytics, or additional workflow states unless source code explicitly implements them.
