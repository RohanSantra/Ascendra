
import {
    createTrainerAssignment,
    getTrainerAssignmentList,
    getTrainerAssignmentDetails,
    startTrainerAssignment,
    completeTrainerAssignment,
    cancelTrainerAssignment
} from "./trainerAssignment.service.js";

import { ApiResponse } from "../../core/responses/index.js";
import asyncHandler from "../../core/utils/asyncHandler.js";

/**
 * @name createTrainerAssignmentHandler
 * @description Assigns an approved trainer to a training
 * requirement within the selected organization.
 *
 * @route POST /api/v1/trainer-assignments/requirements/:requirementId
 * @access Organization Admin
 */
export const createTrainerAssignmentHandler = asyncHandler(
    async (req, res) => {
        const assignment = await createTrainerAssignment({
            orgId: req.user.orgId,
            requirementId: req.validated.params.requirementId,
            matchRunId: req.validated.body.matchRunId,
            trainerProfileId: req.validated.body.trainerProfileId,
            assignedBy: req.user.userId,
            startDate: req.validated.body.startDate,
            endDate: req.validated.body.endDate
        });

        return ApiResponse.created(
            res,
            "Trainer assigned successfully.",
            {
                assignment
            }
        );
    }
);

/**
 * @name getTrainerAssignmentListHandler
 * @description Retrieves paginated trainer assignments.
 *
 * @route GET /api/v1/trainer-assignments
 * @access Organization Admin
 */
export const getTrainerAssignmentListHandler = asyncHandler(
    async (req, res) => {
        const result = await getTrainerAssignmentList({
            orgId: req.user.orgId,
            page: req.validated.query.page,
            limit: req.validated.query.limit,
            status: req.validated.query.status,
            requirementId: req.validated.query.requirementId
        });

        return ApiResponse.ok(
            res,
            "Trainer assignments retrieved successfully.",
            {
                assignments: result.assignments
            },
            {
                pagination: result.pagination
            }
        );
    }
);

/**
 * @name getTrainerAssignmentDetailsHandler
 * @description Retrieves one assignment belonging
 * to the selected organization.
 *
 * @route GET /api/v1/trainer-assignments/:id
 * @access Organization Admin
 */
export const getTrainerAssignmentDetailsHandler = asyncHandler(
    async (req, res) => {
        const assignment = await getTrainerAssignmentDetails({
            orgId: req.user.orgId,
            assignmentId: req.validated.params.id
        });

        return ApiResponse.ok(
            res,
            "Trainer assignment retrieved successfully.",
            {
                assignment
            }
        );
    }
);

/**
 * @name startTrainerAssignmentHandler
 * @description Starts an assigned training engagement.
 *
 * @route PATCH /api/v1/trainer-assignments/:id/start
 * @access Organization Admin
 */
export const startTrainerAssignmentHandler = asyncHandler(
    async (req, res) => {
        const assignment = await startTrainerAssignment({
            orgId: req.user.orgId,
            assignmentId: req.validated.params.id
        });

        return ApiResponse.ok(
            res,
            "Trainer assignment started successfully.",
            {
                assignment
            }
        );
    }
);

/**
 * @name completeTrainerAssignmentHandler
 * @description Completes an in-progress training engagement.
 *
 * @route PATCH /api/v1/trainer-assignments/:id/complete
 * @access Organization Admin
 */
export const completeTrainerAssignmentHandler = asyncHandler(
    async (req, res) => {
        const assignment = await completeTrainerAssignment({
            orgId: req.user.orgId,
            assignmentId: req.validated.params.id
        });

        return ApiResponse.ok(
            res,
            "Trainer assignment completed successfully.",
            {
                assignment
            }
        );
    }
);

/**
 * @name cancelTrainerAssignmentHandler
 * @description Cancels an assigned or in-progress engagement.
 *
 * @route PATCH /api/v1/trainer-assignments/:id/cancel
 * @access Organization Admin
 */
export const cancelTrainerAssignmentHandler = asyncHandler(
    async (req, res) => {
        const assignment = await cancelTrainerAssignment({
            orgId: req.user.orgId,
            assignmentId: req.validated.params.id,
            cancellationReason:
                req.validated.body.cancellationReason
        });

        return ApiResponse.ok(
            res,
            "Trainer assignment cancelled successfully.",
            {
                assignment
            }
        );
    }
);
