# Database architecture

## MongoDB and Mongoose

MongoDB stores application records as documents. Mongoose schemas define field types, required values, defaults, enums, validation, timestamps, references, and indexes. Models are located alongside their feature modules under `src/modules/`.

The database connection is centralized in `src/config/db.js`; modules import models rather than opening independent connections.

## Organization ownership

Many business documents contain an `org` ObjectId reference to `Organization`. This field is a tenant ownership marker. A query that loads an organization-owned resource should include both the resource identifier and the authenticated organization ID.

A Mongoose `ref` supports population and application-level relationship navigation; it does not by itself enforce referential integrity or tenant access.

## References and embedded documents

The repository uses both references and embedded subdocuments. Use references for independently managed records such as users, organizations, courses, requirements and assignments. Embedded structures are used where the data is part of a parent record's value, such as question structures or nested settings. Inspect the individual schema before changing a relationship.

## Indexes and constraints

Model files declare indexes for query patterns and uniqueness. Examples include organization-scoped slug uniqueness, unique organization/user membership, unique session token hashes, and expiry TTL indexes. The exact index inventory is documented in [Indexes and constraints](../06-database/indexes-and-constraints.md).

A unique index is a database-enforced constraint. A service-level existence check alone is not a concurrency-safe uniqueness guarantee.

## Transactions

Some multi-document workflows require a MongoDB session and transaction. The bootstrap script uses `withTransaction`; trainer assignment creation coordinates assignment and trainer capacity changes transactionally. A transaction-capable MongoDB deployment is required for these workflows.

## Test database

The test helper under `test/helpers/database.js` configures the integration test database using `mongodb-memory-server`. Test lifecycle and cleanup behavior are described in [Test database](../09-testing/test-database.md).

## Further reading

- [Database overview](../06-database/database-overview.md)
- [Data models](../06-database/data-models.md)
- [Relationships](../06-database/relationships.md)
- [Data integrity](../06-database/data-integrity.md)
