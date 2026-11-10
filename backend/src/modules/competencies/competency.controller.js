import ApiResponse from "../../core/responses/ApiResponse.js";

import asyncHandler from "../../core/utils/asyncHandler.js";

import {
    createCompetency,
    listCompetencies,
    getCompetencyById,
    updateCompetency,
    archiveCompetency
} from "./competency.service.js";

/**
 * Creates a new competency.
 *
 * @name createCompetencyHandler
 * @description Creates an organization competency.
 */
export const createCompetencyHandler = asyncHandler(
    async (req, res) => {
        const competency = await createCompetency({
            orgId: req.user.orgId,
            adminId: req.user.userId,
            data: req.validated.body
        });

        return ApiResponse.created(
            res,
            "Competency created successfully.",
            competency
        );
    }
);

/**
 * Lists organization competencies.
 *
 * @name listCompetenciesHandler
 * @description Retrieves competencies with pagination.
 */
export const listCompetenciesHandler = asyncHandler(
    async (req, res) => {
        const result = await listCompetencies({
            orgId: req.user.orgId,
            ...req.validated.query
        });

        return ApiResponse.ok(
            res,
            "Competencies retrieved successfully.",
            result.items,
            {
                pagination: result.pagination
            }
        );
    }
);

/**
 * Retrieves a competency by ID.
 *
 * @name getCompetencyHandler
 * @description Retrieves one organization competency.
 */
export const getCompetencyHandler = asyncHandler(
    async (req, res) => {
        const competency = await getCompetencyById({
            competencyId: req.validated.params.id,
            orgId: req.user.orgId
        });

        return ApiResponse.ok(
            res,
            "Competency retrieved successfully.",
            competency
        );
    }
);

/**
 * Updates an existing competency.
 *
 * @name updateCompetencyHandler
 * @description Updates competency information.
 */
export const updateCompetencyHandler = asyncHandler(
    async (req, res) => {
        const competency = await updateCompetency({
            competencyId: req.validated.params.id,
            orgId: req.user.orgId,
            adminId: req.user.userId,
            data: req.validated.body
        });

        return ApiResponse.ok(
            res,
            "Competency updated successfully.",
            competency
        );
    }
);

/**
 * Archives a competency.
 *
 * @name archiveCompetencyHandler
 * @description Archives a competency without deleting it.
 */
export const archiveCompetencyHandler = asyncHandler(
    async (req, res) => {
        const competency = await archiveCompetency({
            competencyId: req.validated.params.id,
            orgId: req.user.orgId,
            adminId: req.user.userId
        });

        return ApiResponse.ok(
            res,
            "Competency archived successfully.",
            competency
        );
    }
);