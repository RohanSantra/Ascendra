import {
    getOrganizationTrainerPerformanceReport
} from "../services/organizationDashboard.trainerPerformance.service.js";

import ApiResponse from "../../../../core/responses/ApiResponse.js";
import asyncHandler from "../../../../core/utils/asyncHandler.js";


/**
 * Retrieves trainer workload and course performance statistics.
 *
 * @route GET /organization-admin/reports/trainer-performance
 * @description Retrieves aggregate trainer assignment and course statistics.
 * @access Organisation Admin
 */
export const getOrganizationTrainerPerformanceReportController =
    asyncHandler(async (req, res) => {
        const { periodMonths } = req.validated.query;

        const report = await getOrganizationTrainerPerformanceReport({
            orgId: req.user.orgId,
            periodMonths
        });

        return ApiResponse.ok(
            res,
            "Trainer performance report retrieved successfully.",
            report
        );
    });