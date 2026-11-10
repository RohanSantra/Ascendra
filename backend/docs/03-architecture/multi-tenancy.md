# Multi-tenancy

## Tenant model

An `Organization` is the tenant boundary. Users are global identities and may have memberships in multiple organizations. Each `OrganizationMembership` associates one user with one organization and assigns an organization role.

## Request context

For routes that require organization context, clients send:

```http
X-Organization-Id: <organization ObjectId>
```

The header selects the organization. It does not grant access.

`loadOrganizationMembership` performs these checks:

1. The request is authenticated.
2. The header exists and contains a valid MongoDB ObjectId.
3. The organization exists.
4. The organization status is active.
5. A membership exists for the selected organization and authenticated user.
6. The membership is approved (suspended, rejected, and pending memberships are denied).

On success, the middleware adds `orgId`, `membershipId`, and membership `role` to `req.user`.

## Authorization scopes

- `authorizeRoles(...)` checks organization membership roles (`admin`, `trainer`, `trainee`).
- `authorizePlatformAdmin` checks the global `platformRole` and does not require organization membership.

Do not interchange these two authorization models.

## Query isolation rule

Every organization-owned read, update, and delete must scope by the selected organization. A safe lookup pattern is conceptually:

```js
Model.findOne({
    _id: resourceId,
    org: req.user.orgId
});
```

Use the actual service/repository convention in the module. Do not load by `_id` alone and then assume the caller is entitled to the record.

## Organization reference helper

`src/core/utils/organizationReferences.js` contains shared organization-reference utilities. Inspect its exports and tests before introducing a new organization-reference validation pattern.

## Cross-organization protection checklist

- Obtain the organization ID from authenticated request context, not from an untrusted body field.
- Verify membership before organization-scoped actions.
- Include `org` in model queries and writes.
- Verify referenced resources belong to the same organization.
- Scope list/count/aggregate pipelines by organization.
- Ensure nested references (course, requirement, trainer, material, enrollment) cannot cross tenant boundaries.
- Add negative tests proving that a member of organization A cannot access organization B's records.

## Known limitation to keep in mind

A middleware check does not automatically secure all database operations. Tenant isolation is a responsibility of each relevant service/repository and its tests. Review the specific module before changing its query logic.
