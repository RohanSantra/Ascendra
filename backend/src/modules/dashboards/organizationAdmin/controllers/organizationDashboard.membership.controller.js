import {
    getOrganizationMembershipReport
} from "../services/organizationDashboard.membership.service.js";

import ApiResponse from "../../../../core/responses/ApiResponse.js";
import asyncHandler from "../../../../core/utils/asyncHandler.js";


/**
 * Retrieves organisation membership and registration reports.
 *
 * @route GET /organization-admin/reports/memberships
 * @description Retrieves membership distribution, trainer approvals and registration trends.
 * @access Organisation Admin
 */
export const getOrganizationMembershipReportController = asyncHandler(
    async (req, res) => {
        const { periodMonths } = req.validated.query;

        const report = await getOrganizationMembershipReport({
            orgId: req.user.orgId,
            periodMonths
        });

        return ApiResponse.ok(
            res,
            "Membership report retrieved successfully.",
            report
        );
    }
);