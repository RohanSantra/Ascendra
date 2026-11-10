# Contributing to Ascendra Backend

Thank you for helping improve Ascendra. This guide describes the repository's current development conventions and recommended contribution practices.

## Before changing code

1. Read the [project overview](docs/01-introduction/project-overview.md).
2. Read the relevant [module documentation](docs/05-modules/README.md).
3. Trace the route, validation, controller, service, repository and model involved.
4. Check related unit and integration tests.
5. Identify tenant, role, transaction and external-side-effect implications.

## Development setup

Follow [Prerequisites](docs/02-getting-started/prerequisites.md), [Installation](docs/02-getting-started/installation.md), and [Environment setup](docs/02-getting-started/environment-setup.md).

## Branches and commits

Recommended conventions (not enforced by the repository):
- Use a short descriptive branch name, such as `feature/course-export` or `fix/membership-scope`.
- Use clear commit messages. Conventional Commit prefixes such as `feat:`, `fix:`, `test:`, `docs:`, and `chore:` are recommended.
- Keep commits focused and avoid mixing unrelated refactors with feature changes.

## Code conventions

- Use ES modules and `.js` extensions for relative imports.
- Follow existing feature-module boundaries.
- Use Zod validation through `validateRequest`.
- Use `AppError` for expected application failures.
- Use `ApiResponse` for successful responses.
- Reuse authentication, organization membership and role middleware.
- Scope organization-owned database operations by `org`.
- Validate cross-module references against the selected organization.
- Use transactions for coordinated writes that must remain atomic.

See [Code conventions](docs/10-development-guides/code-conventions.md).

## Testing expectations

Add or update tests for behavior changes. Include validation, authorization, tenant-isolation, lifecycle and failure cases where applicable.

Before submitting:

```bash
npm run lint
npm test
npm run check
```

Run coverage when the change affects business logic or branches:

```bash
npm run test:coverage
```

## Documentation expectations

Update documentation in the same change when modifying:
- API routes or request/response contracts.
- Model fields, indexes, references or lifecycle states.
- Authentication, authorization or tenant isolation.
- Environment variables or scripts.
- Deployment or operational behavior.
- Developer conventions.

## Pull request checklist

- [ ] Change has a clear scope and rationale.
- [ ] Related tests were added/updated.
- [ ] `npm run check` passes.
- [ ] Organization isolation and authorization were reviewed.
- [ ] API/database documentation was updated where needed.
- [ ] No secrets or local environment files are included.
- [ ] Breaking changes and operational steps are called out.

## Security reports

Do not publish exploitable vulnerabilities with credentials or sensitive data in a public issue. Contact the project maintainers through an approved private channel; no dedicated security contact address is established in this repository.
