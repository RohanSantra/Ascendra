# Skills

## Purpose

Provides organization-owned skills associated with broader competencies. Skill slugs are unique within an organization.

## Implementation status

**Implemented in the checked-in source.** The scope described below is limited to the files and routes listed here; future extensions should be documented separately until implemented.

## Responsibilities and boundaries

Organization-defined specific capabilities associated with broader competencies.

This module should own its domain rules. Cross-module workflows should use the existing service/repository conventions and validate that referenced records belong to the same organization where applicable.

## Source files

| Type | Files |
|---|---|
| Model | `src/modules/skills/skill.model.js` |
| Route | `src/modules/skills/skill.routes.js` |
| Controller | `src/modules/skills/skill.controller.js` |
| Service / repository / engine | `src/modules/skills/skill.service.js` |
| Validation | `src/modules/skills/skill.validation.js` |

## Data model

### `skill`
Defined in `src/modules/skills/skill.model.js`.
Top-level schema fields identified from the current schema declaration: `org`, `name`, `slug`, `description`, `competencies`, `category`, `status`, `createdBy`, `updatedBy`.
Read the model file for exact types, defaults, nested schema details, validators, indexes, timestamps, and immutable/select behavior before changing the schema.

## API routes

| Method | Endpoint | Access note | Description |
|---|---|---|---|
| `POST` | `/api/v1/skills` | Admin | Creates a new skill for the organization. |
| `GET` | `/api/v1/skills` | Admin | Retrieves organization skills with pagination, |
| `GET` | `/api/v1/skills/:id` | Admin | Retrieves a skill by its ID. |
| `PATCH` | `/api/v1/skills/:id` | Admin | Updates skill information and competency associations. |
| `PATCH` | `/api/v1/skills/:id/archive` | Admin | Archives a skill without permanently deleting it. |

These paths include the default `/api/v1` prefix. The prefix is configurable through `API_VERSION`. Access notes are taken from route annotations; confirm the actual middleware chain in the listed route file.

## Main workflow

Organization administrators create and maintain skills, optionally associating them with competencies. Skills can be searched/filtered and archived rather than hard-deleted.

## Authorization and organization isolation

Organization-scoped operations use `X-Organization-Id`, `loadOrganizationMembership`, and role authorization as configured on each route. Services must also scope resource queries and referenced documents by `req.user.orgId`; middleware alone does not secure an unscoped database query.

## Validation and errors

Request schemas are defined in: `src/modules/skills/skill.validation.js`. The route specifies which request sections are parsed. Validation errors are returned through the shared 422 error format.
Use `AppError` and shared error codes for expected domain failures. Unexpected failures should flow to centralized error handling.

## Tests

Relevant test files found in the archive:
- `test/unit/modules/skills/controller.behavior.test.js`
- `test/unit/modules/skills/module.contracts.test.js`
- `test/unit/modules/skills/service.behavior.test.js`

## Safe extension guidance

1. Read the route, validation schema, controller, service, repository and model before editing.
2. Preserve the distinction between global identity and organization-scoped records.
3. Validate all referenced IDs and confirm they belong to the same organization.
4. Preserve existing lifecycle transitions and historical records.
5. Add positive, negative, authorization and cross-organization tests.
6. Update the API reference and this document when externally observable behavior changes.

## Known limitations and future extensions

Only the implementation present in the listed files is guaranteed. Do not infer background jobs, push delivery, external event processing, advanced analytics, or additional workflow states unless source code explicitly implements them.
