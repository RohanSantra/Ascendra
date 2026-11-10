# Key concepts

This page introduces the domain concepts used throughout Ascendra. The detailed source behavior is linked from each concept.

## Platform identity versus organization membership

A `User` is a global account. A user can have a platform role, but organization roles are stored in `OrganizationMembership`. An organization-scoped request selects an organization using `X-Organization-Id`; the authorization middleware verifies the organization and the user's approved membership before assigning `orgId` and membership role to the request context.

## Organization

An organization is a tenant boundary. Organization-owned records generally carry an `org` reference. Services and repositories must scope organization-owned reads and writes to the selected organization rather than relying only on a client-provided resource ID.

## Membership

Membership describes a user's relationship with one organization. Its status can be pending, approved, rejected, or suspended. Membership approval grants organization access; it does not automatically approve a trainer profile.

## Trainer profile and eligibility

`TrainerProfile` stores professional details, availability, approval metadata and derived competency information. Trainer eligibility has its own pending/approved/rejected/suspended lifecycle. The approval workflow is separate from organization membership.

## Competency, skill and evidence

- A **competency** is a broader capability definition.
- A **skill** is a more specific capability and can be associated with competencies.
- **Evidence** is supporting material submitted to substantiate a trainer's capability.
- Evidence verification records an approval/rejection decision.
- Derived competency values are recomputed from eligible evidence; they should not be manually treated as source evidence.

## Training requirement

A training requirement represents an organization's training need. The schema supports requirement criteria such as required competencies, skill requirements and certification requirements. A requirement is stored independently of a matching execution so it can be edited and evaluated again.

## Matching configuration and match run

Matching configuration defines factor settings used by the matching engine. Configuration versions can be activated. A match run records an execution and result snapshot/history so the outcome can be inspected later. Do not assume the result is a permanent assignment: assignment is a separate workflow.

## Trainer assignment

An assignment links a trainer and trainer profile to a requirement and match run. Its lifecycle includes assigned, in-progress, completed and cancelled states. Capacity reservation and assignment creation are designed to be coordinated transactionally by the service.

## Course, material and enrollment

A course represents a learning offering. Course materials represent content metadata and storage references. An enrollment connects a trainee to a course and records participation state. Material-level progress is tracked separately from enrollment status.

## Assessment and attempt

An assessment belongs to a course and contains versioned questions and evaluation settings. An assessment attempt records a trainee's attempt, submitted answers and outcome. Assessment definition and attempt history are separate records.

## Feedback, announcement and notification

- Feedback is submitted in the context of a course/enrollment and can have an administrative status.
- Announcements are organization communications with audience and publication lifecycle.
- Notifications are recipient-specific in-app records with read state and resource metadata.

## Important distinction

A role, status, or approval in one subsystem does not imply the equivalent state in another. Always inspect the relevant model and service before adding business rules.
