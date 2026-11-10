# Unit testing

## Purpose

Unit tests isolate one behavior and provide fast feedback. The repository uses `node:test` and `node:assert/strict`.

## Typical pattern

```js
import test from "node:test";
import assert from "node:assert/strict";

test("describes the behavior being verified", async () => {
    const result = await subjectUnderTest(input);
    assert.equal(result, expected);
});
```

Use the actual module's existing setup and cleanup pattern. The snippet is a minimal illustration, not a replacement for feature-specific fixtures.

## What to test

- Accepted and rejected validation input.
- Service business rules and state transitions.
- Missing resources and conflicting state.
- Authorization branches.
- Repository filters, especially organization scoping.
- Error mapping and response envelopes.
- Boundary values, optional fields and defaults.

## Collaborators

When stubbing a Mongoose model or repository, reproduce the query-chain methods used by the subject (for example `select`, `lean`, `session`, `exec`, or `sort`) rather than returning a simplified value that bypasses the code path.

## Avoid

- Tests that depend on execution order.
- Reusing globally unique records across tests without cleanup.
- Assertions against incidental implementation details when behavior is the contract.
- Swallowing errors or using broad assertions that allow unintended outcomes.
