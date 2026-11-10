# Organization isolation

## Trust boundary

The client supplies `X-Organization-Id` to select a tenant context. The backend validates the organization and the user's membership; the header itself is not authorization.

## Middleware checks

`loadOrganizationMembership`:
- Requires an authenticated user.
- Requires a valid ObjectId in `X-Organization-Id`.
- Requires an existing active organization.
- Requires a membership for that user and organization.
- Requires membership status `approved`.
- Attaches `orgId`, `membershipId`, and organization `role` to `req.user`.

## Service/repository responsibility

Middleware does not automatically add tenant filters to Mongoose queries. Each organization-owned service must scope resource reads, updates, deletes, list operations, counts, and aggregation pipelines.

Prefer filters containing both the requested resource ID and `org: req.user.orgId`. Validate references to other organization-owned models with the shared organization-reference helper where appropriate.

## Cross-tenant test cases

For every organization-scoped feature, test:
- Member of organization A can access A's resource.
- Member of organization A cannot retrieve B's resource by ID.
- Member of A cannot update/delete B's resource.
- A cannot reference B's course, trainer, competency, skill, requirement or other tenant-owned record.
- Pending, rejected and suspended membership cannot access protected organization routes.
- Suspended organization cannot be selected.

## Source references

- `src/modules/auth/authorization.middleware.js`
- `src/core/utils/organizationReferences.js`
- Organization-owned model schemas and service/repository queries.
