import {
    executeTrainerMatching
} from "./matching.service.js";

import { ApiResponse } from "../../core/responses/index.js";
import asyncHandler from "../../core/utils/asyncHandler.js";

/**
 * @name executeTrainerMatchingHandler
 * @description Executes trainer matching for a training requirement
 * within the currently selected organization.
 *
 * The organization ID and administrator ID are taken from the
 * authenticated request context, never from the request body.
 *
 * @route POST /api/v1/matching/requirements/:requirementId/execute
 * @access Organization Admin
 */
export const executeTrainerMatchingHandler = asyncHandler(
    async (req, res) => {
        const result = await executeTrainerMatching({
            orgId: req.user.orgId,
            requirementId: req.validated.params.requirementId,
            executedBy: req.user.userId
        });

        return ApiResponse.created(
            res,
            "Trainer matching executed successfully.",
            {
                matchRun: result
            }
        );
    }
);