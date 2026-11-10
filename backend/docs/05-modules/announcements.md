# Announcements

## Purpose

Stores organization announcements with audience and draft/published/archived lifecycle behavior.

## Implementation status

**Implemented in the checked-in source.** The scope described below is limited to the files and routes listed here; future extensions should be documented separately until implemented.

## Responsibilities and boundaries

Organization announcements, audiences, publication, expiry, and archival.

This module should own its domain rules. Cross-module workflows should use the existing service/repository conventions and validate that referenced records belong to the same organization where applicable.

## Source files

| Type | Files |
|---|---|
| Model | `src/modules/announcements/announcement.model.js` |
| Route | `src/modules/announcements/announcement.routes.js` |
| Controller | `src/modules/announcements/announcement.controller.js` |
| Service / repository / engine | `src/modules/announcements/announcement.repository.js`, `src/modules/announcements/announcement.service.js` |
| Validation | `src/modules/announcements/announcement.validation.js` |

## Data model

### `announcement`
Defined in `src/modules/announcements/announcement.model.js`.
Top-level schema fields identified from the current schema declaration: `org`, `title`, `message`, `audience`, `status`, `publishedAt`, `expiresAt`, `createdBy`, `updatedBy`.
Read the model file for exact types, defaults, nested schema details, validators, indexes, timestamps, and immutable/select behavior before changing the schema.

## API routes

| Method | Endpoint | Access note | Description |
|---|---|---|---|
| `POST` | `/api/v1/announcements` | Organisation Admin | Creates an organisation announcement draft. |
| `GET` | `/api/v1/announcements` | Organisation Admin, Trainer, Trainee | Retrieves announcements available to the current member. |
| `GET` | `/api/v1/announcements/:announcementId` | Organisation Admin, Trainer, Trainee | Retrieves an announcement. |
| `PATCH` | `/api/v1/announcements/:announcementId` | Organisation Admin | Updates a draft announcement. |
| `PATCH` | `/api/v1/announcements/:announcementId/publish` | Organisation Admin | Publishes a draft announcement. |
| `PATCH` | `/api/v1/announcements/:announcementId/archive` | Organisation Admin | Archives an announcement. |

These paths include the default `/api/v1` prefix. The prefix is configurable through `API_VERSION`. Access notes are taken from route annotations; confirm the actual middleware chain in the listed route file.

## Main workflow

An organization admin creates a draft, edits it, publishes it, and archives it. Members retrieve announcements available to their role/audience. Expiry and audience rules are implemented in model/service logic.

## Authorization and organization isolation

Organization-scoped operations use `X-Organization-Id`, `loadOrganizationMembership`, and role authorization as configured on each route. Services must also scope resource queries and referenced documents by `req.user.orgId`; middleware alone does not secure an unscoped database query.

## Validation and errors

Request schemas are defined in: `src/modules/announcements/announcement.validation.js`. The route specifies which request sections are parsed. Validation errors are returned through the shared 422 error format.
Use `AppError` and shared error codes for expected domain failures. Unexpected failures should flow to centralized error handling.

## Tests

Relevant test files found in the archive:
- `test/unit/announcements/announcement.controller.test.js`
- `test/unit/announcements/announcement.service.test.js`

## Safe extension guidance

1. Read the route, validation schema, controller, service, repository and model before editing.
2. Preserve the distinction between global identity and organization-scoped records.
3. Validate all referenced IDs and confirm they belong to the same organization.
4. Preserve existing lifecycle transitions and historical records.
5. Add positive, negative, authorization and cross-organization tests.
6. Update the API reference and this document when externally observable behavior changes.

## Known limitations and future extensions

Only the implementation present in the listed files is guaranteed. Do not infer background jobs, push delivery, external event processing, advanced analytics, or additional workflow states unless source code explicitly implements them.
