# Terminology

| Term | Meaning in Ascendra |
|---|---|
| Platform Administrator | Global administrator represented by the user's `platformRole` |
| Organization Administrator | User whose approved organization membership has role `admin` |
| Trainer | Organization member with role `trainer` |
| Trainee | Organization member with role `trainee` |
| Tenant / organization | Independent organization boundary represented by `Organization` |
| Membership | A user's role and status within one organization |
| Membership approval | Approval that allows a user to access an organization |
| Trainer approval | Separate eligibility review stored in the trainer profile |
| Competency | Broad capability definition |
| Skill | Specific capability that can be associated with one or more competencies |
| Evidence | Supporting submission used in competency verification |
| Verification | Review outcome for submitted competency evidence |
| Proficiency level | Numeric level used by competency and matching workflows; inspect the model/engine for the applicable scale |
| Training requirement | Organization-owned statement of a training need and trainer criteria |
| Matching configuration | Versioned factor settings used by the matching engine |
| Matching factor | A criterion considered by trainer matching |
| Match run | Persisted execution/history of matching a requirement against candidates |
| Candidate | Trainer evaluated by a matching run |
| Assignment | A trainer's formal allocation to a training requirement |
| Course | Learning offering associated with training delivery |
| Course material | A content resource associated with a course |
| Upload intent | Short-lived record used to coordinate a course-material upload |
| Enrollment | Trainee participation record for a course |
| Assessment | Versioned evaluation definition associated with a course |
| Attempt | A trainee's execution of an assessment |
| Learning progress | Material-level learning activity/status associated with an enrollment |
| Announcement | Organization communication with audience and publication state |
| Feedback | Course-related feedback submitted by a trainee |
| Notification | Recipient-specific in-app message record |
| RBAC | Role-based access control |
| Request ID | Correlation identifier assigned to an HTTP request |
| API version | Version segment configured through `API_VERSION`, defaulting to `v1` |

## Naming notes

- `org` is the common MongoDB reference field used by organization-owned models.
- `X-Organization-Id` selects the organization context for routes that load membership.
- `platformRole` is global; `role` on the request after membership loading is organization-scoped.
- “Approved membership” and “approved trainer” refer to different records and checks.
