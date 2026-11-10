# Development guides

These guides explain how to extend Ascendra using the conventions already present in the repository.

- [Adding a new module](adding-a-new-module.md)
- [Adding a new model](adding-a-new-model.md)
- [Adding an API endpoint](adding-an-api-endpoint.md)
- [Adding validation](adding-validation.md)
- [Adding middleware](adding-middleware.md)
- [Modifying existing features](modifying-existing-features.md)
- [Code conventions](code-conventions.md)

## Recommended approach

Prefer a small, cohesive change inside the owning module. Reuse shared infrastructure for validation, errors, responses, authentication and organization reference checks. Add tests and update documentation in the same change.
