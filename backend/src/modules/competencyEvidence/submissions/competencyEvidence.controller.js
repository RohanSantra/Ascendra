
import ApiResponse from "../../../core/responses/ApiResponse.js";

import asyncHandler from "../../../core/utils/asyncHandler.js";

import {
    createEvidence,
    listMyEvidence,
    getMyEvidenceById,
    deleteMyEvidence
} from "./competencyEvidence.service.js";

/**
 * @name createEvidenceHandler
 * @description Submits new competency evidence for the authenticated trainer.
 * @access Trainer
 */
export const createEvidenceHandler = asyncHandler(
    async (req, res) => {
        const evidence = await createEvidence({
            orgId: req.user.orgId,
            userId: req.user.userId,
            data: req.validated.body
        });

        return ApiResponse.created(
            res,
            "Evidence submitted successfully.",
            evidence
        );
    }
);

/**
 * @name listMyEvidenceHandler
 * @description Retrieves evidence submitted by the authenticated trainer.
 * @access Trainer
 */
export const listMyEvidenceHandler = asyncHandler(
    async (req, res) => {
        const result = await listMyEvidence({
            orgId: req.user.orgId,
            userId: req.user.userId,
            ...req.validated.query
        });

        return ApiResponse.ok(
            res,
            "Evidence retrieved successfully.",
            result.items,
            {
                pagination: result.pagination
            }
        );
    }
);

/**
 * @name getMyEvidenceHandler
 * @description Retrieves an individual evidence record belonging to the trainer.
 * @access Trainer
 */
export const getMyEvidenceHandler = asyncHandler(
    async (req, res) => {
        const evidence = await getMyEvidenceById({
            evidenceId: req.validated.params.id,
            orgId: req.user.orgId,
            userId: req.user.userId
        });

        return ApiResponse.ok(
            res,
            "Evidence retrieved successfully.",
            evidence
        );
    }
);

/**
 * @name deleteMyEvidenceHandler
 * @description Soft-deletes an evidence record belonging to the trainer.
 * @access Trainer
 */
export const deleteMyEvidenceHandler = asyncHandler(
    async (req, res) => {
        const evidence = await deleteMyEvidence({
            evidenceId: req.validated.params.id,
            orgId: req.user.orgId,
            userId: req.user.userId
        });

        return ApiResponse.ok(
            res,
            "Evidence deleted successfully.",
            evidence
        );
    }
);
