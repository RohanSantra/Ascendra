# Modifying existing features safely

## Trace the full behavior

Before editing, follow this path:

1. Route registration in `src/routes/index.js`.
2. Feature route middleware and endpoint.
3. Validation schema.
4. Controller.
5. Service.
6. Repository and model.
7. Shared utilities and other modules called by the service.
8. Unit and integration tests.

## Assess impact

Check whether the change affects:
- Public API paths, request fields, response shapes or error codes.
- Role and organization access rules.
- Model fields, indexes, defaults or references.
- Transactions and external side effects.
- Historical snapshots or lifecycle transitions.
- Dashboards/reporting aggregations.
- Tests, fixtures and seed/bootstrap behavior.
- Environment variables and deployment instructions.

## Preserve compatibility

Avoid renaming/removing persisted fields or changing enum values without considering existing records and clients. For schema changes, plan any required migration/backfill; this repository does not establish a general migration framework.

## Verify

Run targeted tests first, then `npm run check` and `npm run test:coverage`. Add negative tests, especially for tenant isolation and invalid lifecycle transitions.

## Update docs

Update every document affected by the behavior. API contract changes require updates to the OpenAPI specification and endpoint documentation.
