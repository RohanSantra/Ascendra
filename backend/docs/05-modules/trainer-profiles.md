# Trainer profiles and approval

## Purpose

Stores trainer professional information, availability, derived competency information and approval lifecycle. Trainer approval is independent of membership approval.

## Implementation status

**Implemented in the checked-in source.** The scope described below is limited to the files and routes listed here; future extensions should be documented separately until implemented.

## Responsibilities and boundaries

Trainer professional details, availability, derived competency information, and organization-level eligibility review.

This module should own its domain rules. Cross-module workflows should use the existing service/repository conventions and validate that referenced records belong to the same organization where applicable.

## Source files

| Type | Files |
|---|---|
| Model | `src/modules/trainerProfiles/trainerProfile.model.js` |
| Route | `src/modules/trainerProfiles/trainerApproval.routes.js`, `src/modules/trainerProfiles/trainerProfile.routes.js` |
| Controller | `src/modules/trainerProfiles/trainerApproval.controller.js`, `src/modules/trainerProfiles/trainerProfile.controller.js` |
| Service / repository / engine | `src/modules/trainerProfiles/trainerApproval.service.js`, `src/modules/trainerProfiles/trainerProfile.service.js` |
| Validation | `src/modules/trainerProfiles/trainerApproval.validation.js`, `src/modules/trainerProfiles/trainerProfile.validation.js` |

## Data model

### `trainerProfile`
Defined in `src/modules/trainerProfiles/trainerProfile.model.js`.
Top-level schema fields identified from the current schema declaration: `org`, `user`, `professionalDetails`, `approval`, `competencySummary`, `skills`, `evidenceStats`, `experience`, `availability`, `completion`, `competencyRecomputedAt`.
Read the model file for exact types, defaults, nested schema details, validators, indexes, timestamps, and immutable/select behavior before changing the schema.

## API routes

| Method | Endpoint | Access note | Description |
|---|---|---|---|
| `GET` | `/api/v1/trainer-approvals/pending` | Admin | Lists trainers awaiting eligibility approval. |
| `PATCH` | `/api/v1/trainer-approvals/:id/approve` | Admin | Approves trainer eligibility. |
| `PATCH` | `/api/v1/trainer-approvals/:id/reject` | Admin | Rejects trainer eligibility. |
| `PATCH` | `/api/v1/trainer-approvals/:id/suspend` | Admin | Suspends trainer eligibility. |
| `GET` | `/api/v1/trainer-profiles/me` | Trainer | Retrieves the authenticated trainer's profile. |
| `PATCH` | `/api/v1/trainer-profiles/me/professional-details` | Trainer | Updates trainer professional information. |
| `PATCH` | `/api/v1/trainer-profiles/me/availability` | Trainer | Updates trainer availability preferences. |

These paths include the default `/api/v1` prefix. The prefix is configurable through `API_VERSION`. Access notes are taken from route annotations; confirm the actual middleware chain in the listed route file.

## Main workflow

A trainer reads and updates their own professional details and availability. Organization administrators review pending trainer profiles and approve, reject, or suspend eligibility. Eligibility does not replace membership approval.

## Authorization and organization isolation

Organization-scoped operations use `X-Organization-Id`, `loadOrganizationMembership`, and role authorization as configured on each route. Services must also scope resource queries and referenced documents by `req.user.orgId`; middleware alone does not secure an unscoped database query.

## Validation and errors

Request schemas are defined in: `src/modules/trainerProfiles/trainerApproval.validation.js`, `src/modules/trainerProfiles/trainerProfile.validation.js`. The route specifies which request sections are parsed. Validation errors are returned through the shared 422 error format.
Use `AppError` and shared error codes for expected domain failures. Unexpected failures should flow to centralized error handling.

## Tests

Relevant test files found in the archive:
- `test/unit/modules/trainerProfiles/controller.behavior.test.js`
- `test/unit/modules/trainerProfiles/module.contracts.test.js`
- `test/unit/modules/trainerProfiles/service.behavior.test.js`

## Safe extension guidance

1. Read the route, validation schema, controller, service, repository and model before editing.
2. Preserve the distinction between global identity and organization-scoped records.
3. Validate all referenced IDs and confirm they belong to the same organization.
4. Preserve existing lifecycle transitions and historical records.
5. Add positive, negative, authorization and cross-organization tests.
6. Update the API reference and this document when externally observable behavior changes.

## Known limitations and future extensions

Only the implementation present in the listed files is guaranteed. Do not infer background jobs, push delivery, external event processing, advanced analytics, or additional workflow states unless source code explicitly implements them.
