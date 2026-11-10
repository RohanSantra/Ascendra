# Adding a new module

This guide describes the current feature-module pattern. Not every module uses every file type; create only the layers the feature needs.

## 1. Define the domain boundary

Before coding, write down:
- The business responsibility of the module.
- Which data it owns.
- Which other modules it depends on.
- Whether records are organization-scoped.
- Which roles may perform each operation.
- Which workflows need transactions or external side effects.

Avoid creating a new module when the behavior clearly belongs to an existing domain.

## 2. Create a feature directory

A typical module may look like:

```text
src/modules/example/
├── example.model.js
├── example.validation.js
├── example.repository.js
├── example.service.js
├── example.controller.js
└── example.routes.js
```

This is a pattern, not a mandatory checklist. Repository files are appropriate when they clarify database operations; simple modules may call Mongoose through their service.

## 3. Implement the data model

Define Mongoose fields, required values, defaults, enums, timestamps, indexes and references. Include `org` when the record is organization-owned. Consider compound indexes that begin with the tenant key for tenant-scoped query patterns.

See [Adding a model](adding-a-new-model.md).

## 4. Implement validation

Create Zod schemas for body, params and query inputs. Attach `validateRequest` to routes and consume `req.validated` in controllers.

## 5. Implement service behavior

Keep business rules in the service. Validate referenced resources and tenant ownership. Use `AppError` for expected failures. Use transactions for coordinated writes that must succeed or fail together.

## 6. Add controller and routes

Controllers translate HTTP input/output. Routes define middleware order, validation and controller handlers. Register the router in `src/routes/index.js` under a clear prefix.

## 7. Add tests

Add unit tests for schema/service/controller/repository behavior and integration tests for important end-to-end workflows. Include cross-organization denial cases for tenant-owned resources.

## 8. Update documentation

Add the module to `docs/05-modules/README.md`, create a module document using the existing module template, update OpenAPI and API index, and update database/security documentation if relevant.

## 9. Verify

```bash
npm run lint
npm test
npm run check
npm run test:coverage
```

Do not mark a module complete until tests and documentation reflect the actual behavior.
