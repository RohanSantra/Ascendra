# Dashboards and reporting

## Purpose

Provides platform-admin dashboard data and organization-admin aggregate reports across memberships, learning, courses, matching, evidence, requirements, feedback and announcements.

## Implementation status

**Implemented in the checked-in source.** The scope described below is limited to the files and routes listed here; future extensions should be documented separately until implemented.

## Responsibilities and boundaries

Platform-admin dashboard and organization-admin operational and performance reports.

This module should own its domain rules. Cross-module workflows should use the existing service/repository conventions and validate that referenced records belong to the same organization where applicable.

## Source files

| Type | Files |
|---|---|
| Route | `src/modules/dashboards/organizationAdmin/routes/organizationDashboard.reporting.routes.js`, `src/modules/dashboards/organizationAdmin/routes/organizationDashboard.routes.js`, `src/modules/dashboards/platformAdmin/platformDashboard.routes.js` |
| Controller | `src/modules/dashboards/organizationAdmin/controllers/organizationDashboard.announcement.controller.js`, `src/modules/dashboards/organizationAdmin/controllers/organizationDashboard.controller.js`, `src/modules/dashboards/organizationAdmin/controllers/organizationDashboard.coursePerformance.controller.js`, `src/modules/dashboards/organizationAdmin/controllers/organizationDashboard.evidence.controller.js`, `src/modules/dashboards/organizationAdmin/controllers/organizationDashboard.feedback.controller.js`, `src/modules/dashboards/organizationAdmin/controllers/organizationDashboard.learning.controller.js`, `src/modules/dashboards/organizationAdmin/controllers/organizationDashboard.matching.controller.js`, `src/modules/dashboards/organizationAdmin/controllers/organizationDashboard.membership.controller.js`, `src/modules/dashboards/organizationAdmin/controllers/organizationDashboard.performance.controller.js`, `src/modules/dashboards/organizationAdmin/controllers/organizationDashboard.reporting.controller.js`, `src/modules/dashboards/organizationAdmin/controllers/organizationDashboard.requirement.controller.js`, `src/modules/dashboards/organizationAdmin/controllers/organizationDashboard.trainerPerformance.controller.js`, `src/modules/dashboards/platformAdmin/platformDashboard.controller.js` |
| Service / repository / engine | `src/modules/dashboards/organizationAdmin/repositories/organizationDashboard.announcement.repository.js`, `src/modules/dashboards/organizationAdmin/repositories/organizationDashboard.coursePerformance.repository.js`, `src/modules/dashboards/organizationAdmin/repositories/organizationDashboard.evidence.repository.js`, `src/modules/dashboards/organizationAdmin/repositories/organizationDashboard.feedback.repository.js`, `src/modules/dashboards/organizationAdmin/repositories/organizationDashboard.learning.repository.js`, `src/modules/dashboards/organizationAdmin/repositories/organizationDashboard.matching.repository.js`, `src/modules/dashboards/organizationAdmin/repositories/organizationDashboard.membership.repository.js`, `src/modules/dashboards/organizationAdmin/repositories/organizationDashboard.performance.repository.js`, `src/modules/dashboards/organizationAdmin/repositories/organizationDashboard.reporting.repository.js`, `src/modules/dashboards/organizationAdmin/repositories/organizationDashboard.repository.js`, `src/modules/dashboards/organizationAdmin/repositories/organizationDashboard.requirement.repository.js`, `src/modules/dashboards/organizationAdmin/repositories/organizationDashboard.trainerPerformance.repository.js`, `src/modules/dashboards/organizationAdmin/services/organizationDashboard.announcement.service.js`, `src/modules/dashboards/organizationAdmin/services/organizationDashboard.coursePerformance.service.js`, `src/modules/dashboards/organizationAdmin/services/organizationDashboard.evidence.service.js`, `src/modules/dashboards/organizationAdmin/services/organizationDashboard.feedback.service.js`, `src/modules/dashboards/organizationAdmin/services/organizationDashboard.learning.service.js`, `src/modules/dashboards/organizationAdmin/services/organizationDashboard.matching.service.js`, `src/modules/dashboards/organizationAdmin/services/organizationDashboard.membership.service.js`, `src/modules/dashboards/organizationAdmin/services/organizationDashboard.performance.service.js`, `src/modules/dashboards/organizationAdmin/services/organizationDashboard.reporting.service.js`, `src/modules/dashboards/organizationAdmin/services/organizationDashboard.requirement.service.js`, `src/modules/dashboards/organizationAdmin/services/organizationDashboard.service.js`, `src/modules/dashboards/organizationAdmin/services/organizationDashboard.trainerPerformance.service.js`, `src/modules/dashboards/platformAdmin/platformDashboard.repository.js`, `src/modules/dashboards/platformAdmin/platformDashboard.service.js` |
| Validation | `src/modules/dashboards/organizationAdmin/validations/organizationDashboard.announcement.validation.js`, `src/modules/dashboards/organizationAdmin/validations/organizationDashboard.feedback.validation.js`, `src/modules/dashboards/organizationAdmin/validations/organizationDashboard.reporting.validation.js`, `src/modules/dashboards/platformAdmin/platformDashboard.validation.js` |

## Data model

No Mongoose model file is owned by this module mapping. It may use models from another module or operate as a read-only aggregation layer.
## API routes

| Method | Endpoint | Access note | Description |
|---|---|---|---|
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

These paths include the default `/api/v1` prefix. The prefix is configurable through `API_VERSION`. Access notes are taken from route annotations; confirm the actual middleware chain in the listed route file.

## Main workflow

Dashboard routes aggregate existing organization/platform data. Organization-admin reports are scoped by membership and organization context; each report has its own controller, service, repository and query validation where implemented.

## Authorization and organization isolation

Organization-scoped operations use `X-Organization-Id`, `loadOrganizationMembership`, and role authorization as configured on each route. Services must also scope resource queries and referenced documents by `req.user.orgId`; middleware alone does not secure an unscoped database query.

## Validation and errors

Request schemas are defined in: `src/modules/dashboards/organizationAdmin/validations/organizationDashboard.announcement.validation.js`, `src/modules/dashboards/organizationAdmin/validations/organizationDashboard.feedback.validation.js`, `src/modules/dashboards/organizationAdmin/validations/organizationDashboard.reporting.validation.js`, `src/modules/dashboards/platformAdmin/platformDashboard.validation.js`. The route specifies which request sections are parsed. Validation errors are returned through the shared 422 error format.
Use `AppError` and shared error codes for expected domain failures. Unexpected failures should flow to centralized error handling.

## Tests

Relevant test files found in the archive:
- `test/integration/dashboards/dashboardServices.integration.test.js`
- `test/unit/dashboards/dashboardModelBehavior.test.js`
- `test/unit/dashboards/dashboardRoutesAndValidation.test.js`

## Safe extension guidance

1. Read the route, validation schema, controller, service, repository and model before editing.
2. Preserve the distinction between global identity and organization-scoped records.
3. Validate all referenced IDs and confirm they belong to the same organization.
4. Preserve existing lifecycle transitions and historical records.
5. Add positive, negative, authorization and cross-organization tests.
6. Update the API reference and this document when externally observable behavior changes.

## Known limitations and future extensions

Only the implementation present in the listed files is guaranteed. Do not infer background jobs, push delivery, external event processing, advanced analytics, or additional workflow states unless source code explicitly implements them.
