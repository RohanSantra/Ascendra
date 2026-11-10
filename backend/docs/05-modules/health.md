# Health checks

## Purpose

Provides liveness and readiness endpoints for service monitoring.

## Implementation status

**Implemented in the checked-in source.** The scope described below is limited to the files and routes listed here; future extensions should be documented separately until implemented.

## Responsibilities and boundaries

Liveness and readiness endpoints for process and dependency health.

This module should own its domain rules. Cross-module workflows should use the existing service/repository conventions and validate that referenced records belong to the same organization where applicable.

## Source files

| Type | Files |
|---|---|
| Route | `src/modules/health/health.routes.js` |
| Controller | `src/modules/health/health.controller.js` |

## Data model

No Mongoose model file is owned by this module mapping. It may use models from another module or operate as a read-only aggregation layer.
## API routes

| Method | Endpoint | Access note | Description |
|---|---|---|---|
| `GET` | `/api/v1/health/live` | Public | Reports whether the process can respond to HTTP requests. |
| `GET` | `/api/v1/health/ready` | Public | Reports whether the service is ready, including MongoDB connectivity and shutdown state. |

These paths include the default `/api/v1` prefix. The prefix is configurable through `API_VERSION`. Access notes are taken from route annotations or the visible middleware chain; the route file is authoritative.

## Main workflow

The liveness route indicates that the process can answer. The readiness route reports the readiness checks implemented by its controller; do not interpret liveness as proof that every external dependency is healthy.

## Authorization and organization isolation

Some routes in this module are public or platform-scoped. Follow the route-level middleware; do not assume all operations require organization context.

## Validation and errors

No module-local Zod validation file was identified in the mapped source. Check route-level schemas in adjacent modules before adding or changing inputs.
Use `AppError` and shared error codes for expected domain failures. Unexpected failures should flow to centralized error handling.

## Tests

No test file could be confidently mapped by filename. Search `test/unit/` and `test/integration/` for the relevant service/controller/model behavior.

## Safe extension guidance

1. Read the route, validation schema, controller, service, repository and model before editing.
2. Preserve the distinction between global identity and organization-scoped records.
3. Validate all referenced IDs and confirm they belong to the same organization.
4. Preserve existing lifecycle transitions and historical records.
5. Add positive, negative, authorization and cross-organization tests.
6. Update the API reference and this document when externally observable behavior changes.

## Known limitations and future extensions

Only the implementation present in the listed files is guaranteed. Do not infer background jobs, push delivery, external event processing, advanced analytics, or additional workflow states unless source code explicitly implements them.
