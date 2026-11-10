
import { Router } from "express";

import validateRequest from "../../middleware/validate.middleware.js";

import { authenticate } from "../auth/auth.middleware.js";

import {
    loadOrganizationMembership,
    authorizeRoles
} from "../auth/authorization.middleware.js";

import {
    createInitialMatchingConfigSchema,
    createMatchingConfigVersionSchema,
    listMatchingConfigVersionsQuerySchema,
    matchingConfigIdParamsSchema
} from "./matchingConfig.validation.js";

import {
    getActiveMatchingConfigHandler,
    listMatchingConfigVersionsHandler,
    createInitialMatchingConfigHandler,
    createMatchingConfigVersionHandler,
    activateMatchingConfigVersionHandler
} from "./matchingConfig.controller.js";

/**
 * Matching configuration routes.
 *
 * All endpoints are restricted to authenticated organization
 * administrators and operate within the selected organization.
 */
const router = Router();

/**
 * Organization administrator authorization middleware.
 */
const adminOnly = [
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin")
];

/**
 * @route GET /api/v1/matching-config/active
 * @description Retrieves the active matching configuration.
 * @access Organization Admin
 */
router.get(
    "/active",
    ...adminOnly,
    getActiveMatchingConfigHandler
);

/**
 * @route GET /api/v1/matching-config/versions
 * @description Lists matching configuration versions.
 * @access Organization Admin
 */
router.get(
    "/versions",
    ...adminOnly,
    validateRequest(listMatchingConfigVersionsQuerySchema, {
        query: true
    }),
    listMatchingConfigVersionsHandler
);

/**
 * @route POST /api/v1/matching-config
 * @description Creates the initial matching configuration.
 * @access Organization Admin
 */
router.post(
    "/",
    ...adminOnly,
    validateRequest(createInitialMatchingConfigSchema, {
        body: true
    }),
    createInitialMatchingConfigHandler
);

/**
 * @route POST /api/v1/matching-config/versions
 * @description Creates a new matching configuration version.
 * @access Organization Admin
 */
router.post(
    "/versions",
    ...adminOnly,
    validateRequest(createMatchingConfigVersionSchema, {
        body: true
    }),
    createMatchingConfigVersionHandler
);

/**
 * @route PATCH /api/v1/matching-config/versions/:id/activate
 * @description Activates an existing matching configuration version.
 * @access Organization Admin
 */
router.patch(
    "/versions/:id/activate",
    ...adminOnly,
    validateRequest(matchingConfigIdParamsSchema, {
        params: true
    }),
    activateMatchingConfigVersionHandler
);

export default router;
