
import {
    getActiveMatchingConfig,
    listMatchingConfigVersions,
    createInitialMatchingConfig,
    createMatchingConfigVersion,
    activateMatchingConfigVersion
} from "./matchingConfig.service.js";

import { ApiResponse } from "../../core/responses/index.js";
import asyncHandler from "../../core/utils/asyncHandler.js";

/**
 * Retrieves the active matching configuration for the selected organization.
 *
 * @route GET /api/v1/matching-config/active
 * @access Organization Admin
 */
export const getActiveMatchingConfigHandler = asyncHandler(
    async (req, res) => {
        const result = await getActiveMatchingConfig({
            orgId: req.user.orgId
        });

        return ApiResponse.ok(
            res,
            "Active matching configuration retrieved successfully.",
            {
                matchingConfig: result
            }
        );
    }
);

/**
 * Retrieves the version history of matching configurations
 * belonging to the selected organization.
 *
 * @route GET /api/v1/matching-config/versions
 * @access Organization Admin
 */
export const listMatchingConfigVersionsHandler = asyncHandler(
    async (req, res) => {
        const result = await listMatchingConfigVersions({
            orgId: req.user.orgId,
            ...req.validated.query
        });

        return ApiResponse.ok(
            res,
            "Matching configuration versions retrieved successfully.",
            result
        );
    }
);

/**
 * Creates the organization's initial matching configuration.
 *
 * The service automatically assigns version 1 and activates it.
 *
 * @route POST /api/v1/matching-config
 * @access Organization Admin
 */
export const createInitialMatchingConfigHandler = asyncHandler(
    async (req, res) => {
        const result = await createInitialMatchingConfig({
            orgId: req.user.orgId,
            adminId: req.user.userId,
            data: req.validated.body
        });

        return ApiResponse.created(
            res,
            "Initial matching configuration created successfully.",
            {
                matchingConfig: result
            }
        );
    }
);

/**
 * Creates a new matching configuration version.
 *
 * The new version inherits unspecified settings from the latest
 * version and remains inactive until explicitly activated.
 *
 * @route POST /api/v1/matching-config/versions
 * @access Organization Admin
 */
export const createMatchingConfigVersionHandler = asyncHandler(
    async (req, res) => {
        const result = await createMatchingConfigVersion({
            orgId: req.user.orgId,
            adminId: req.user.userId,
            data: req.validated.body
        });

        return ApiResponse.created(
            res,
            "New matching configuration version created successfully.",
            {
                matchingConfig: result
            }
        );
    }
);

/**
 * Activates an existing matching configuration version.
 *
 * The service deactivates the previously active version
 * within the same transaction.
 *
 * @route PATCH /api/v1/matching-config/versions/:id/activate
 * @access Organization Admin
 */
export const activateMatchingConfigVersionHandler = asyncHandler(
    async (req, res) => {
        const result = await activateMatchingConfigVersion({
            orgId: req.user.orgId,
            configId: req.validated.params.id,
            adminId: req.user.userId
        });

        return ApiResponse.ok(
            res,
            "Matching configuration version activated successfully.",
            {
                matchingConfig: result
            }
        );
    }
);
