import {
    getOrganizationLearningReport
} from "../services/organizationDashboard.learning.service.js";

import ApiResponse from "../../../../core/responses/ApiResponse.js";
import asyncHandler from "../../../../core/utils/asyncHandler.js";


/**
 * Retrieves organisation learning progress reports.
 *
 * @route GET /organization-admin/reports/learning-progress
 * @description Retrieves aggregate course progress and monthly learning activity.
 * @access Organisation Admin
 */
export const getOrganizationLearningReportController = asyncHandler(
    async (req, res) => {
        const { periodMonths } = req.validated.query;

        const report = await getOrganizationLearningReport({
            orgId: req.user.orgId,
            periodMonths
        });

        return ApiResponse.ok(
            res,
            "Learning progress report retrieved successfully.",
            report
        );
    }
);