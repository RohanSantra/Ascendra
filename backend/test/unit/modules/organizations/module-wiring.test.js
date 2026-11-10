import test from "node:test";
import assert from "node:assert/strict";
import Organization from "../../../../src/modules/organizations/organization.model.js";
import OrganizationMembership from "../../../../src/modules/organizationMemberships/organizationMembership.model.js";
import OrganizationInvitation from "../../../../src/modules/organizationInvitations/organizationInvitation.model.js";
import TrainerProfile from "../../../../src/modules/trainerProfiles/trainerProfile.model.js";
import TrainerAssignment from "../../../../src/modules/trainerAssignments/trainerAssignment.model.js";
import TrainingRequirement from "../../../../src/modules/trainingRequirements/trainingRequirement.model.js";
import Skill from "../../../../src/modules/skills/skill.model.js";
import Competency from "../../../../src/modules/competencies/competency.model.js";
import MatchingConfig from "../../../../src/modules/matchingConfig/matchingConfig.model.js";
import Notification from "../../../../src/modules/notifications/notification.model.js";
import * as organizationService from "../../../../src/modules/organizations/organization.service.js";
import * as membershipService from "../../../../src/modules/organizationMemberships/organizationMembership.service.js";
import * as invitationService from "../../../../src/modules/organizationInvitations/organizationInvitation.service.js";
import * as trainerProfileService from "../../../../src/modules/trainerProfiles/trainerProfile.service.js";
import * as trainerApprovalService from "../../../../src/modules/trainerProfiles/trainerApproval.service.js";
import * as assignmentService from "../../../../src/modules/trainerAssignments/trainerAssignment.service.js";
import * as requirementService from "../../../../src/modules/trainingRequirements/trainingRequirement.service.js";
import * as skillService from "../../../../src/modules/skills/skill.service.js";
import * as competencyService from "../../../../src/modules/competencies/competency.service.js";
import * as matchingConfigService from "../../../../src/modules/matchingConfig/matchingConfig.service.js";
import * as notificationService from "../../../../src/modules/notifications/notification.service.js";
import * as organizationController from "../../../../src/modules/organizations/organization.controller.js";
import * as membershipController from "../../../../src/modules/organizationMemberships/organizationMembership.controller.js";
import * as invitationController from "../../../../src/modules/organizationInvitations/organizationInvitation.controller.js";
import * as trainerProfileController from "../../../../src/modules/trainerProfiles/trainerProfile.controller.js";
import * as trainerApprovalController from "../../../../src/modules/trainerProfiles/trainerApproval.controller.js";
import * as assignmentController from "../../../../src/modules/trainerAssignments/trainerAssignment.controller.js";
import * as requirementController from "../../../../src/modules/trainingRequirements/trainingRequirement.controller.js";
import * as skillController from "../../../../src/modules/skills/skill.controller.js";
import * as competencyController from "../../../../src/modules/competencies/competency.controller.js";
import * as matchingConfigController from "../../../../src/modules/matchingConfig/matchingConfig.controller.js";
import * as notificationController from "../../../../src/modules/notifications/notification.controller.js";
import organizationRouter from "../../../../src/modules/organizations/organization.routes.js";
import membershipRouter from "../../../../src/modules/organizationMemberships/organizationMembership.routes.js";
import invitationRouter from "../../../../src/modules/organizationInvitations/organizationInvitation.routes.js";
import trainerProfileRouter from "../../../../src/modules/trainerProfiles/trainerProfile.routes.js";
import trainerApprovalRouter from "../../../../src/modules/trainerProfiles/trainerApproval.routes.js";
import assignmentRouter from "../../../../src/modules/trainerAssignments/trainerAssignment.routes.js";
import requirementRouter from "../../../../src/modules/trainingRequirements/trainingRequirement.routes.js";
import skillRouter from "../../../../src/modules/skills/skill.routes.js";
import competencyRouter from "../../../../src/modules/competencies/competency.routes.js";
import matchingConfigRouter from "../../../../src/modules/matchingConfig/matchingConfig.routes.js";
import notificationRouter from "../../../../src/modules/notifications/notification.routes.js";

test("selected modules expose service, controller, model, and route wiring", () => {
    const modules = [
        [Organization, organizationService, organizationController, organizationRouter],
        [OrganizationMembership, membershipService, membershipController, membershipRouter],
        [OrganizationInvitation, invitationService, invitationController, invitationRouter],
        [TrainerProfile, trainerProfileService, trainerProfileController, trainerProfileRouter],
        [TrainerProfile, trainerApprovalService, trainerApprovalController, trainerApprovalRouter],
        [TrainerAssignment, assignmentService, assignmentController, assignmentRouter],
        [TrainingRequirement, requirementService, requirementController, requirementRouter],
        [Skill, skillService, skillController, skillRouter],
        [Competency, competencyService, competencyController, competencyRouter],
        [MatchingConfig, matchingConfigService, matchingConfigController, matchingConfigRouter],
        [Notification, notificationService, notificationController, notificationRouter]
    ];

    for (const [model, service, controller, router] of modules) {
        assert.equal(typeof model, "function");
        assert.ok(Object.keys(service).length > 0);
        assert.ok(Object.keys(controller).length > 0);
        assert.ok(router.stack.length > 0);
    }

    assert.ok(Organization.schema.path("slug"));
    assert.ok(OrganizationMembership.schema.path("org"));
    assert.ok(OrganizationInvitation.schema.path("tokenHash"));
    assert.ok(TrainerProfile.schema.path("user"));
    assert.ok(TrainerAssignment.schema.path("status"));
    assert.ok(TrainingRequirement.schema.path("status"));
    assert.ok(Skill.schema.path("slug"));
    assert.ok(Competency.schema.path("slug"));
    assert.ok(MatchingConfig.schema.path("version"));
    assert.ok(Notification.schema.path("recipient"));
});
