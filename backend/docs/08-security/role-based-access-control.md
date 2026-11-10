# Role-based access control

## Two role scopes

| Role field / context | Scope | Values evidenced in source |
|---|---|---|
| `User.platformRole` | Global platform | `platform_admin` is used by platform authorization/bootstrap |
| `OrganizationMembership.role` | One organization | `admin`, `trainer`, `trainee` |

The organization role is copied to `req.user.role` only after `loadOrganizationMembership` verifies the selected organization and approved membership.

## Middleware

- `authorizePlatformAdmin` checks `req.user.platformRole === "platform_admin"`.
- `authorizeRoles(...allowedRoles)` accepts only the known organization role values and rejects requests without a loaded organization role.
- Routes define the actual access policy. Route comments describe intended access; middleware is the enforcement.

## Membership status

Membership status values include `pending`, `approved`, `rejected`, and `suspended`. Only `approved` membership passes `loadOrganizationMembership`.

## Trainer approval is separate

Trainer eligibility is stored under the trainer profile approval subdocument. A trainer can have an approved membership while trainer approval remains pending. Do not merge these state machines.

## Review checklist for a new endpoint

1. Is it public, globally authenticated, platform-admin-only, or organization-scoped?
2. Does it require `authenticate`?
3. Does it require `loadOrganizationMembership`?
4. Which organization roles may perform it?
5. Does the service verify ownership of all referenced resources?
6. Are unauthorized and cross-organization cases tested?
