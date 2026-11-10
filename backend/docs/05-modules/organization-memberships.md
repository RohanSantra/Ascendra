# Organization memberships

## Purpose

Owns the per-organization role and membership lifecycle. A membership is unique for an organization/user pair and has pending, approved, rejected, or suspended status.

## Implementation status

**Implemented in the checked-in source.** The scope described below is limited to the files and routes listed here; future extensions should be documented separately until implemented.

## Responsibilities and boundaries

A user's role and approval state within a selected organization, distinct from global identity and trainer eligibility.

This module should own its domain rules. Cross-module workflows should use the existing service/repository conventions and validate that referenced records belong to the same organization where applicable.

## Source files

| Type | Files |
|---|---|
| Model | `src/modules/organizationMemberships/organizationMembership.model.js` |
| Route | `src/modules/organizationMemberships/organizationMembership.routes.js` |
| Controller | `src/modules/organizationMemberships/organizationMembership.controller.js` |
| Service / repository / engine | `src/modules/organizationMemberships/organizationMembership.service.js` |
| Validation | `src/modules/organizationMemberships/organizationMembership.validation.js` |

## Data model

### `organizationMembership`
Defined in `src/modules/organizationMemberships/organizationMembership.model.js`.
Top-level schema fields identified from the current schema declaration: `org`, `user`, `role`, `status`, `joinedAt`, `approvedBy`, `approvedAt`, `rejectedBy`, `rejectedAt`, `rejectionReason`, `suspendedAt`, `suspendedBy`.
Read the model file for exact types, defaults, nested schema details, validators, indexes, timestamps, and immutable/select behavior before changing the schema.

## API routes

| Method | Endpoint | Access note | Description |
|---|---|---|---|
| `GET` | `/api/v1/memberships/me` | Authenticated user | Lists memberships of the authenticated user. |
| `POST` | `/api/v1/memberships/request` | Authenticated user | Requests membership in an existing organization. |
| `GET` | `/api/v1/memberships/pending` | Admin | Lists pending organisation membership requests. |
| `PATCH` | `/api/v1/memberships/:id/approve` | Admin | Approves a pending membership. |
| `PATCH` | `/api/v1/memberships/:id/reject` | Admin | Rejects a pending membership. |
| `PATCH` | `/api/v1/memberships/:id/suspend` | Admin | Suspends an approved membership. |

These paths include the default `/api/v1` prefix. The prefix is configurable through `API_VERSION`. Access notes are taken from route annotations; confirm the actual middleware chain in the listed route file.

## Main workflow

Users request membership or accept invitations. Organization administrators list pending requests and approve, reject, or suspend memberships. Organization-scoped access requires approved membership.

## Authorization and organization isolation

Organization-scoped operations use `X-Organization-Id`, `loadOrganizationMembership`, and role authorization as configured on each route. Services must also scope resource queries and referenced documents by `req.user.orgId`; middleware alone does not secure an unscoped database query.

## Validation and errors

Request schemas are defined in: `src/modules/organizationMemberships/organizationMembership.validation.js`. The route specifies which request sections are parsed. Validation errors are returned through the shared 422 error format.
Use `AppError` and shared error codes for expected domain failures. Unexpected failures should flow to centralized error handling.

## Tests

Relevant test files found in the archive:
- `test/unit/modules/organizationMemberships/controller.behavior.test.js`
- `test/unit/modules/organizationMemberships/service.behavior.test.js`

## Safe extension guidance

1. Read the route, validation schema, controller, service, repository and model before editing.
2. Preserve the distinction between global identity and organization-scoped records.
3. Validate all referenced IDs and confirm they belong to the same organization.
4. Preserve existing lifecycle transitions and historical records.
5. Add positive, negative, authorization and cross-organization tests.
6. Update the API reference and this document when externally observable behavior changes.

## Known limitations and future extensions

Only the implementation present in the listed files is guaranteed. Do not infer background jobs, push delivery, external event processing, advanced analytics, or additional workflow states unless source code explicitly implements them.
