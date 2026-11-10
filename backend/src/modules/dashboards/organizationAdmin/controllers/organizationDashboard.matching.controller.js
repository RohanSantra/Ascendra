import {
    getOrganizationMatchingReport
} from "../services/organizationDashboard.matching.service.js";

import ApiResponse from "../../../../core/responses/ApiResponse.js";
import asyncHandler from "../../../../core/utils/asyncHandler.js";


/**
 * Retrieves matching and trainer assignment reports.
 *
 * @route GET /organization-admin/reports/matching
 * @description Retrieves aggregate matching outcomes and assignment statistics.
 * @access Organisation Admin
 */
export const getOrganizationMatchingReportController = asyncHandler(
    async (req, res) => {
        const { periodMonths } = req.validated.query;

        const report = await getOrganizationMatchingReport({
            orgId: req.user.orgId,
            periodMonths
        });

        return ApiResponse.ok(
            res,
            "Matching and assignment report retrieved successfully.",
            report
        );
    }
);