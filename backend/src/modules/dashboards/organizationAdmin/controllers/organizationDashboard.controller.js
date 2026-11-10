import {
    getOrganizationDashboard
} from "../services/organizationDashboard.service.js";

import ApiResponse from "../../../../core/responses/ApiResponse.js";
import asyncHandler from "../../../../core/utils/asyncHandler.js";


/**
 * Retrieves aggregate dashboard statistics for the current organisation.
 *
 * @route GET /organization-admin/dashboard
 * @description Retrieves organisation-scoped membership, competency,
 * training, matching, course, assessment and learning statistics.
 * @access Organisation Admin
 */
export const getOrganizationDashboardController = asyncHandler(
    async (req, res) => {
        const dashboard = await getOrganizationDashboard({
            orgId: req.user.orgId
        });

        return ApiResponse.ok(
            res,
            "Organisation dashboard retrieved successfully.",
            dashboard
        );
    }
);