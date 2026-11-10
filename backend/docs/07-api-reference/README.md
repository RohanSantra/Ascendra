# API reference

## Base URL and version prefix

All feature routers are mounted under `/api/{API_VERSION}`. The default version is `v1`, so local development normally uses:

```text
http://localhost:5000/api/v1
```

The port and version prefix are configurable. See [API conventions](conventions.md).

## Authentication model

- Bearer access token: `Authorization: Bearer <access-token>`.
- Organization context: `X-Organization-Id: <organization-id>` on routes that load organization membership.
- Refresh token: HTTP-only cookie (default name `refreshToken`) for refresh and logout operations.

See [Authentication](authentication.md).

## API documents

- [Conventions](conventions.md)
- [Authentication endpoints](authentication.md)
- [Error codes](error-codes.md)
- [OpenAPI 3.1 specification](openapi.yaml)

## Endpoint inventory

The following endpoint inventory contains 131 unique method/path operations derived from `src/routes/index.js` and the feature route files in the uploaded repository. There are 133 route declarations because two organization-admin report operations are registered twice. Role/access annotations are taken from route comments; inspect the route middleware for the authoritative enforcement chain.

| Method | Path | Access annotation | Description |
|---|---|---|---|
| `POST` | `/api/v1/announcements` | Organisation Admin | Creates an organisation announcement draft. |
| `GET` | `/api/v1/announcements` | Organisation Admin, Trainer, Trainee | Retrieves announcements available to the current member. |
| `GET` | `/api/v1/announcements/:announcementId` | Organisation Admin, Trainer, Trainee | Retrieves an announcement. |
| `PATCH` | `/api/v1/announcements/:announcementId` | Organisation Admin | Updates a draft announcement. |
| `PATCH` | `/api/v1/announcements/:announcementId/publish` | Organisation Admin | Publishes a draft announcement. |
| `PATCH` | `/api/v1/announcements/:announcementId/archive` | Organisation Admin | Archives an announcement. |
| `POST` | `/api/v1/courses/:courseId/assessments` | Trainer, Organisation Admin | Creates a new draft assessment for a course. |
| `GET` | `/api/v1/courses/:courseId/assessments` | Trainer, Trainee, Organisation Admin | Retrieves assessments belonging to a course. |
| `GET` | `/api/v1/assessments/:assessmentId` | Trainer, Trainee, Organisation Admin | Retrieves an assessment by its identifier. |
| `PATCH` | `/api/v1/assessments/:assessmentId` | Trainer, Organisation Admin | Updates an existing draft assessment. |
| `PATCH` | `/api/v1/assessments/:assessmentId/publish` | Trainer, Organisation Admin | Publishes a draft assessment. |
| `POST` | `/api/v1/assessments/:assessmentId/versions` | Trainer, Organisation Admin | Creates a new draft version of a published assessment. |
| `PATCH` | `/api/v1/assessments/:assessmentId/archive` | Trainer, Organisation Admin | Archives a published assessment. |
| `POST` | `/api/v1/assessments/:assessmentId/attempts` | Trainee | Starts or resumes a trainee's assessment attempt. |
| `GET` | `/api/v1/assessment-attempts` | Trainee, Trainer, Organisation Admin | Retrieves assessment attempt history. |
| `GET` | `/api/v1/assessment-attempts/:attemptId` | Trainee, Trainer, Organisation Admin | Retrieves an assessment attempt. |
| `PATCH` | `/api/v1/assessment-attempts/:attemptId/answers` | Trainee | Saves or updates answers in an active assessment attempt. |
| `POST` | `/api/v1/assessment-attempts/:attemptId/submit` | Trainee | Submits and evaluates an assessment attempt. |
| `POST` | `/api/v1/auth/register` | Public | Registers a new global user account. |
| `POST` | `/api/v1/auth/login` | Public | Authenticates a user. |
| `POST` | `/api/v1/auth/forgot-password` | Public | Sends a password-reset link when an active account exists. |
| `POST` | `/api/v1/auth/reset-password` | Public | Resets a password using a single-use email token. |
| `POST` | `/api/v1/auth/refresh` | Public (refresh cookie required) | Rotates the refresh token. |
| `POST` | `/api/v1/auth/logout` | Public (refresh cookie used for revocation) | Revokes the current session. |
| `POST` | `/api/v1/auth/logout-all` | Private | Revokes all sessions for the authenticated user. |
| `GET` | `/api/v1/auth/me` | Private | Retrieves the authenticated user's profile. |
| `PATCH` | `/api/v1/auth/change-password` | Private | Changes the authenticated user's password. |
| `POST` | `/api/v1/competencies` | Admin | Creates a new competency for the organization. |
| `GET` | `/api/v1/competencies` | Admin | Retrieves the organization's competencies with |
| `GET` | `/api/v1/competencies/:id` | Admin | Retrieves a competency by its ID. |
| `PATCH` | `/api/v1/competencies/:id` | Admin | Updates an existing competency. |
| `PATCH` | `/api/v1/competencies/:id/archive` | Admin | Archives a competency without permanently |
| `POST` | `/api/v1/evidence` | Trainer | Submits new competency evidence. |
| `GET` | `/api/v1/evidence` | Trainer | Retrieves the authenticated trainer's evidence |
| `GET` | `/api/v1/evidence/:id` | Trainer | Retrieves an individual evidence record |
| `DELETE` | `/api/v1/evidence/:id` | Trainer | Soft-deletes an evidence record belonging |
| `GET` | `/api/v1/evidence/verification/pending` | Admin | Retrieves pending competency evidence for |
| `GET` | `/api/v1/evidence/verification/:id` | Admin | Retrieves individual pending evidence details. |
| `PATCH` | `/api/v1/evidence/verification/:id/approve` | Admin | Verifies submitted competency evidence. |
| `PATCH` | `/api/v1/evidence/verification/:id/reject` | Admin | Rejects submitted competency evidence with a reason. |
| `POST` | `/api/v1/courses/:courseId/materials/upload/initiate` | Trainer, Organisation Admin | Initializes a direct-to-Cloudinary course material upload. |
| `POST` | `/api/v1/courses/:courseId/materials/upload/confirm` | Trainer, Organisation Admin | Verifies a completed Cloudinary upload and registers the course material. |
| `GET` | `/api/v1/courses/:courseId/materials` | Trainer, Trainee, Organisation Admin | Retrieves course materials with pagination and filtering. |
| `GET` | `/api/v1/courses/:courseId/materials/:materialId/access` | Trainer, Trainee, Organisation Admin | Generates a temporary authenticated URL for accessing a course material. |
| `GET` | `/api/v1/courses/:courseId/materials/:materialId` | Trainer, Trainee, Organisation Admin | Retrieves a specific course material. |
| `PATCH` | `/api/v1/courses/:courseId/materials/:materialId` | Trainer, Organisation Admin | Updates course material metadata. |
| `PATCH` | `/api/v1/courses/:courseId/materials/:materialId/archive` | Trainer, Organisation Admin | Archives a course material without deleting its Cloudinary file. |
| `POST` | `/api/v1/courses` | Trainer | Creates a course from a trainer assignment. |
| `GET` | `/api/v1/courses` | Trainer, Organisation Admin | Retrieves courses for the active organisation. |
| `GET` | `/api/v1/courses/:id` | Trainer, Organisation Admin | Retrieves a course by ID. |
| `PATCH` | `/api/v1/courses/:id` | Trainer, Organisation Admin | Updates a draft course. |
| `PATCH` | `/api/v1/courses/:id/status` | Trainer, Organisation Admin | Changes the lifecycle status of a course. |
| `GET` | `/api/v1/organization-admin/reports/activity` | Organisation Admin | Retrieves monthly aggregate activity trends. |
| `GET` | `/api/v1/organization-admin/reports/assessment-performance` | Organisation Admin | Retrieves assessment pass rates and average scores. |
| `GET` | `/api/v1/organization-admin/reports/announcements` | Organisation Admin | Retrieves announcement lifecycle, audience and publication trends. |
| `GET` | `/api/v1/organization-admin/reports/feedback` | Organisation Admin | Retrieves feedback trends and summaries. |
| `GET` | `/api/v1/organization-admin/reports/course-performance` | Organisation Admin | Retrieves course enrolment and completion statistics. |
| `GET` | `/api/v1/organization-admin/reports/matching` | Organisation Admin | Retrieves aggregate matching outcomes and assignment statistics. |
| `GET` | `/api/v1/organization-admin/reports/evidence` | Organisation Admin | Retrieves competency evidence verification statistics. |
| `GET` | `/api/v1/organization-admin/reports/requirements` | Organisation Admin | Retrieves requirement lifecycle distribution and creation trends. |
| `GET` | `/api/v1/organization-admin/reports/trainer-performance` | Organisation Admin | Retrieves aggregate trainer workload and course statistics. |
| `GET` | `/api/v1/organization-admin/reports/learning-progress` | Organisation Admin | Retrieves aggregate course progress and learning activity. |
| `GET` | `/api/v1/organization-admin/reports/memberships` | Organisation Admin | Retrieves membership distribution and registration trends. |
| `GET` | `/api/v1/platform-admin/dashboard` | Platform Admin | Retrieves aggregate platform-wide dashboard statistics. |
| `POST` | `/api/v1/courses/:courseId/enrollments` | Trainee, Organisation Admin | Creates an enrollment for a trainee in a course. |
| `GET` | `/api/v1/enrollments` | Trainee, Trainer, Organisation Admin | Retrieves enrollments belonging to the active organisation. |
| `GET` | `/api/v1/enrollments/:enrollmentId` | Trainee, Trainer, Organisation Admin | Retrieves an enrollment by its ID. |
| `PATCH` | `/api/v1/enrollments/:enrollmentId/status` | Trainee, Trainer, Organisation Admin | Updates the status of an enrollment. |
| `POST` | `/api/v1/courses/:courseId/feedback` | Trainee | Submits feedback for a completed course. |
| `GET` | `/api/v1/feedback` | Organisation Admin, Trainer, Trainee | Retrieves feedback records within the user's organisation. |
| `GET` | `/api/v1/feedback/:feedbackId` | Organisation Admin, Trainer, Trainee | Retrieves a feedback record. |
| `PATCH` | `/api/v1/feedback/:feedbackId/status` | Organisation Admin | Hides or restores a feedback record. |
| `GET` | `/api/v1/health/live` | Public | Reports whether the process can respond to HTTP requests. |
| `GET` | `/api/v1/health/ready` | Public | Reports whether the service is ready, including MongoDB connectivity and shutdown state. |
| `GET` | `/api/v1/courses/:courseId/materials/:materialId/progress` | Trainee | Retrieves or initializes a trainee's material progress. |
| `PATCH` | `/api/v1/courses/:courseId/materials/:materialId/progress` | Trainee | Updates a trainee's material progress status. |
| `GET` | `/api/v1/courses/:courseId/learning-progress/summary` | Trainee | Retrieves a trainee's course-level learning progress summary. |
| `GET` | `/api/v1/courses/:courseId/learning-progress` | Trainer, Admin, Trainee | Retrieves learning progress records for a course. |
| `POST` | `/api/v1/matching/requirements/:requirementId/execute` | Organization Admin | Executes trainer matching for a training requirement. |
| `GET` | `/api/v1/matching/history` | Organization Admin | Retrieves paginated matching run history. |
| `GET` | `/api/v1/matching/history/:id` | Organization Admin | Retrieves details of a specific matching run. |
| `GET` | `/api/v1/matching-config/active` | Organization Admin | Retrieves the active matching configuration. |
| `GET` | `/api/v1/matching-config/versions` | Organization Admin | Lists matching configuration versions. |
| `POST` | `/api/v1/matching-config` | Organization Admin | Creates the initial matching configuration. |
| `POST` | `/api/v1/matching-config/versions` | Organization Admin | Creates a new matching configuration version. |
| `PATCH` | `/api/v1/matching-config/versions/:id/activate` | Organization Admin | Activates an existing matching configuration version. |
| `GET` | `/api/v1/notifications` | Organisation Admin, Trainer, Trainee | Retrieves notifications belonging to the current user. |
| `GET` | `/api/v1/notifications/unread-count` | Organisation Admin, Trainer, Trainee | Retrieves the unread notification count. |
| `GET` | `/api/v1/notifications/:notificationId` | Organisation Admin, Trainer, Trainee | Retrieves one notification. |
| `PATCH` | `/api/v1/notifications/read-all` | Organisation Admin, Trainer, Trainee | Marks all current-user notifications as read. |
| `PATCH` | `/api/v1/notifications/:notificationId/read` | Organisation Admin, Trainer, Trainee | Marks one notification as read. |
| `GET` | `/api/v1/organization-invitations` | Organisation Admin | Retrieves organisation invitations with optional status filtering and pagination. |
| `POST` | `/api/v1/organization-invitations` | Organisation Admin | Creates an invitation for a trainer or trainee. |
| `POST` | `/api/v1/organization-invitations/accept` | Authenticated User | Accepts an organisation invitation for the authenticated user. |
| `PATCH` | `/api/v1/organization-invitations/:id/revoke` | Organisation Admin | Revokes a pending organisation invitation. |
| `GET` | `/api/v1/memberships/me` | Authenticated user | Lists memberships of the authenticated user. |
| `POST` | `/api/v1/memberships/request` | Authenticated user | Requests membership in an existing organization. |
| `GET` | `/api/v1/memberships/pending` | Admin | Lists pending organisation membership requests. |
| `PATCH` | `/api/v1/memberships/:id/approve` | Admin | Approves a pending membership. |
| `PATCH` | `/api/v1/memberships/:id/reject` | Admin | Rejects a pending membership. |
| `PATCH` | `/api/v1/memberships/:id/suspend` | Admin | Suspends an approved membership. |
| `GET` | `/api/v1/organizations` | Public | Lists active organizations available for discovery. |
| `POST` | `/api/v1/organizations/applications` | Authenticated user | Submits an organization application; the applicant receives a pending admin membership. |
| `GET` | `/api/v1/organizations/applications/pending` | Platform Administrator | Lists pending organization applications for platform review. |
| `PATCH` | `/api/v1/organizations/applications/:id/approve` | Platform Administrator | Approves an organization application. |
| `PATCH` | `/api/v1/organizations/applications/:id/reject` | Platform Administrator | Rejects an organization application. |
| `PATCH` | `/api/v1/organizations/:id/suspend` | Platform Administrator | Suspends an active organization. |
| `PATCH` | `/api/v1/organizations/:id/reactivate` | Platform Administrator | Reactivates a suspended organization. |
| `POST` | `/api/v1/skills` | Admin | Creates a new skill for the organization. |
| `GET` | `/api/v1/skills` | Admin | Retrieves organization skills with pagination, |
| `GET` | `/api/v1/skills/:id` | Admin | Retrieves a skill by its ID. |
| `PATCH` | `/api/v1/skills/:id` | Admin | Updates skill information and competency associations. |
| `PATCH` | `/api/v1/skills/:id/archive` | Admin | Archives a skill without permanently deleting it. |
| `GET` | `/api/v1/trainer-assignments` | Organization Admin | Retrieves paginated trainer assignments. |
| `POST` | `/api/v1/trainer-assignments/requirements/:requirementId` | Organization Admin | Assigns a trainer to a training requirement. |
| `PATCH` | `/api/v1/trainer-assignments/:id/start` | Organization Admin | Starts an assigned training engagement. |
| `PATCH` | `/api/v1/trainer-assignments/:id/complete` | Organization Admin | Completes an in-progress training engagement. |
| `PATCH` | `/api/v1/trainer-assignments/:id/cancel` | Organization Admin | Cancels an assigned or in-progress engagement. |
| `GET` | `/api/v1/trainer-assignments/:id` | Organization Admin | Retrieves an individual trainer assignment. |
| `GET` | `/api/v1/trainer-approvals/pending` | Admin | Lists trainers awaiting eligibility approval. |
| `PATCH` | `/api/v1/trainer-approvals/:id/approve` | Admin | Approves trainer eligibility. |
| `PATCH` | `/api/v1/trainer-approvals/:id/reject` | Admin | Rejects trainer eligibility. |
| `PATCH` | `/api/v1/trainer-approvals/:id/suspend` | Admin | Suspends trainer eligibility. |
| `GET` | `/api/v1/trainer-profiles/me` | Trainer | Retrieves the authenticated trainer's profile. |
| `PATCH` | `/api/v1/trainer-profiles/me/professional-details` | Trainer | Updates trainer professional information. |
| `PATCH` | `/api/v1/trainer-profiles/me/availability` | Trainer | Updates trainer availability preferences. |
| `POST` | `/api/v1/training-requirements` | Organization Admin | Creates a new training requirement for the selected organization. |
| `GET` | `/api/v1/training-requirements` | Organization Admin | Retrieves paginated training requirements belonging to the selected organization. |
| `GET` | `/api/v1/training-requirements/:id` | Organization Admin | Retrieves a specific training requirement belonging to the selected organization. |
| `PATCH` | `/api/v1/training-requirements/:id` | Organization Admin | Updates an existing editable training requirement. |
| `PATCH` | `/api/v1/training-requirements/:id/archive` | Organization Admin | Archives a training requirement. |
## Contract accuracy and known specification gaps

The OpenAPI file records the registered method/path pairs and route-level access rules. Bearer authentication and the `X-Organization-Id` header are derived from the actual route middleware; refresh and logout use the refresh-token cookie. The OpenAPI server URL is the host root because every path already contains the `/api/v1` prefix.

**Request and response schemas are not yet fully represented in OpenAPI.** The route modules do attach Zod validators to many request bodies and query strings, but this specification currently does not translate those validators into OpenAPI request-body or query-parameter schemas. Successful responses are represented by a generic `2XX` response, and error responses by `default`; endpoint-specific status codes and payload schemas have not been exhaustively mapped from controllers and response helpers. Treat these as explicit documentation gaps, not as evidence that the endpoints accept arbitrary input or return arbitrary data.

For exact body fields and constraints, consult the route's `validateRequest(...)` declaration and the corresponding module `*.validation.js` file. For actual success status, response data, and side effects, consult its controller and service plus `src/core/responses/ApiResponse.js`. Common error behavior is implemented by `src/middleware/error.middleware.js` and `src/middleware/validate.middleware.js`.

## Duplicate registration

`GET /api/v1/organization-admin/reports/activity` and `GET /api/v1/organization-admin/reports/assessment-performance` are registered in two organization-admin route files. The first mounted router currently registers those paths before the second router. This needs a source-level cleanup; see [known limitations](../12-reference/known-limitations.md).
