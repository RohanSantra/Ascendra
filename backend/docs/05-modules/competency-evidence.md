# Competency evidence

## Purpose

Separates evidence submission, evidence review, and evidence-domain recomputation. Evidence files are represented by metadata; verification and derived trainer competency summaries are distinct from raw submissions.

## Implementation status

**Implemented in the checked-in source.** The scope described below is limited to the files and routes listed here; future extensions should be documented separately until implemented.

## Responsibilities and boundaries

Submission, storage metadata, verification, and recomputation of trainer competency evidence.

This module should own its domain rules. Cross-module workflows should use the existing service/repository conventions and validate that referenced records belong to the same organization where applicable.

## Source files

| Type | Files |
|---|---|
| Model | `src/modules/competencyEvidence/submissions/competencyEvidence.model.js` |
| Route | `src/modules/competencyEvidence/submissions/competencyEvidence.routes.js`, `src/modules/competencyEvidence/verification/evidenceVerification.routes.js` |
| Controller | `src/modules/competencyEvidence/submissions/competencyEvidence.controller.js`, `src/modules/competencyEvidence/verification/evidenceVerification.controller.js` |
| Service / repository / engine | `src/modules/competencyEvidence/domain/evidence.engine.js`, `src/modules/competencyEvidence/domain/evidence.repository.js`, `src/modules/competencyEvidence/domain/evidenceRecomputation.service.js`, `src/modules/competencyEvidence/submissions/competencyEvidence.service.js`, `src/modules/competencyEvidence/verification/evidenceVerification.service.js` |
| Validation | `src/modules/competencyEvidence/submissions/competencyEvidence.validation.js`, `src/modules/competencyEvidence/verification/evidenceVerification.validation.js` |

## Data model

### `competencyEvidence`
Defined in `src/modules/competencyEvidence/submissions/competencyEvidence.model.js`.
Top-level schema fields identified from the current schema declaration: `org`, `user`, `trainerProfile`, `type`, `competencies`, `skills`, `title`, `description`, `details`, `file`, `verification`, `isDeleted`, `deletedAt`, `deletedBy`, `supersededBy`, `supersededAt`.
Read the model file for exact types, defaults, nested schema details, validators, indexes, timestamps, and immutable/select behavior before changing the schema.

## API routes

| Method | Endpoint | Access note | Description |
|---|---|---|---|
| `POST` | `/api/v1/evidence` | Trainer | Submits new competency evidence. |
| `GET` | `/api/v1/evidence` | Trainer | Retrieves the authenticated trainer's evidence |
| `GET` | `/api/v1/evidence/:id` | Trainer | Retrieves an individual evidence record |
| `DELETE` | `/api/v1/evidence/:id` | Trainer | Soft-deletes an evidence record belonging |
| `GET` | `/api/v1/evidence/verification/pending` | Admin | Retrieves pending competency evidence for |
| `GET` | `/api/v1/evidence/verification/:id` | Admin | Retrieves individual pending evidence details. |
| `PATCH` | `/api/v1/evidence/verification/:id/approve` | Admin | Verifies submitted competency evidence. |
| `PATCH` | `/api/v1/evidence/verification/:id/reject` | Admin | Rejects submitted competency evidence with a reason. |

These paths include the default `/api/v1` prefix. The prefix is configurable through `API_VERSION`. Access notes are taken from route annotations; confirm the actual middleware chain in the listed route file.

## Main workflow

A trainer submits evidence against competencies and/or skills. Organization-authorized reviewers inspect pending evidence and approve or reject it. Domain services map evidence and recompute trainer competency summaries from eligible verified evidence.

## Authorization and organization isolation

Organization-scoped operations use `X-Organization-Id`, `loadOrganizationMembership`, and role authorization as configured on each route. Services must also scope resource queries and referenced documents by `req.user.orgId`; middleware alone does not secure an unscoped database query.

## Validation and errors

Request schemas are defined in: `src/modules/competencyEvidence/submissions/competencyEvidence.validation.js`, `src/modules/competencyEvidence/verification/evidenceVerification.validation.js`. The route specifies which request sections are parsed. Validation errors are returned through the shared 422 error format.
Use `AppError` and shared error codes for expected domain failures. Unexpected failures should flow to centralized error handling.

## Tests

Relevant test files found in the archive:
- `test/integration/competencyEvidence/evidenceSubmission.integration.test.js`
- `test/unit/competencyEvidence/competencyEvidence.service.test.js`
- `test/unit/competencyEvidence/controllers.test.js`
- `test/unit/competencyEvidence/domain/evidence.repository.test.js`
- `test/unit/competencyEvidence/evidence.engine.test.js`
- `test/unit/competencyEvidence/evidence.mapper.test.js`
- `test/unit/competencyEvidence/evidenceRecomputation.service.test.js`
- `test/unit/competencyEvidence/submission.validation.test.js`

## Safe extension guidance

1. Read the route, validation schema, controller, service, repository and model before editing.
2. Preserve the distinction between global identity and organization-scoped records.
3. Validate all referenced IDs and confirm they belong to the same organization.
4. Preserve existing lifecycle transitions and historical records.
5. Add positive, negative, authorization and cross-organization tests.
6. Update the API reference and this document when externally observable behavior changes.

## Known limitations and future extensions

Only the implementation present in the listed files is guaranteed. Do not infer background jobs, push delivery, external event processing, advanced analytics, or additional workflow states unless source code explicitly implements them.
