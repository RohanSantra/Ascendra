# Architectural decisions (current-state record)

This document summarizes decisions observable in the current code. It is not a substitute for dated ADRs and does not claim to recover undocumented historical reasoning.

## Modular monolith

**Observed decision:** Business capabilities are grouped under `src/modules/` and composed into one Express application.

**Why this is useful:** It keeps local development and deployment straightforward while allowing domain code to remain organized by feature.

**Implication:** Modules share one process and database connection. Cross-module imports are possible, so developers should keep dependencies intentional and avoid circular dependencies.

See [ADR 0001](../adr/0001-modular-monolith.md).

## MongoDB and Mongoose

**Observed decision:** Domain records are persisted as MongoDB documents and Mongoose schemas.

**Implication:** References are application-level relationships unless a MongoDB index or service workflow enforces a constraint. MongoDB transactions are used where coordinated writes need atomicity.

See [ADR 0002](../adr/0002-mongodb-mongoose.md).

## Organization-scoped authorization

**Observed decision:** Authentication identifies the global user; `X-Organization-Id` selects organization context for routes that load membership. Membership status and role are checked before a request is allowed to continue.

**Implication:** A client-supplied organization ID is a selector, not proof of access. Every organization-owned query must still scope the target record by that organization.

See [ADR 0003](../adr/0003-organization-isolation.md).

## Centralized validation and errors

**Observed decision:** Zod validation middleware parses selected request sections into `req.validated`; controlled failures use `AppError`; a final error middleware normalizes known failures.

**Implication:** Controllers should consume validated input where available and use shared error conventions rather than inventing ad hoc response shapes.

See [ADR 0004](../adr/0004-validation-and-errors.md).

## Authentication and persisted sessions

**Observed decision:** Access JWTs identify a user and session; refresh tokens are persisted as hashes in session records and delivered through a cookie.

**Implication:** Token validity alone is insufficient. Authentication also checks session state, user status, and password-change timing.

See [ADR 0005](../adr/0005-session-authentication.md).

## Trainer matching

**Observed decision:** Matching configuration, matching execution/history, and assignment are distinct concerns. The matching engine evaluates candidates and persists run data; a later assignment reserves a trainer for a requirement.

**Implication:** A match result must not be treated as an assignment. Configuration and match-run snapshots should remain traceable.

See [ADR 0006](../adr/0006-trainer-matching.md).

## Open questions

- The package metadata declares ISC while the checked-in `LICENSE` text is MIT. The project owner must reconcile this before release.
- Organization-admin reporting routes include duplicate registrations for activity and assessment-performance paths. See [known limitations](../12-reference/known-limitations.md).
- Deployment topology, shared rate-limit storage, and a formal API publishing process are not specified by the repository.
