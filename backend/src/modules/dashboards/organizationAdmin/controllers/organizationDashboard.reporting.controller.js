import {
    getOrganizationActivityReport
} from "../services/organizationDashboard.reporting.service.js";

import ApiResponse from "../../../../core/responses/ApiResponse.js";
import asyncHandler from "../../../../core/utils/asyncHandler.js";


/**
 * Retrieves monthly activity reports for the current organisation.
 *
 * @route GET /organization-admin/reports/activity
 * @description Retrieves organisation-scoped monthly activity trends.
 * @access Organisation Admin
 */
export const getOrganizationActivityReportController = asyncHandler(
    async (req, res) => {
        const { periodMonths } = req.validated.query;

        const report = await getOrganizationActivityReport({
            orgId: req.user.orgId,
            periodMonths
        });

        return ApiResponse.ok(
            res,
            "Organisation activity report retrieved successfully.",
            report
        );
    }
);