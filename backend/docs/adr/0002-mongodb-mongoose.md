# ADR 0002: MongoDB and Mongoose persistence

- Status: Accepted (current-state record)
- Date: 2026-11-10

## Context

Ascendra stores related domain records such as users, memberships, trainer profiles, evidence, requirements, match runs, courses and learning activity.

## Decision

The backend uses MongoDB as its database and Mongoose for connection management, schemas, models, validation and indexes.

## Alternatives considered

No verified historical evaluation of alternative databases or object mappers is present in the repository.

## Consequences

- Domain records are documents with ObjectId references and embedded subdocuments.
- Referential integrity is partly application-managed; ObjectId refs are not relational foreign keys.
- Compound and partial unique indexes enforce selected uniqueness rules.
- Multi-document transactions require a replica-set/compatible deployment.
- Schema and index changes must account for existing persisted documents.

## References

- `src/config/db.js`
- `src/modules/*/*.model.js`
- `test/helpers/database.js`
- [Database overview](../06-database/database-overview.md)
