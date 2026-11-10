import {
    getMatchingHistory,
    getMatchingRunDetails
} from "./matchingHistory.service.js";

import { ApiResponse } from "../../core/responses/index.js";
import asyncHandler from "../../core/utils/asyncHandler.js";

/**
 * @name getMatchingHistoryHandler
 * @description Retrieves paginated matching history
 * for the currently selected organization.
 *
 * @route GET /api/v1/matching/history
 * @access Organization Admin
 */
export const getMatchingHistoryHandler = asyncHandler(
    async (req, res) => {
        const result = await getMatchingHistory({
            orgId: req.user.orgId,
            page: req.validated.query.page,
            limit: req.validated.query.limit
        });

        return ApiResponse.ok(
            res,
            "Matching history retrieved successfully.",
            {
                matchRuns: result.matchRuns
            },
            {
                pagination: result.pagination
            }
        );
    }
);

/**
 * @name getMatchingRunDetailsHandler
 * @description Retrieves the details of a matching run
 * belonging to the currently selected organization.
 *
 * @route GET /api/v1/matching/history/:id
 * @access Organization Admin
 */
export const getMatchingRunDetailsHandler = asyncHandler(
    async (req, res) => {
        const matchRun = await getMatchingRunDetails({
            orgId: req.user.orgId,
            matchRunId: req.validated.params.id
        });

        return ApiResponse.ok(
            res,
            "Matching run details retrieved successfully.",
            {
                matchRun
            }
        );
    }
);