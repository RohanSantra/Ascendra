import { getPlatformDashboard } from "./platformDashboard.service.js";

import ApiResponse from "../../../core/responses/ApiResponse.js";
import asyncHandler from "../../../core/utils/asyncHandler.js";


/**
 * Retrieves platform-wide dashboard statistics.
 *
 * @route GET /platform-admin/dashboard
 * @access Platform Admin
 */
export const getPlatformDashboardController = asyncHandler(
    async (req, res) => {
        const { periodMonths } = req.validated.query;

        const dashboard = await getPlatformDashboard({
            periodMonths
        });

        return ApiResponse.ok(
            res,
            "Platform dashboard retrieved successfully.",
            dashboard
        );
    }
);