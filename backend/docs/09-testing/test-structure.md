# Test structure

```text
test/
├── helpers/
│   └── database.js
├── integration/
│   ├── auth/
│   ├── core/
│   ├── dashboards/
│   ├── matching/
│   ├── organizationInvitations/
│   ├── competencyEvidence/
│   ├── assessments/
│   └── courses/
└── unit/
    ├── config/
    ├── middleware/
    ├── core/
    └── modules/
```

The exact directory tree contains additional module-specific files; inspect `test/` for the complete current inventory.

## Naming

Tests generally use `.test.js` and are grouped by feature. Some newer module tests use behavior/contract naming such as `service.behavior.test.js`, `controller.behavior.test.js`, and `module.contracts.test.js`.

## Test ownership

- Model tests verify schema constraints, indexes where testable, and model behavior.
- Validation tests verify accepted and rejected input.
- Service tests verify business rules and state transitions.
- Controller tests verify HTTP-facing orchestration and response behavior.
- Repository tests verify query filters and persistence interactions.
- Integration tests verify workflows across modules and infrastructure.

## Shared helpers

`test/helpers/database.js` owns the in-memory replica-set lifecycle. Prefer existing helpers and patterns over creating a second database lifecycle mechanism.

## Discovery

The package script is `node --test "test/**/*.test.js"`. If adding a test, place it beneath `test/` with a `.test.js` suffix and confirm it is discovered by `npm test`.
