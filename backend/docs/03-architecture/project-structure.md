# Project structure

The following describes the checked-in repository layout. It focuses on directories that carry application or maintenance responsibilities.

```text
backend/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   ├── core/
│   │   ├── constants/
│   │   ├── errors/
│   │   ├── responses/
│   │   ├── runtime/
│   │   └── utils/
│   ├── middleware/
│   ├── modules/
│   └── routes/
├── scripts/
│   └── bootstrap.js
├── test/
│   ├── helpers/
│   ├── integration/
│   └── unit/
├── docs/
├── .env.example
├── eslint.config.js
├── package.json
└── package-lock.json
```

## Important top-level files

| Path | Responsibility |
|---|---|
| `package.json` | Runtime engine, dependencies, scripts and package metadata |
| `.env.example` | Example names/defaults for supported environment configuration |
| `eslint.config.js` | ESLint configuration |
| `README.md` | Repository entry point |
| `CONTRIBUTING.md` | Contribution conventions |
| `CHANGELOG.md` | Change history |
| `LICENSE` | License text; currently inconsistent with package metadata |

## Source directories

| Path | Responsibility |
|---|---|
| `src/app.js` | Express application construction and global middleware |
| `src/server.js` | Server startup, signal handling and graceful shutdown |
| `src/config/` | Environment parsing and MongoDB connection |
| `src/core/constants/` | HTTP status and application error constants |
| `src/core/errors/` | `AppError` and error exports |
| `src/core/responses/` | Standard successful API response helpers |
| `src/core/runtime/` | Runtime state such as shutdown state |
| `src/core/utils/` | Shared utility services and helpers |
| `src/middleware/` | Request-level infrastructure and error handling |
| `src/modules/` | Business domains and feature-specific code |
| `src/routes/index.js` | Mounts module routers under the global API version prefix |

## Module directories

The current module directories are:

`announcements`, `assessments`, `auth`, `competencies`, `competencyEvidence`, `courseMaterials`, `courses`, `dashboards`, `enrollments`, `feedback`, `health`, `learningProgress`, `matchRun`, `matching`, `matchingConfig`, `notifications`, `organizationInvitations`, `organizationMemberships`, `organizations`, `sessions`, `skills`, `trainerAssignments`, `trainerProfiles`, and `trainingRequirements`.

Some modules are split into subdomains. For example, `competencyEvidence/` separates `submissions/`, `verification/`, and `domain/`. `dashboards/` separates platform-admin and organization-admin reporting code.

## Test directories

- `test/unit/` contains focused tests for utilities, models, validation, controllers, services, repositories and middleware.
- `test/integration/` exercises complete workflows across modules and application infrastructure.
- `test/helpers/database.js` provides shared test database lifecycle helpers.

## How to navigate a feature

Start at its route file. Follow the controller imports to the service and validation schema. Follow service imports to repositories, models, shared utilities and other modules. Then locate the corresponding tests under `test/unit/` and `test/integration/`.

## Related documents

- [Module index](../05-modules/README.md)
- [Adding a module](../10-development-guides/adding-a-new-module.md)
