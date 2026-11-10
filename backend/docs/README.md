# Ascendra Backend Documentation

Welcome to the technical documentation for the Ascendra backend. This documentation explains the product domain, how the application is built, how to operate it, and how to make changes safely.

## Start here

If you are new to the repository, follow this sequence:

1. [Project overview](01-introduction/project-overview.md) — understand what Ascendra does.
2. [Product context](01-introduction/product-context.md) — understand the users and business workflows.
3. [Key concepts](01-introduction/key-concepts.md) and [terminology](01-introduction/terminology.md) — learn the domain language.
4. [Prerequisites](02-getting-started/prerequisites.md), [installation](02-getting-started/installation.md), and [environment setup](02-getting-started/environment-setup.md) — run the backend.
5. [System overview](03-architecture/system-overview.md), [project structure](03-architecture/project-structure.md), and [request lifecycle](03-architecture/request-lifecycle.md) — understand the architecture.
6. [Core systems](04-core-systems/README.md) — learn shared conventions.
7. [Module index](05-modules/README.md) — navigate feature implementations.
8. [Testing overview](09-testing/testing-overview.md) — validate changes.
9. [Development guides](10-development-guides/README.md) — add and modify features.

## Documentation by audience

| Audience | Recommended reading |
|---|---|
| New developers | Introduction → Getting started → Architecture |
| Backend developers | Architecture → Core systems → Modules → Development guides |
| Frontend/API consumers | [API reference](07-api-reference/README.md), [API conventions](07-api-reference/conventions.md), [authentication](07-api-reference/authentication.md) |
| Database developers | [Database overview](06-database/database-overview.md), [models](06-database/data-models.md), [relationships](06-database/relationships.md), [transactions](06-database/transactions.md) |
| Security reviewers | [Security overview](08-security/security-checklist.md), [RBAC](08-security/role-based-access-control.md), [organization isolation](08-security/organization-isolation.md) |
| QA engineers | [Testing overview](09-testing/testing-overview.md), [writing tests](09-testing/writing-new-tests.md) |
| Operations engineers | [Deployment overview](11-deployment-and-operations/deployment-overview.md), [production configuration](11-deployment-and-operations/production-configuration.md) |

## Contents

- [01 — Introduction](01-introduction/project-overview.md)
- [02 — Getting started](02-getting-started/prerequisites.md)
- [03 — Architecture](03-architecture/system-overview.md)
- [04 — Core systems](04-core-systems/README.md)
- [05 — Business modules](05-modules/README.md)
- [06 — Database](06-database/database-overview.md)
- [07 — API reference](07-api-reference/README.md)
- [08 — Security](08-security/security-checklist.md)
- [09 — Testing](09-testing/testing-overview.md)
- [10 — Development guides](10-development-guides/README.md)
- [11 — Deployment and operations](11-deployment-and-operations/deployment-overview.md)
- [12 — Reference](12-reference/environment-variables.md)
- [Architecture Decision Records](adr/README.md)

## Documentation conventions

- **Implemented** means behavior is present in the checked-in source.
- **Partially implemented** means only a subset of the described workflow is present.
- **Planned / not implemented** means the source does not currently provide the capability.
- Source paths are repository-relative and use forward slashes.
- API paths include the global `/api/{API_VERSION}` prefix. The default version is `v1`.
- Examples use placeholders. Never copy secrets or production identifiers into documentation.

Documentation should be updated in the same change that alters a public API, data model, security rule, operational procedure, or developer convention.
