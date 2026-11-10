
import {
    createTrainingRequirement,
    listTrainingRequirements,
    getTrainingRequirementById,
    updateTrainingRequirement,
    archiveTrainingRequirement
} from "./trainingRequirement.service.js";

import { ApiResponse } from "../../core/responses/index.js";
import asyncHandler from "../../core/utils/asyncHandler.js";

/**
 * Creates a new training requirement for the selected organization.
 *
 * Organization and administrator identifiers are obtained from
 * the authenticated organization context.
 *
 * @route POST /
 * @access Organization Admin
 */
export const createTrainingRequirementHandler = asyncHandler(
    async (req, res) => {
        const requirement = await createTrainingRequirement({
            orgId: req.user.orgId,
            adminId: req.user.userId,
            data: req.validated.body
        });

        return ApiResponse.created(
            res,
            "Training requirement created successfully.",
            { requirement }
        );
    }
);

/**
 * Retrieves paginated training requirements for the selected organization.
 *
 * Supports pagination, status filtering and text search.
 *
 * @route GET /
 * @access Organization Admin
 */
export const listTrainingRequirementsHandler = asyncHandler(
    async (req, res) => {
        const result = await listTrainingRequirements({
            orgId: req.user.orgId,
            ...req.validated.query
        });

        return ApiResponse.ok(
            res,
            "Training requirements retrieved successfully.",
            result.requirements,
            { pagination: result.pagination }
        );
    }
);

/**
 * Retrieves a specific training requirement.
 *
 * The service ensures that the requirement belongs to
 * the selected organization.
 *
 * @route GET /:id
 * @access Organization Admin
 */
export const getTrainingRequirementHandler = asyncHandler(
    async (req, res) => {
        const requirement = await getTrainingRequirementById({
            requirementId: req.validated.params.id,
            orgId: req.user.orgId
        });

        return ApiResponse.ok(
            res,
            "Training requirement retrieved successfully.",
            { requirement }
        );
    }
);

/**
 * Updates an existing editable training requirement.
 *
 * The service enforces organization ownership, validates referenced
 * competencies and skills, and protects workflow-controlled states.
 *
 * @route PATCH /:id
 * @access Organization Admin
 */
export const updateTrainingRequirementHandler = asyncHandler(
    async (req, res) => {
        const requirement = await updateTrainingRequirement({
            requirementId: req.validated.params.id,
            orgId: req.user.orgId,
            adminId: req.user.userId,
            data: req.validated.body
        });

        return ApiResponse.ok(
            res,
            "Training requirement updated successfully.",
            { requirement }
        );
    }
);

/**
 * Archives a training requirement.
 *
 * Assigned requirements cannot be archived through this operation.
 *
 * @route PATCH /:id/archive
 * @access Organization Admin
 */
export const archiveTrainingRequirementHandler = asyncHandler(
    async (req, res) => {
        const requirement = await archiveTrainingRequirement({
            requirementId: req.validated.params.id,
            orgId: req.user.orgId,
            adminId: req.user.userId
        });

        return ApiResponse.ok(
            res,
            "Training requirement archived successfully.",
            { requirement }
        );
    }
);
