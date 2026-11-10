
import ApiResponse from "../../../core/responses/ApiResponse.js";

import asyncHandler from "../../../core/utils/asyncHandler.js";

import {
    listPendingEvidence,
    getPendingEvidenceById,
    approveEvidence,
    rejectEvidence
} from "./evidenceVerification.service.js";

/**
 * @name listPendingEvidenceHandler
 * @description Retrieves pending competency evidence for
 * administrator review.
 * @access Admin
 */
export const listPendingEvidenceHandler = asyncHandler(
    async (req, res) => {
        const result = await listPendingEvidence({
            orgId: req.user.orgId,
            ...req.validated.query
        });

        return ApiResponse.ok(
            res,
            "Pending evidence retrieved successfully.",
            result.items,
            {
                pagination: result.pagination
            }
        );
    }
);

/**
 * @name getPendingEvidenceHandler
 * @description Retrieves individual pending evidence details
 * for administrator review.
 * @access Admin
 */
export const getPendingEvidenceHandler = asyncHandler(
    async (req, res) => {
        const evidence = await getPendingEvidenceById({
            evidenceId: req.validated.params.id,
            orgId: req.user.orgId
        });

        return ApiResponse.ok(
            res,
            "Evidence details retrieved successfully.",
            evidence
        );
    }
);

/**
 * @name approveEvidenceHandler
 * @description Approves and verifies submitted competency evidence.
 * @access Admin
 */
export const approveEvidenceHandler = asyncHandler(
    async (req, res) => {
        const evidence = await approveEvidence({
            evidenceId: req.validated.params.id,
            orgId: req.user.orgId,
            adminId: req.user.userId
        });

        return ApiResponse.ok(
            res,
            "Evidence verified successfully.",
            evidence
        );
    }
);

/**
 * @name rejectEvidenceHandler
 * @description Rejects submitted competency evidence with a reason.
 * @access Admin
 */
export const rejectEvidenceHandler = asyncHandler(
    async (req, res) => {
        const evidence = await rejectEvidence({
            evidenceId: req.validated.params.id,
            orgId: req.user.orgId,
            adminId: req.user.userId,
            reason: req.validated.body.reason
        });

        return ApiResponse.ok(
            res,
            "Evidence rejected successfully.",
            evidence
        );
    }
);
