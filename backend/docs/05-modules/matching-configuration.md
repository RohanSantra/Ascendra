# Matching configuration

## Purpose

Stores versioned organization matching settings, including weights, thresholds, evidence rules, proficiency levels and tie-break ordering.

## Implementation status

**Implemented in the checked-in source.** The scope described below is limited to the files and routes listed here; future extensions should be documented separately until implemented.

## Responsibilities and boundaries

Organization-level versioned configuration for trainer matching factors and activation of a configuration version.

This module should own its domain rules. Cross-module workflows should use the existing service/repository conventions and validate that referenced records belong to the same organization where applicable.

## Source files

| Type | Files |
|---|---|
| Model | `src/modules/matchingConfig/matchingConfig.model.js` |
| Route | `src/modules/matchingConfig/matchingConfig.routes.js` |
| Controller | `src/modules/matchingConfig/matchingConfig.controller.js` |
| Service / repository / engine | `src/modules/matchingConfig/matchingConfig.service.js` |
| Validation | `src/modules/matchingConfig/matchingConfig.validation.js` |

## Data model

### `matchingConfig`
Defined in `src/modules/matchingConfig/matchingConfig.model.js`.
Top-level schema fields identified from the current schema declaration: `org`, `version`, `isActive`, `weights`, `thresholds`, `evidenceRules`, `proficiencyLevels`, `tieBreakOrder`, `defaultResultLimit`, `algorithmVersion`, `createdBy`, `updatedBy`.
Read the model file for exact types, defaults, nested schema details, validators, indexes, timestamps, and immutable/select behavior before changing the schema.

## API routes

| Method | Endpoint | Access note | Description |
|---|---|---|---|
| `GET` | `/api/v1/matching-config/active` | Organization Admin | Retrieves the active matching configuration. |
| `GET` | `/api/v1/matching-config/versions` | Organization Admin | Lists matching configuration versions. |
| `POST` | `/api/v1/matching-config` | Organization Admin | Creates the initial matching configuration. |
| `POST` | `/api/v1/matching-config/versions` | Organization Admin | Creates a new matching configuration version. |
| `PATCH` | `/api/v1/matching-config/versions/:id/activate` | Organization Admin | Activates an existing matching configuration version. |

These paths include the default `/api/v1` prefix. The prefix is configurable through `API_VERSION`. Access notes are taken from route annotations; confirm the actual middleware chain in the listed route file.

## Main workflow

The organization can inspect the active configuration and versions, create configuration data/versions, and activate a version. The model stores weights, thresholds, evidence rules, proficiency levels, tie-break order and algorithm version.

## Authorization and organization isolation

Organization-scoped operations use `X-Organization-Id`, `loadOrganizationMembership`, and role authorization as configured on each route. Services must also scope resource queries and referenced documents by `req.user.orgId`; middleware alone does not secure an unscoped database query.

## Validation and errors

Request schemas are defined in: `src/modules/matchingConfig/matchingConfig.validation.js`. The route specifies which request sections are parsed. Validation errors are returned through the shared 422 error format.
Use `AppError` and shared error codes for expected domain failures. Unexpected failures should flow to centralized error handling.

## Tests

Relevant test files found in the archive:
- `test/unit/modules/matchingConfig/controller.behavior.test.js`
- `test/unit/modules/matchingConfig/module.contracts.test.js`
- `test/unit/modules/matchingConfig/service.behavior.test.js`

## Safe extension guidance

1. Read the route, validation schema, controller, service, repository and model before editing.
2. Preserve the distinction between global identity and organization-scoped records.
3. Validate all referenced IDs and confirm they belong to the same organization.
4. Preserve existing lifecycle transitions and historical records.
5. Add positive, negative, authorization and cross-organization tests.
6. Update the API reference and this document when externally observable behavior changes.

## Known limitations and future extensions

Only the implementation present in the listed files is guaranteed. Do not infer background jobs, push delivery, external event processing, advanced analytics, or additional workflow states unless source code explicitly implements them.
