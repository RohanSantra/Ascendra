# Indexes and constraints

Indexes are declared in the corresponding Mongoose model files. This is an inventory of explicit `schema.index()` declarations found in the repository. MongoDB's actual deployed index state should be checked against the running database; schema declarations alone do not prove that every production index has been built.

## Explicit index declarations

| Model | Index keys | Options / intent |
|---|---|---|
| `announcement.model.js` | `org: 1, status: 1, createdAt: -1` | `Non-unique query-supporting index` |
| `announcement.model.js` | `org: 1, status: 1, audience: 1, publishedAt: -1` | `Non-unique query-supporting index` |
| `announcement.model.js` | `org: 1, status: 1, expiresAt: 1` | `Non-unique query-supporting index` |
| `assessment.model.js` | `org: 1, course: 1, assessmentKey: 1, version: 1` | `unique: true, name: "assessment_org_course_series_version_unique"` |
| `assessment.model.js` | `org: 1, course: 1, assessmentKey: 1` | `unique: true, partialFilterExpression: { status: "published" }, name: "assessment_one_published_version_per_series_unique"` |
| `assessment.model.js` | `org: 1, course: 1, status: 1` | `name: "assessment_org_course_status"` |
| `assessmentAttempt.model.js` | `org: 1, assessment: 1, trainee: 1, attemptNumber: 1` | `unique: true, name: "assessment_attempt_org_assessment_trainee_number_unique"` |
| `assessmentAttempt.model.js` | `org: 1, assessment: 1, trainee: 1, status: 1` | `name: "assessment_attempt_org_assessment_trainee_status"` |
| `assessmentAttempt.model.js` | `org: 1, status: 1, expiresAt: 1` | `name: "assessment_attempt_org_status_expiry"` |
| `assessmentAttempt.model.js` | `org: 1, course: 1, trainee: 1, createdAt: -1` | `name: "assessment_attempt_org_course_trainee"` |
| `passwordResetToken.model.js` | `expiresAt: 1` | `expireAfterSeconds: 0, name: "password_reset_token_expiry"` |
| `user.model.js` | `email: 1` | `unique: true, name: "user_email_unique"` |
| `competency.model.js` | `org: 1, slug: 1` | `unique: true, name: "competency_org_slug_unique"` |
| `competency.model.js` | `org: 1, status: 1, category: 1, name: 1` | `name: "competency_org_status_category"` |
| `competencyEvidence.model.js` | `org: 1, trainerProfile: 1, _id: 1` | `name: "evidence_org_profile_recomputation"` |
| `competencyEvidence.model.js` | `org: 1, "verification.status": 1, createdAt: -1` | `name: "evidence_org_verification_created"` |
| `competencyEvidence.model.js` | `org: 1, competencies: 1` | `name: "evidence_org_competencies"` |
| `competencyEvidence.model.js` | `org: 1, skills: 1` | `name: "evidence_org_skills"` |
| `competencyEvidence.model.js` | `org: 1, trainerProfile: 1, isDeleted: 1, supersededBy: 1` | `name: "evidence_org_profile_active"` |
| `courseMaterial.model.js` | `org: 1, course: 1, status: 1, displayOrder: 1` | `name: "course_material_org_course_order"` |
| `courseMaterial.model.js` | `"file.storageProvider": 1, "file.assetId": 1` | `unique: true, partialFilterExpression: { "file.storageProvider": "cloudinary", "file.assetId": { $type: "string" } }, name: "course_material_cloudinary_asset_unique"` |
| `courseMaterialUploadIntent.model.js` | `org: 1, course: 1, uploadedBy: 1, status: 1` | `name: "course_material_upload_intent_lookup"` |
| `courseMaterialUploadIntent.model.js` | `expiresAt: 1` | `expireAfterSeconds: 0, name: "course_material_upload_intent_expiry"` |
| `course.model.js` | `trainerAssignment: 1` | `unique: true, name: "course_trainer_assignment_unique"` |
| `course.model.js` | `org: 1, status: 1, startDate: 1` | `name: "course_org_status_start"` |
| `course.model.js` | `org: 1, trainer: 1, status: 1` | `name: "course_org_trainer_status"` |
| `enrollment.model.js` | `org: 1, course: 1, trainee: 1` | `unique: true, name: "enrollment_org_course_trainee_unique"` |
| `enrollment.model.js` | `org: 1, course: 1, status: 1, enrolledAt: -1` | `name: "enrollment_org_course_status"` |
| `enrollment.model.js` | `org: 1, trainee: 1, status: 1` | `name: "enrollment_org_trainee_status"` |
| `feedback.model.js` | `org: 1, course: 1, trainee: 1` | `unique: true, name: "feedback_org_course_trainee_unique"` |
| `feedback.model.js` | `org: 1, status: 1, createdAt: -1` | `Non-unique query-supporting index` |
| `feedback.model.js` | `org: 1, trainer: 1, status: 1, createdAt: -1` | `Non-unique query-supporting index` |
| `feedback.model.js` | `org: 1, trainee: 1, createdAt: -1` | `Non-unique query-supporting index` |
| `learningProgress.model.js` | `org: 1, course: 1, trainee: 1, material: 1` | `unique: true, name: "learning_progress_org_course_trainee_material_unique"` |
| `learningProgress.model.js` | `org: 1, course: 1, trainee: 1, status: 1` | `Non-unique query-supporting index` |
| `learningProgress.model.js` | `org: 1, enrollment: 1, status: 1` | `Non-unique query-supporting index` |
| `learningProgress.model.js` | `org: 1, course: 1, material: 1, status: 1` | `Non-unique query-supporting index` |
| `matchRun.model.js` | `org: 1, requirement: 1, createdAt: -1` | `name: "match_run_org_requirement_created"` |
| `matchRun.model.js` | `org: 1, createdAt: -1` | `name: "match_run_org_created"` |
| `matchingConfig.model.js` | `org: 1, version: 1` | `unique: true, name: "matching_config_org_version_unique"` |
| `matchingConfig.model.js` | `org: 1` | `unique: true, partialFilterExpression: { isActive: true }, name: "matching_config_one_active_per_org"` |
| `notification.model.js` | `org: 1, recipient: 1, createdAt: -1` | `Non-unique query-supporting index` |
| `notification.model.js` | `org: 1, recipient: 1, status: 1, createdAt: -1` | `Non-unique query-supporting index` |
| `notification.model.js` | `org: 1, recipient: 1, type: 1, createdAt: -1` | `Non-unique query-supporting index` |
| `notification.model.js` | `org: 1, "resource.type": 1, "resource.id": 1` | `Non-unique query-supporting index` |
| `organizationInvitation.model.js` | `org: 1, email: 1` | `unique: true, partialFilterExpression: { status: "pending" }, name: "one_pending_invitation_per_org_email"` |
| `organizationInvitation.model.js` | `tokenHash: 1` | `unique: true, name: "invitation_token_hash_unique"` |
| `organizationInvitation.model.js` | `org: 1, status: 1, createdAt: -1` | `name: "invitation_org_status_created"` |
| `organizationMembership.model.js` | `org: 1, user: 1` | `unique: true, name: "membership_org_user_unique"` |
| `organizationMembership.model.js` | `org: 1, role: 1, status: 1` | `name: "membership_org_role_status"` |
| `organizationMembership.model.js` | `user: 1, status: 1` | `name: "membership_user_status"` |
| `organization.model.js` | `slug: 1` | `unique: true, name: "organization_slug_unique"` |
| `organization.model.js` | `status: 1, createdAt: 1, _id: 1` | `name: "organization_status_created_at"` |
| `session.model.js` | `expiresAt: 1` | `expireAfterSeconds: 0, name: "session_expiry_ttl"` |
| `session.model.js` | `user: 1, isActive: 1, expiresAt: 1` | `name: "session_user_active_expiry"` |
| `skill.model.js` | `org: 1, slug: 1` | `unique: true, name: "skill_org_slug_unique"` |
| `skill.model.js` | `org: 1, status: 1, category: 1, name: 1` | `name: "skill_org_status_category"` |
| `skill.model.js` | `org: 1, competencies: 1` | `name: "skill_org_competencies"` |
| `trainerAssignment.model.js` | `org: 1, requirement: 1, trainerProfile: 1` | `unique: true, name: "trainer_assignment_org_requirement_profile_unique"` |
| `trainerAssignment.model.js` | `org: 1, status: 1, startDate: 1` | `name: "trainer_assignment_org_status_start"` |
| `trainerAssignment.model.js` | `org: 1, trainerProfile: 1, status: 1` | `name: "trainer_assignment_org_profile_status"` |
| `trainerProfile.model.js` | `org: 1, user: 1` | `unique: true, name: "trainer_profile_org_user_unique"` |
| `trainerProfile.model.js` | `org: 1, "approval.status": 1, "availability.status": 1` | `name: "trainer_profile_matching_eligibility"` |
| `trainerProfile.model.js` | `org: 1, "competencySummary.competency": 1` | `name: "trainer_profile_competency"` |
| `trainerProfile.model.js` | `org: 1, "skills.skill": 1` | `name: "trainer_profile_skill"` |
| `trainingRequirement.model.js` | `org: 1, status: 1, updatedAt: -1` | `name: "requirement_org_status_updated"` |
| `trainingRequirement.model.js` | `org: 1, createdBy: 1, createdAt: -1` | `name: "requirement_org_creator_created"` |

## Important constraint patterns

- Global user email uniqueness is declared on `User`.
- Organization slugs are unique.
- Organization/user membership pairs are unique.
- Organization-scoped competency and skill slugs are unique.
- One pending invitation per organization/email is enforced with a partial unique index; invitation token hashes are unique.
- Matching configuration versions are unique per organization, and a partial unique index permits only one active configuration per organization.
- Enrollment uniqueness is scoped to organization, course and trainee.
- Feedback uniqueness is scoped to organization, course and trainee.
- Assessment version series and attempt numbers have compound uniqueness constraints.
- Session and password-reset expiry fields have TTL indexes.
- Course material upload intent expiry has a TTL index.

## TTL index warning

TTL deletion is asynchronous and should not be used as the authorization check. Session and token services must check expiry and revocation/validity fields explicitly before accepting a credential.

## Index maintenance

1. Update the schema declaration and relevant tests together.
2. Consider query patterns and tenant prefix fields when designing compound indexes.
3. Avoid redundant indexes that increase write cost without supporting a query.
4. Deploy index changes deliberately and observe index build behavior on production data.
5. Handle duplicate-key errors in service logic; a pre-check alone cannot prevent concurrent duplicate writes.

Source of truth: each `*.model.js` file under `src/modules/`.
