# Test database

## Implementation

`test/helpers/database.js` uses `MongoMemoryReplSet.create()` with:
- One replica-set member.
- WiredTiger storage engine.
- A generated in-memory MongoDB URI.
- Mongoose connection with a 5-second server-selection timeout.

The helper exports `startTestDatabase`, `clearTestDatabase`, and `stopTestDatabase`.

## Why a replica set?

Several application workflows use MongoDB transactions. A standalone in-memory server would not exercise those workflows correctly. The one-node replica set provides a transaction-capable local test database.

## Cleanup behavior

`clearTestDatabase()` enumerates current Mongoose collections and runs `deleteMany({})` for each. It preserves collection/index definitions while removing documents.

`stopTestDatabase()` disconnects Mongoose and stops the replica set.

## Cautions

- Ensure cleanup runs even after test failures.
- Do not run suites that mutate the same Mongoose connection/database concurrently unless their setup explicitly supports it.
- Use unique data when a test intentionally verifies duplicate-key behavior.
- Avoid using a production database URI for tests.
