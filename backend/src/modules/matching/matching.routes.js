import { Router } from "express";

import validateRequest from "../../middleware/validate.middleware.js";

import { authenticate } from "../auth/auth.middleware.js";

import {
    loadOrganizationMembership,
    authorizeRoles
} from "../auth/authorization.middleware.js";

import {
    executeTrainerMatchingSchema,
    matchRunIdParamsSchema,
    listMatchRunsQuerySchema
} from "./matching.validation.js";

import {
    getMatchingHistoryHandler,
    getMatchingRunDetailsHandler
} from "./matchingHistory.controller.js";

import {
    executeTrainerMatchingHandler
} from "./matching.controller.js";

/**
 * @name router
 * @description Defines trainer matching execution routes.
 */
const router = Router();

/**
 * @name adminOnly
 * @description Restricts matching execution to authenticated
 * administrators of the selected organization.
 */
const adminOnly = [
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin")
];

/**
 * @route POST /api/v1/matching/requirements/:requirementId/execute
 * @description Executes trainer matching for a training requirement.
 * @access Organization Admin
 */
router.post(
    "/requirements/:requirementId/execute",
    ...adminOnly,
    validateRequest(executeTrainerMatchingSchema, {
        params: true
    }),
    executeTrainerMatchingHandler
);

/**
 * @route GET /api/v1/matching/history
 * @description Retrieves paginated matching run history.
 * @access Organization Admin
 */
router.get(
    "/history",
    ...adminOnly,
    validateRequest(listMatchRunsQuerySchema, {
        query: true
    }),
    getMatchingHistoryHandler
);

/**
 * @route GET /api/v1/matching/history/:id
 * @description Retrieves details of a specific matching run.
 * @access Organization Admin
 */
router.get(
    "/history/:id",
    ...adminOnly,
    validateRequest(matchRunIdParamsSchema, {
        params: true
    }),
    getMatchingRunDetailsHandler
);

export default router;