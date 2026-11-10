# Transactions

## Why transactions are used

A MongoDB transaction groups multiple database writes so they commit or roll back together. Use one when partial completion would violate a business invariant.

## Transaction-backed workflows found in the repository

### Initial bootstrap

`scripts/bootstrap.js` starts a Mongoose session and runs the creation/check workflow inside `session.withTransaction()`. It creates the initial platform administrator, active organization and approved admin membership as one unit.

### Trainer assignment and capacity

The trainer assignment model documents that active training capacity must be reserved atomically with assignment creation. The service coordinates the assignment and trainer-profile capacity update within a transaction. Inspect `src/modules/trainerAssignments/trainerAssignment.service.js` for the exact transaction boundary and rollback behavior.

Other services may use sessions for operations not listed here; search the source before assuming this list is exhaustive.

## Deployment requirement

MongoDB transactions require a replica set or a compatible sharded cluster. A standalone MongoDB deployment will reject transaction operations.

## Developer checklist

1. Start a session from the shared Mongoose connection.
2. Pass the session to every query/write that belongs to the transaction.
3. Use `withTransaction()` or the established module pattern.
4. Keep external side effects (email, storage calls) outside the transaction where possible; a database rollback cannot undo an email already sent.
5. End the session in `finally`.
6. Test both successful commit and failure/rollback behavior.
7. Avoid long-running transactions and unbounded work inside a transaction callback.

## Testing

Integration tests should run against a transaction-capable test MongoDB configuration. Review `test/helpers/database.js` and the integration tests for the actual setup.
