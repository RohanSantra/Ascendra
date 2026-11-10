import {
    getCoursePerformanceReport
} from "../services/organizationDashboard.coursePerformance.service.js";

import ApiResponse from "../../../../core/responses/ApiResponse.js";
import asyncHandler from "../../../../core/utils/asyncHandler.js";


/**
 * Retrieves course and enrolment performance for the current organisation.
 *
 * @route GET /organization-admin/reports/course-performance
 * @description Retrieves course enrolment and completion statistics.
 * @access Organisation Admin
 */
export const getCoursePerformanceReportController = asyncHandler(
    async (req, res) => {
        const { periodMonths } = req.validated.query;

        const report = await getCoursePerformanceReport({
            orgId: req.user.orgId,
            periodMonths
        });

        return ApiResponse.ok(
            res,
            "Course performance report retrieved successfully.",
            report
        );
    }
);