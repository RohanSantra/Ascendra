# Training requirements

## Purpose

Stores an organization's training need and its matching criteria. Requirement changes and match execution are separate so a requirement can be evaluated more than once.

## Implementation status

**Implemented in the checked-in source.** The scope described below is limited to the files and routes listed here; future extensions should be documented separately until implemented.

## Responsibilities and boundaries

Organization-owned training needs with competency, skill, certification, experience, and other matching criteria.

This module should own its domain rules. Cross-module workflows should use the existing service/repository conventions and validate that referenced records belong to the same organization where applicable.

## Source files

| Type | Files |
|---|---|
| Model | `src/modules/trainingRequirements/trainingRequirement.model.js` |
| Route | `src/modules/trainingRequirements/trainingRequirement.routes.js` |
| Controller | `src/modules/trainingRequirements/trainingRequirement.controller.js` |
| Service / repository / engine | `src/modules/trainingRequirements/trainingRequirement.service.js` |
| Validation | `src/modules/trainingRequirements/trainingRequirement.validation.js` |

## Data model

### `trainingRequirement`
Defined in `src/modules/trainingRequirements/trainingRequirement.model.js`.
Top-level schema fields identified from the current schema declaration: `org`, `title`, `description`, `competencies`, `requiredSkills`, `qualificationKeywords`, `qualificationMustHave`, `requiredCertifications`, `minimumExperienceYears`, `minimumTeachingYears`, `status`, `latestMatchRun`, `createdBy`, `updatedBy`.
Read the model file for exact types, defaults, nested schema details, validators, indexes, timestamps, and immutable/select behavior before changing the schema.

## API routes

| Method | Endpoint | Access note | Description |
|---|---|---|---|
| `POST` | `/api/v1/training-requirements` | Organization Admin | Creates a new training requirement for the selected organization. |
| `GET` | `/api/v1/training-requirements` | Organization Admin | Retrieves paginated training requirements belonging to the selected organization. |
| `GET` | `/api/v1/training-requirements/:id` | Organization Admin | Retrieves a specific training requirement belonging to the selected organization. |
| `PATCH` | `/api/v1/training-requirements/:id` | Organization Admin | Updates an existing editable training requirement. |
| `PATCH` | `/api/v1/training-requirements/:id/archive` | Organization Admin | Archives a training requirement. |

These paths include the default `/api/v1` prefix. The prefix is configurable through `API_VERSION`. Access notes are taken from route annotations; confirm the actual middleware chain in the listed route file.

## Main workflow

An organization administrator creates, lists, reads, updates and archives a requirement. Matching reads the requirement and records a snapshot for each run; updates do not rewrite historical match-run snapshots.

## Authorization and organization isolation

Organization-scoped operations use `X-Organization-Id`, `loadOrganizationMembership`, and role authorization as configured on each route. Services must also scope resource queries and referenced documents by `req.user.orgId`; middleware alone does not secure an unscoped database query.

## Validation and errors

Request schemas are defined in: `src/modules/trainingRequirements/trainingRequirement.validation.js`. The route specifies which request sections are parsed. Validation errors are returned through the shared 422 error format.
Use `AppError` and shared error codes for expected domain failures. Unexpected failures should flow to centralized error handling.

## Tests

Relevant test files found in the archive:
- `test/unit/modules/trainingRequirements/controller.behavior.test.js`
- `test/unit/modules/trainingRequirements/service.behavior.test.js`

## Safe extension guidance

1. Read the route, validation schema, controller, service, repository and model before editing.
2. Preserve the distinction between global identity and organization-scoped records.
3. Validate all referenced IDs and confirm they belong to the same organization.
4. Preserve existing lifecycle transitions and historical records.
5. Add positive, negative, authorization and cross-organization tests.
6. Update the API reference and this document when externally observable behavior changes.

## Known limitations and future extensions

Only the implementation present in the listed files is guaranteed. Do not infer background jobs, push delivery, external event processing, advanced analytics, or additional workflow states unless source code explicitly implements them.
