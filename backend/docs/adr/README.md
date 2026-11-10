# Architecture Decision Records

Architecture Decision Records (ADRs) capture important technical decisions and their consequences. They help future maintainers understand the current architecture without relying on undocumented conversations.

## When to write an ADR

Create or update an ADR when a change materially affects:
- Application architecture or module boundaries.
- Authentication or authorization.
- Tenant isolation.
- Persistence and transaction strategy.
- API compatibility.
- External infrastructure or operational behavior.

Small implementation details do not need an ADR.

## Status values

- **Proposed:** under discussion.
- **Accepted:** adopted or currently represented by the implementation.
- **Superseded:** replaced by a later ADR.
- **Deprecated:** no longer recommended.

## Template

```markdown
# ADR NNNN: Decision title

- Status: Proposed
- Date: YYYY-MM-DD

## Context
What problem or constraint requires a decision?

## Decision
What approach is selected?

## Alternatives considered
Only list alternatives that were genuinely evaluated.

## Consequences
What becomes easier, harder, constrained, or possible?

## References
Relevant source files and documentation.
```

## Current-state ADRs

The ADRs below record observable architecture. Where historical rationale is not available, they explicitly avoid claiming that alternatives were formally evaluated.

- [0001 — Modular monolith](0001-modular-monolith.md)
- [0002 — MongoDB and Mongoose](0002-mongodb-mongoose.md)
- [0003 — Organization isolation](0003-organization-isolation.md)
- [0004 — Validation and centralized errors](0004-validation-and-errors.md)
- [0005 — Session-aware JWT authentication](0005-session-authentication.md)
- [0006 — Trainer matching and assignment separation](0006-trainer-matching.md)
