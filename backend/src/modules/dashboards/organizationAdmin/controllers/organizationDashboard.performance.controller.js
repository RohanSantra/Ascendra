import {
    getAssessmentPerformanceReport
} from "../services/organizationDashboard.performance.service.js";

import ApiResponse from "../../../../core/responses/ApiResponse.js";
import asyncHandler from "../../../../core/utils/asyncHandler.js";


/**
 * Retrieves assessment performance for the current organisation.
 *
 * @route GET /organization-admin/reports/assessment-performance
 * @description Retrieves assessment pass rates and average scores.
 * @access Organisation Admin
 */
export const getAssessmentPerformanceReportController = asyncHandler(
    async (req, res) => {
        const { periodMonths } = req.validated.query;

        const report = await getAssessmentPerformanceReport({
            orgId: req.user.orgId,
            periodMonths
        });

        return ApiResponse.ok(
            res,
            "Assessment performance report retrieved successfully.",
            report
        );
    }
);