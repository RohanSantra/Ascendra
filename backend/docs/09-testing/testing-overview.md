# Testing overview

## Test framework

The project uses Node.js's built-in test runner (`node:test`) and `node:assert/strict`. Tests are JavaScript ES modules and are discovered by the npm `test` script.

## Test categories

- **Unit tests:** focused tests for models, validation, utilities, middleware, controllers, services and repositories. External collaborators may be stubbed.
- **Integration tests:** exercise multi-component workflows, Express routes, server lifecycle, MongoDB persistence and cross-module behavior.

## Database tests

`test/helpers/database.js` starts an in-memory one-node MongoDB replica set using `MongoMemoryReplSet` with WiredTiger. This supports transaction tests. It exports:
- `startTestDatabase()`
- `clearTestDatabase()`
- `stopTestDatabase()`

## Commands

```bash
npm test
npm run test:watch
npm run test:coverage
npm run lint
npm run check
```

`npm run check` runs ESLint and then the full test suite.

## Last reported baseline

The latest full test run reported by the project owner was **741 passing tests, zero failures**. The previously reported coverage was:
- Lines: 97.10%
- Branches: 91.92%
- Functions: 96.53%

These are historical reported results, not results executed while preparing this documentation. Re-run the commands to establish the current baseline.

## Testing principles

Test observable behavior, not only implementation details. Include success, validation failure, authorization failure, cross-organization access, lifecycle transitions, database constraints, and transaction rollback where applicable.
