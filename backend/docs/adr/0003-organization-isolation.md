# ADR 0003: Organization-scoped authorization

- Status: Accepted (current-state record)
- Date: 2026-11-10

## Context

Multiple organizations use the same Ascendra backend. A global user may belong to more than one organization and can hold different organization roles.

## Decision

The backend separates global user identity from organization membership. Organization-scoped routes select context through `X-Organization-Id`; `loadOrganizationMembership` verifies the organization, active state, membership and approved status before adding organization context to `req.user`.

## Alternatives considered

The repository does not contain a formal historical comparison of tenant-selection strategies.

## Consequences

- Organization role is separate from global platform role.
- Middleware establishes context but does not automatically scope every Mongoose query.
- Services/repositories must include organization ownership in resource queries and validate cross-references.
- Tests must include cross-organization denial cases.

## References

- `src/modules/auth/authorization.middleware.js`
- `src/core/utils/organizationReferences.js`
- [Multi-tenancy](../03-architecture/multi-tenancy.md)
- [Organization isolation](../08-security/organization-isolation.md)
