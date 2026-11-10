
import {
    listPendingTrainerApprovals,
    approveTrainerEligibility,
    rejectTrainerEligibility,
    suspendTrainerEligibility
} from "./trainerApproval.service.js";

import ApiResponse from "../../core/responses/ApiResponse.js";
import { asyncHandler } from "../../core/utils/index.js";

/**
 * @name getPendingTrainerApprovals
 * @description Retrieves trainers awaiting eligibility approval.
 */
export const getPendingTrainerApprovals = asyncHandler(
    async (req, res) => {
        const result = await listPendingTrainerApprovals({
            orgId: req.user.orgId,
            page: req.validated.query.page,
            limit: req.validated.query.limit
        });

        return ApiResponse.ok(
            res,
            "Pending trainer approvals retrieved successfully.",
            result.items,
            { pagination: result.pagination }
        );
    }
);

/**
 * @name approveTrainer
 * @description Approves a trainer's eligibility.
 */
export const approveTrainer = asyncHandler(async (req, res) => {
    const result = await approveTrainerEligibility({
        profileId: req.validated.params.id,
        orgId: req.user.orgId,
        adminId: req.user.userId
    });

    return ApiResponse.ok(
        res,
        "Trainer eligibility approved successfully.",
        { trainerProfile: result }
    );
});

/**
 * @name rejectTrainer
 * @description Rejects a trainer's eligibility.
 */
export const rejectTrainer = asyncHandler(async (req, res) => {
    const result = await rejectTrainerEligibility({
        profileId: req.validated.params.id,
        orgId: req.user.orgId,
        adminId: req.user.userId,
        reason: req.validated.body.reason
    });

    return ApiResponse.ok(
        res,
        "Trainer eligibility rejected successfully.",
        { trainerProfile: result }
    );
});

/**
 * @name suspendTrainer
 * @description Suspends an approved trainer's eligibility.
 */
export const suspendTrainer = asyncHandler(async (req, res) => {
    const result = await suspendTrainerEligibility({
        profileId: req.validated.params.id,
        orgId: req.user.orgId,
        adminId: req.user.userId,
        reason: req.validated.body.reason
    });

    return ApiResponse.ok(
        res,
        "Trainer eligibility suspended successfully.",
        { trainerProfile: result }
    );
});
