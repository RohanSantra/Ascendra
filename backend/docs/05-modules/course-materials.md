# Course materials

## Purpose

Coordinates course material metadata and upload intent confirmation with a storage adapter. The actual asset is stored outside MongoDB.

## Implementation status

**Implemented in the checked-in source.** The scope described below is limited to the files and routes listed here; future extensions should be documented separately until implemented.

## Responsibilities and boundaries

Course content metadata, upload intents, storage integration, access authorization, and archival.

This module should own its domain rules. Cross-module workflows should use the existing service/repository conventions and validate that referenced records belong to the same organization where applicable.

## Source files

| Type | Files |
|---|---|
| Model | `src/modules/courseMaterials/courseMaterial.model.js`, `src/modules/courseMaterials/courseMaterialUploadIntent.model.js` |
| Route | `src/modules/courseMaterials/courseMaterial.routes.js` |
| Controller | `src/modules/courseMaterials/courseMaterial.controller.js` |
| Service / repository / engine | `src/modules/courseMaterials/courseMaterial.repository.js`, `src/modules/courseMaterials/courseMaterial.service.js`, `src/modules/courseMaterials/courseMaterialUploadIntent.repository.js` |
| Validation | `src/modules/courseMaterials/courseMaterial.validation.js` |

## Data model

### `courseMaterial`
Defined in `src/modules/courseMaterials/courseMaterial.model.js`.
Top-level schema fields identified from the current schema declaration: `org`, `course`, `title`, `description`, `materialType`, `file`, `uploadedBy`, `displayOrder`, `status`.
Read the model file for exact types, defaults, nested schema details, validators, indexes, timestamps, and immutable/select behavior before changing the schema.

### `courseMaterialUploadIntent`
Defined in `src/modules/courseMaterials/courseMaterialUploadIntent.model.js`.
Top-level schema fields identified from the current schema declaration: `org`, `course`, `uploadedBy`, `publicId`, `resourceType`, `originalName`, `mimeType`, `size`, `status`, `expiresAt`, `consumedAt`.
Read the model file for exact types, defaults, nested schema details, validators, indexes, timestamps, and immutable/select behavior before changing the schema.

## API routes

| Method | Endpoint | Access note | Description |
|---|---|---|---|
| `POST` | `/api/v1/courses/:courseId/materials/upload/initiate` | Trainer, Organisation Admin | Initializes a direct-to-Cloudinary course material upload. |
| `POST` | `/api/v1/courses/:courseId/materials/upload/confirm` | Trainer, Organisation Admin | Verifies a completed Cloudinary upload and registers the course material. |
| `GET` | `/api/v1/courses/:courseId/materials` | Trainer, Trainee, Organisation Admin | Retrieves course materials with pagination and filtering. |
| `GET` | `/api/v1/courses/:courseId/materials/:materialId/access` | Trainer, Trainee, Organisation Admin | Generates a temporary authenticated URL for accessing a course material. |
| `GET` | `/api/v1/courses/:courseId/materials/:materialId` | Trainer, Trainee, Organisation Admin | Retrieves a specific course material. |
| `PATCH` | `/api/v1/courses/:courseId/materials/:materialId` | Trainer, Organisation Admin | Updates course material metadata. |
| `PATCH` | `/api/v1/courses/:courseId/materials/:materialId/archive` | Trainer, Organisation Admin | Archives a course material without deleting its Cloudinary file. |

These paths include the default `/api/v1` prefix. The prefix is configurable through `API_VERSION`. Access notes are taken from route annotations; confirm the actual middleware chain in the listed route file.

## Main workflow

An authorized course actor initiates an upload, obtains storage upload details, confirms the uploaded asset, and later lists/retrieves/accesses/updates/archives material metadata. Upload intent records coordinate the upload lifecycle.

## Authorization and organization isolation

Organization-scoped operations use `X-Organization-Id`, `loadOrganizationMembership`, and role authorization as configured on each route. Services must also scope resource queries and referenced documents by `req.user.orgId`; middleware alone does not secure an unscoped database query.

## Validation and errors

Request schemas are defined in: `src/modules/courseMaterials/courseMaterial.validation.js`. The route specifies which request sections are parsed. Validation errors are returned through the shared 422 error format.
Use `AppError` and shared error codes for expected domain failures. Unexpected failures should flow to centralized error handling.

## Tests

Relevant test files found in the archive:
- `test/unit/modules/courseMaterials/courseMaterial.controller.behavior.test.js`
- `test/unit/modules/courseMaterials/courseMaterial.controller.test.js`
- `test/unit/modules/courseMaterials/courseMaterial.model.test.js`
- `test/unit/modules/courseMaterials/courseMaterial.repository.test.js`
- `test/unit/modules/courseMaterials/courseMaterial.service.behavior.test.js`
- `test/unit/modules/courseMaterials/courseMaterial.service.test.js`
- `test/unit/modules/courseMaterials/courseMaterial.storage.test.js`
- `test/unit/modules/courseMaterials/courseMaterial.validation.test.js`

## Safe extension guidance

1. Read the route, validation schema, controller, service, repository and model before editing.
2. Preserve the distinction between global identity and organization-scoped records.
3. Validate all referenced IDs and confirm they belong to the same organization.
4. Preserve existing lifecycle transitions and historical records.
5. Add positive, negative, authorization and cross-organization tests.
6. Update the API reference and this document when externally observable behavior changes.

## Known limitations and future extensions

Only the implementation present in the listed files is guaranteed. Do not infer background jobs, push delivery, external event processing, advanced analytics, or additional workflow states unless source code explicitly implements them.
