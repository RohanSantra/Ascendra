# Assessments and attempts

## Purpose

Owns course assessment definitions, versioning, publishing/archival, attempts, answers and evaluation records.

## Implementation status

**Implemented in the checked-in source.** The scope described below is limited to the files and routes listed here; future extensions should be documented separately until implemented.

## Responsibilities and boundaries

Versioned course assessments, questions, attempts, answer submission, and evaluation workflow.

This module should own its domain rules. Cross-module workflows should use the existing service/repository conventions and validate that referenced records belong to the same organization where applicable.

## Source files

| Type | Files |
|---|---|
| Model | `src/modules/assessments/assessment.model.js`, `src/modules/assessments/assessmentAttempt.model.js` |
| Route | `src/modules/assessments/assessment.routes.js` |
| Controller | `src/modules/assessments/assessment.controller.js`, `src/modules/assessments/assessmentAttempt.controller.js` |
| Service / repository / engine | `src/modules/assessments/assessment.repository.js`, `src/modules/assessments/assessment.service.js`, `src/modules/assessments/assessmentAttempt.repository.js`, `src/modules/assessments/assessmentAttempt.service.js` |
| Validation | `src/modules/assessments/assessment.validation.js`, `src/modules/assessments/assessmentAttempt.validation.js` |

## Data model

### `assessment`
Defined in `src/modules/assessments/assessment.model.js`.
Top-level schema fields identified from the current schema declaration: `org`, `course`, `assessmentKey`, `title`, `description`, `questions`, `totalMarks`, `passingPercentage`, `durationMinutes`, `maxAttempts`, `version`, `status`, `createdBy`, `publishedAt`.
Read the model file for exact types, defaults, nested schema details, validators, indexes, timestamps, and immutable/select behavior before changing the schema.

### `assessmentAttempt`
Defined in `src/modules/assessments/assessmentAttempt.model.js`.
Top-level schema fields identified from the current schema declaration: `org`, `assessment`, `course`, `trainee`, `attemptNumber`, `assessmentVersion`, `assessmentSnapshot`, `answers`, `score`, `totalMarks`, `percentage`, `status`, `startedAt`, `expiresAt`, `submittedAt`, `evaluatedAt`.
Read the model file for exact types, defaults, nested schema details, validators, indexes, timestamps, and immutable/select behavior before changing the schema.

## API routes

| Method | Endpoint | Access note | Description |
|---|---|---|---|
| `POST` | `/api/v1/courses/:courseId/assessments` | Trainer, Organisation Admin | Creates a new draft assessment for a course. |
| `GET` | `/api/v1/courses/:courseId/assessments` | Trainer, Trainee, Organisation Admin | Retrieves assessments belonging to a course. |
| `GET` | `/api/v1/assessments/:assessmentId` | Trainer, Trainee, Organisation Admin | Retrieves an assessment by its identifier. |
| `PATCH` | `/api/v1/assessments/:assessmentId` | Trainer, Organisation Admin | Updates an existing draft assessment. |
| `PATCH` | `/api/v1/assessments/:assessmentId/publish` | Trainer, Organisation Admin | Publishes a draft assessment. |
| `POST` | `/api/v1/assessments/:assessmentId/versions` | Trainer, Organisation Admin | Creates a new draft version of a published assessment. |
| `PATCH` | `/api/v1/assessments/:assessmentId/archive` | Trainer, Organisation Admin | Archives a published assessment. |
| `POST` | `/api/v1/assessments/:assessmentId/attempts` | Trainee | Starts or resumes a trainee's assessment attempt. |
| `GET` | `/api/v1/assessment-attempts` | Trainee, Trainer, Organisation Admin | Retrieves assessment attempt history. |
| `GET` | `/api/v1/assessment-attempts/:attemptId` | Trainee, Trainer, Organisation Admin | Retrieves an assessment attempt. |
| `PATCH` | `/api/v1/assessment-attempts/:attemptId/answers` | Trainee | Saves or updates answers in an active assessment attempt. |
| `POST` | `/api/v1/assessment-attempts/:attemptId/submit` | Trainee | Submits and evaluates an assessment attempt. |

These paths include the default `/api/v1` prefix. The prefix is configurable through `API_VERSION`. Access notes are taken from route annotations; confirm the actual middleware chain in the listed route file.

## Main workflow

A trainer/admin creates a draft assessment for a course, manages/publishes versions, and archives it. A trainee starts an attempt, submits answers and submits the attempt for evaluation; attempt snapshots preserve the assessment version used.

## Authorization and organization isolation

Organization-scoped operations use `X-Organization-Id`, `loadOrganizationMembership`, and role authorization as configured on each route. Services must also scope resource queries and referenced documents by `req.user.orgId`; middleware alone does not secure an unscoped database query.

## Validation and errors

Request schemas are defined in: `src/modules/assessments/assessment.validation.js`, `src/modules/assessments/assessmentAttempt.validation.js`. The route specifies which request sections are parsed. Validation errors are returned through the shared 422 error format.
Use `AppError` and shared error codes for expected domain failures. Unexpected failures should flow to centralized error handling.

## Tests

Relevant test files found in the archive:
- `test/integration/assessments/assessmentWorkflow.integration.test.js`
- `test/unit/assessments/assessment.model.test.js`
- `test/unit/assessments/assessment.repository.test.js`
- `test/unit/assessments/assessment.services.test.js`
- `test/unit/assessments/assessment.validation.test.js`
- `test/unit/assessments/assessmentAttempt.model.test.js`
- `test/unit/assessments/assessmentAttempt.validation.test.js`

## Safe extension guidance

1. Read the route, validation schema, controller, service, repository and model before editing.
2. Preserve the distinction between global identity and organization-scoped records.
3. Validate all referenced IDs and confirm they belong to the same organization.
4. Preserve existing lifecycle transitions and historical records.
5. Add positive, negative, authorization and cross-organization tests.
6. Update the API reference and this document when externally observable behavior changes.

## Known limitations and future extensions

Only the implementation present in the listed files is guaranteed. Do not infer background jobs, push delivery, external event processing, advanced analytics, or additional workflow states unless source code explicitly implements them.
