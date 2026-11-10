# Integration testing

## Purpose

Integration tests verify that multiple real application components work together: route middleware, controllers, services, models, MongoDB constraints and transaction behavior.

## Database setup

Use the shared in-memory replica-set helper from `test/helpers/database.js`. It starts a one-node replica set, connects Mongoose, clears collections between test cases where appropriate, and stops the replica set during teardown.

## Recommended lifecycle

```js
import test from "node:test";
import {
    startTestDatabase,
    clearTestDatabase,
    stopTestDatabase
} from "../../helpers/database.js";

test.before(async () => {
    await startTestDatabase();
});

test.beforeEach(async () => {
    await clearTestDatabase();
});

test.after(async () => {
    await stopTestDatabase();
});
```

Adapt hook placement to the suite's actual lifecycle. Do not start multiple shared replica sets in parallel against the same Mongoose connection.

## Workflow coverage

Integration tests should cover:
- Registration/login/refresh/logout and password reset.
- Organization application and membership/invitation lifecycles.
- Evidence submission and verification.
- Matching execution and match history.
- Assignment capacity reservation and transitions.
- Course content, enrollment, assessment attempts and learning progress.
- Server startup, shutdown, error and rate-limit behavior.

## Isolation

Use unique emails, slugs and other unique-index values per test. Clear the database between tests when suites share a database. Always test cross-organization access using records owned by different organizations.
