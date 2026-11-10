import { Router } from "express";

import { authenticate } from "../../../auth/auth.middleware.js";

import {
    loadOrganizationMembership,
    authorizeRoles
} from "../../../auth/authorization.middleware.js";

import validateRequest from "../../../../middleware/validate.middleware.js";

import {
    getOrganizationActivityReportController
} from "../controllers/organizationDashboard.reporting.controller.js";

import {
    getAssessmentPerformanceReportController
} from "../controllers/organizationDashboard.performance.controller.js";

import {
    getCoursePerformanceReportController
} from "../controllers/organizationDashboard.coursePerformance.controller.js";

import {
    getOrganizationMatchingReportController
} from "../controllers/organizationDashboard.matching.controller.js";

import {
    getOrganizationEvidenceReportController
} from "../controllers/organizationDashboard.evidence.controller.js";

import {
    getOrganizationRequirementReportController
} from "../controllers/organizationDashboard.requirement.controller.js";

import {
    getOrganizationTrainerPerformanceReportController
} from "../controllers/organizationDashboard.trainerPerformance.controller.js";

import {
    getOrganizationLearningReportController
} from "../controllers/organizationDashboard.learning.controller.js";

import {
    getOrganizationMembershipReportController
} from "../controllers/organizationDashboard.membership.controller.js";

import {
    organizationDashboardReportingQuerySchema
} from "../validations/organizationDashboard.reporting.validation.js";


const router = Router();


/**
 * @route GET /organization-admin/reports/activity
 * @description Retrieves monthly aggregate organisation activity trends.
 * @access Organisation Admin
 */
router.get(
    "/reports/activity",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin"),
    validateRequest(organizationDashboardReportingQuerySchema, {
        query: true
    }),
    getOrganizationActivityReportController
);


/**
 * @route GET /organization-admin/reports/assessment-performance
 * @description Retrieves assessment pass rates and average scores.
 * @access Organisation Admin
 */
router.get(
    "/reports/assessment-performance",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin"),
    validateRequest(organizationDashboardReportingQuerySchema, {
        query: true
    }),
    getAssessmentPerformanceReportController
);


/**
 * @route GET /organization-admin/reports/course-performance
 * @description Retrieves course enrolment and completion statistics.
 * @access Organisation Admin
 */
router.get(
    "/reports/course-performance",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin"),
    validateRequest(organizationDashboardReportingQuerySchema, {
        query: true
    }),
    getCoursePerformanceReportController
);


/**
 * @route GET /organization-admin/reports/matching
 * @description Retrieves aggregate matching outcomes and assignment statistics.
 * @access Organisation Admin
 */
router.get(
    "/reports/matching",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin"),
    validateRequest(organizationDashboardReportingQuerySchema, {
        query: true
    }),
    getOrganizationMatchingReportController
);


/**
 * @route GET /organization-admin/reports/evidence
 * @description Retrieves competency evidence verification statistics.
 * @access Organisation Admin
 */
router.get(
    "/reports/evidence",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin"),
    validateRequest(organizationDashboardReportingQuerySchema, {
        query: true
    }),
    getOrganizationEvidenceReportController
);


/**
 * @route GET /organization-admin/reports/requirements
 * @description Retrieves requirement lifecycle distribution and creation trends.
 * @access Organisation Admin
 */
router.get(
    "/reports/requirements",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin"),
    validateRequest(organizationDashboardReportingQuerySchema, {
        query: true
    }),
    getOrganizationRequirementReportController
);


/**
 * @route GET /organization-admin/reports/trainer-performance
 * @description Retrieves aggregate trainer workload and course statistics.
 * @access Organisation Admin
 */
router.get(
    "/reports/trainer-performance",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin"),
    validateRequest(organizationDashboardReportingQuerySchema, {
        query: true
    }),
    getOrganizationTrainerPerformanceReportController
);


/**
 * @route GET /organization-admin/reports/learning-progress
 * @description Retrieves aggregate course progress and learning activity.
 * @access Organisation Admin
 */
router.get(
    "/reports/learning-progress",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin"),
    validateRequest(organizationDashboardReportingQuerySchema, {
        query: true
    }),
    getOrganizationLearningReportController
);


/**
 * @route GET /organization-admin/reports/memberships
 * @description Retrieves membership distribution and registration trends.
 * @access Organisation Admin
 */
router.get(
    "/reports/memberships",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin"),
    validateRequest(organizationDashboardReportingQuerySchema, {
        query: true
    }),
    getOrganizationMembershipReportController
);


export default router;