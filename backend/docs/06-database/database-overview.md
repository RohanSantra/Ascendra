# Database overview

## Database technology

Ascendra uses MongoDB through Mongoose. Connection setup is centralized in `src/config/db.js`, and the connection URI is required through `MONGODB_URI`.

## Document design

Each feature module defines its own Mongoose model. Documents may contain:
- Scalar values such as strings, numbers, booleans and dates.
- ObjectId references to related models.
- Embedded subdocuments for tightly coupled values.
- Arrays of references or embedded values.
- Lifecycle/status fields and audit timestamps.

The model source is authoritative for exact field types, defaults and validators.

## Organization ownership

Organization-owned data commonly includes an `org` reference. Organization ID is used as a tenant scope in queries and compound indexes. A reference to an organization does not automatically enforce authorization; service/repository queries must still scope by the authenticated organization.

## Timestamps and versioning

Many schemas enable Mongoose timestamps. Assessment definitions and matching configurations have explicit domain versioning in addition to any Mongoose timestamps. Do not confuse domain version fields with Mongoose's internal version key.

## Connection lifecycle

The application connects before starting its HTTP listener. Connection events are logged. `disconnectDatabase()` is used during graceful shutdown.

## Transactions

Some operations require atomic writes across documents. The bootstrap process and trainer assignment/capacity workflow use transactions. A transaction-capable replica-set MongoDB deployment is required.

## Model catalogue

See [Data models](data-models.md) for the model inventory, [Relationships](relationships.md) for the conceptual graph, and [Indexes and constraints](indexes-and-constraints.md) for explicit index declarations.
