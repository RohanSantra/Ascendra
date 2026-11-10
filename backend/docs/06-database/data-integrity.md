# Data integrity

## Integrity mechanisms

Ascendra uses several complementary mechanisms:

| Mechanism | What it protects | Example |
|---|---|---|
| Mongoose schema validation | Document shape and field-level constraints | Required fields, enums, minimums, custom validators |
| MongoDB unique indexes | Concurrent uniqueness | User email, membership pair, organization slug |
| Compound indexes | Efficient tenant-scoped lookup and constraints | Organization plus slug/status |
| Partial unique indexes | Conditional uniqueness | One active matching config per organization; one pending invitation per organization/email |
| TTL indexes | Eventual cleanup after expiry | Session, password-reset token and upload intent |
| Service rules | Domain state transitions and business invariants | Membership approval, trainer eligibility, assignment lifecycle |
| Transactions | Atomic multi-document state changes | Bootstrap and assignment/capacity reservation |
| Organization reference helper | Existence and tenant ownership checks for referenced documents | `assertOrganizationReferences()` |

## Referential checks

`assertOrganizationReferences()` in `src/core/utils/organizationReferences.js` validates that referenced IDs exist under the expected organization field. It supports custom reference field names and optional Mongoose sessions.

Use it where the service needs to validate organization-owned references. It does not replace scoping the primary resource query.

## Lifecycle integrity

Do not update status fields arbitrarily. Follow the service transitions and update related audit fields (reviewer, timestamps, reasons) together. For example:
- Membership approval/rejection/suspension is distinct from trainer approval.
- Evidence verification may trigger trainer competency recomputation.
- Assignment transitions must preserve trainer capacity.
- Assessment attempts refer to an assessment version snapshot.
- Archived records may remain stored and must not be treated as deleted.

## Soft deletion and expiry

Some models use deletion/supersession flags; some use TTL indexes. TTL cleanup is asynchronous. A document that is expired but not yet physically deleted must still be treated as expired by application logic.

## When changing a schema

- Check existing records and migration/backfill implications.
- Check indexes and unique constraints.
- Update all services that read/write the field.
- Update validation schemas and API docs.
- Add model, service and integration tests.
- Consider cross-organization references and historical snapshots.
