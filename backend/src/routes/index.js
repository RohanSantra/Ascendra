import express from "express";

// Core application routes.
import healthRoutes from "../modules/health/health.routes.js";
import authRoutes from "../modules/auth/auth.routes.js";

// Organisation management.
import organizationRoutes from "../modules/organizations/organization.routes.js";
import organizationMembershipRoutes from "../modules/organizationMemberships/organizationMembership.routes.js";
import organizationInvitationRoutes from "../modules/organizationInvitations/organizationInvitation.routes.js";

// Trainer profile and approval management.
import trainerProfileRoutes from "../modules/trainerProfiles/trainerProfile.routes.js";
import trainerApprovalRoutes from "../modules/trainerProfiles/trainerApproval.routes.js";

// Competency management.
import competencyRoutes from "../modules/competencies/competency.routes.js";
import skillRoutes from "../modules/skills/skill.routes.js";

// Competency evidence and verification.
import competencyEvidenceRoutes from "../modules/competencyEvidence/submissions/competencyEvidence.routes.js";
import evidenceVerificationRoutes from "../modules/competencyEvidence/verification/evidenceVerification.routes.js";

// Training requirements.
import trainingRequirementRoutes from "../modules/trainingRequirements/trainingRequirement.routes.js";

// Trainer matching and configuration.
import matchingConfigRoutes from "../modules/matchingConfig/matchingConfig.routes.js";
import matchingRoutes from "../modules/matching/matching.routes.js";

// Trainer assignments.
import trainerAssignmentRoutes from "../modules/trainerAssignments/trainerAssignment.routes.js";

// Course management.
import courseRoutes from "../modules/courses/course.routes.js";
import courseMaterialRoutes from "../modules/courseMaterials/courseMaterial.routes.js";
import enrollmentRoutes from "../modules/enrollments/enrollment.routes.js";

// Assessment management.
import assessmentRoutes from "../modules/assessments/assessment.routes.js";

// Learning progress tracking.
import learningProgressRoutes from "../modules/learningProgress/learningProgress.routes.js";

import platformDashboardRoutes from "../modules/dashboards/platformAdmin/platformDashboard.routes.js";


import organizationDashboardRoutes from "../modules/dashboards/organizationAdmin/routes/organizationDashboard.routes.js";
import organizationDashboardReportingRoutes from "../modules/dashboards/organizationAdmin/routes/organizationDashboard.reporting.routes.js";

import feedbackRoutes from "../modules/feedback/feedback.routes.js";
import announcementRoutes from "../modules/announcements/announcement.routes.js";
import notificationRoutes from "../modules/notifications/notification.routes.js";

const router = express.Router();

/**
 * Registers application routes.
 *
 * Feature-specific routes are composed here so that
 * app.js does not need to know about individual modules.
 *
 * The API version prefix is applied globally by app.js.
 *
 * @param {import("express").Router} router - Express router.
 * @returns {import("express").Router} Configured application router.
 */
const registerRoutes = (router) => {
   // Application health and authentication.
   router.use("/health", healthRoutes);
   router.use("/auth", authRoutes);

   // Organisation management and membership.
   router.use("/memberships", organizationMembershipRoutes);
   router.use("/organizations", organizationRoutes);
   router.use("/organization-invitations", organizationInvitationRoutes);

   // Trainer profiles and eligibility approval.
   router.use("/trainer-profiles", trainerProfileRoutes);
   router.use("/trainer-approvals", trainerApprovalRoutes);

   // Competency and skill management.
   router.use("/competencies", competencyRoutes);
   router.use("/skills", skillRoutes);

   // Competency evidence and verification.
   router.use("/evidence/verification", evidenceVerificationRoutes);
   router.use("/evidence", competencyEvidenceRoutes);

   // Training requirement management.
   router.use("/training-requirements", trainingRequirementRoutes);

   // Matching configuration management.
   router.use("/matching-config", matchingConfigRoutes);

   // Trainer matching execution.
   router.use("/matching", matchingRoutes);

   // Trainer assignments.
   router.use("/trainer-assignments", trainerAssignmentRoutes);

   // Course management.
   router.use("/courses", courseRoutes);

   // Course material management.
   router.use("/courses", courseMaterialRoutes);

   // Course enrolment management.
   router.use("/", enrollmentRoutes);

   // Assessment management.
   router.use("/", assessmentRoutes);

   // Learning progress tracking.
   router.use("/", learningProgressRoutes);

   router.use("/platform-admin", platformDashboardRoutes);

   router.use("/organization-admin", organizationDashboardRoutes);
   router.use("/organization-admin", organizationDashboardReportingRoutes);

   router.use("/", feedbackRoutes);
   router.use("/", announcementRoutes);
   
   router.use("/", notificationRoutes);

   return router;
};

registerRoutes(router);

export default router;