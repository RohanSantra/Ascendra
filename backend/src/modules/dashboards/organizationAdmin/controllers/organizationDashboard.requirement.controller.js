import {
    getOrganizationRequirementReport
} from "../services/organizationDashboard.requirement.service.js";

import ApiResponse from "../../../../core/responses/ApiResponse.js";
import asyncHandler from "../../../../core/utils/asyncHandler.js";


/**
 * Retrieves training requirement lifecycle and creation reports.
 *
 * @route GET /organization-admin/reports/requirements
 * @description Retrieves requirement status distribution and creation trends.
 * @access Organisation Admin
 */
export const getOrganizationRequirementReportController = asyncHandler(
    async (req, res) => {
        const { periodMonths } = req.validated.query;

        const report = await getOrganizationRequirementReport({
            orgId: req.user.orgId,
            periodMonths
        });

        return ApiResponse.ok(
            res,
            "Training requirement report retrieved successfully.",
            report
        );
    }
);