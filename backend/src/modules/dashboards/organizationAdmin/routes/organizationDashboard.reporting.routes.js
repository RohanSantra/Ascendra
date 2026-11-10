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
    organizationDashboardReportingQuerySchema
} from "../validations/organizationDashboard.reporting.validation.js";

import {
    getOrganizationFeedbackReportController
} from "../controllers/organizationDashboard.feedback.controller.js";

import {
    organizationFeedbackReportQuerySchema
} from "../validations/organizationDashboard.feedback.validation.js";

import {
    getOrganizationAnnouncementReportController
} from "../controllers/organizationDashboard.announcement.controller.js";

import {
    organizationAnnouncementReportQuerySchema
} from "../validations/organizationDashboard.announcement.validation.js";

const router = Router();


/**
 * @route GET /organization-admin/reports/activity
 * @description Retrieves monthly aggregate activity trends.
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
 * @route GET /organization-admin/reports/announcements
 * @description Retrieves announcement lifecycle, audience and publication trends.
 * @access Organisation Admin
 */
router.get(
    "/reports/announcements",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin"),
    validateRequest(organizationAnnouncementReportQuerySchema, {
        query: true
    }),
    getOrganizationAnnouncementReportController
);


/**
 * @route GET /organization-admin/reports/feedback
 * @description Retrieves feedback trends and summaries.
 * @access Organisation Admin
 */
router.get(
    "/reports/feedback",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin"),
    validateRequest(organizationFeedbackReportQuerySchema, {
        query: true
    }),
    getOrganizationFeedbackReportController
);

export default router;