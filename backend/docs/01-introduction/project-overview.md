# Project overview

## What is Ascendra?

Ascendra is a multi-organization training and learning platform. The backend is the API and domain layer that coordinates people, organizations, trainer eligibility, competencies, training needs, trainer selection, course delivery, assessment, and learning activity.

The system supports two related scopes of identity and access:

- **Platform scope:** a user has a global account and may have a platform-level role.
- **Organization scope:** the same user can hold a role and membership status inside a particular organization.

This distinction is important: a user account is not itself an organization membership, and organization membership approval is not the same as trainer eligibility approval.

## Main capabilities present in the source

| Capability | What the backend supports |
|---|---|
| Identity and authentication | Registration, login, access-token authentication, refresh, logout, password change and password reset |
| Organization lifecycle | Public discovery, applications, platform-admin approval/rejection, suspension and reactivation |
| Membership | Membership requests, approval, rejection, suspension and listing |
| Invitations | Admin invitations for trainer/trainee roles, acceptance, revocation and expiry |
| Trainer readiness | Professional details, availability, trainer approval, competencies, skills and evidence |
| Trainer matching | Requirement evaluation using configurable factors, matching execution and history |
| Assignments | Trainer assignment creation and start/complete/cancel lifecycle |
| Learning delivery | Courses, course materials, enrolments, assessments, attempts and progress |
| Engagement | Feedback, announcements and in-app notifications |
| Reporting | Platform dashboard and organization-admin reports |
| Operations | Liveness/readiness endpoints, request IDs, timeouts, rate limiting, logging and graceful shutdown |

The existence of a module does not imply that every possible feature in that domain is implemented. Consult the relevant module document for boundaries and limitations.

## Technology summary

- Node.js ES modules, minimum engine declared as `>=20.19.0`.
- Express 5 for HTTP routing and middleware.
- MongoDB with Mongoose models and queries.
- Zod for request validation.
- JWT and persisted session records for authentication.
- bcryptjs for password hashing.
- Nodemailer for email delivery.
- Cloudinary integration for course-material storage workflows.
- Native Node.js test runner, `mongodb-memory-server`, and ESLint.

## Architectural shape

Ascendra is implemented as a **modular monolith**. Feature code is grouped by business domain under `src/modules/`; shared concerns live in `src/core/`, `src/config/`, and `src/middleware/`. This keeps deployment simple while maintaining module boundaries that can be understood and changed independently.

## Repository entry points

| File | Responsibility |
|---|---|
| `src/server.js` | Connects to MongoDB, starts the HTTP server, handles process signals and graceful shutdown |
| `src/app.js` | Creates/configures Express middleware and mounts versioned routes |
| `src/routes/index.js` | Composes feature routers |
| `src/config/env.js` | Loads and validates environment configuration |
| `src/config/db.js` | Connects to and disconnects from MongoDB |
| `scripts/bootstrap.js` | Creates the initial platform admin, organization and approved admin membership |

## Further reading

- [Product context](product-context.md)
- [Key concepts](key-concepts.md)
- [Terminology](terminology.md)
- [System architecture](../03-architecture/system-overview.md)
