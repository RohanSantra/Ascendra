
import { Router } from "express";

import validateRequest from "../../middleware/validate.middleware.js";

import { authenticate } from "../auth/auth.middleware.js";

import {
    loadOrganizationMembership,
    authorizeRoles
} from "../auth/authorization.middleware.js";

import {
    createTrainerAssignmentSchema,
    trainerAssignmentIdParamsSchema,
    listTrainerAssignmentsQuerySchema,
    cancelTrainerAssignmentSchema
} from "./trainerAssignment.validation.js";

import {
    createTrainerAssignmentHandler,
    getTrainerAssignmentListHandler,
    getTrainerAssignmentDetailsHandler,
    startTrainerAssignmentHandler,
    completeTrainerAssignmentHandler,
    cancelTrainerAssignmentHandler
} from "./trainerAssignment.controller.js";

/**
 * @name router
 * @description Defines trainer assignment routes.
 */
const router = Router();

/**
 * @name adminOnly
 * @description Restricts assignment operations to
 * authenticated administrators of the selected organization.
 */
const adminOnly = [
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin")
];

/**
 * @route GET /api/v1/trainer-assignments
 * @description Retrieves paginated trainer assignments.
 * @access Organization Admin
 */
router.get(
    "/",
    ...adminOnly,
    validateRequest(listTrainerAssignmentsQuerySchema, {
        query: true
    }),
    getTrainerAssignmentListHandler
);

/**
 * @route POST /api/v1/trainer-assignments/requirements/:requirementId
 * @description Assigns a trainer to a training requirement.
 * @access Organization Admin
 */
router.post(
    "/requirements/:requirementId",
    ...adminOnly,
    validateRequest(createTrainerAssignmentSchema, {
        body: true,
        params: true
    }),
    createTrainerAssignmentHandler
);

/**
 * @route PATCH /api/v1/trainer-assignments/:id/start
 * @description Starts an assigned training engagement.
 * @access Organization Admin
 */
router.patch(
    "/:id/start",
    ...adminOnly,
    validateRequest(trainerAssignmentIdParamsSchema, {
        params: true
    }),
    startTrainerAssignmentHandler
);

/**
 * @route PATCH /api/v1/trainer-assignments/:id/complete
 * @description Completes an in-progress training engagement.
 * @access Organization Admin
 */
router.patch(
    "/:id/complete",
    ...adminOnly,
    validateRequest(trainerAssignmentIdParamsSchema, {
        params: true
    }),
    completeTrainerAssignmentHandler
);

/**
 * @route PATCH /api/v1/trainer-assignments/:id/cancel
 * @description Cancels an assigned or in-progress engagement.
 * @access Organization Admin
 */
router.patch(
    "/:id/cancel",
    ...adminOnly,
    validateRequest(cancelTrainerAssignmentSchema, {
        params: true,
        body: true
    }),
    cancelTrainerAssignmentHandler
);

/**
 * @route GET /api/v1/trainer-assignments/:id
 * @description Retrieves an individual trainer assignment.
 * @access Organization Admin
 */
router.get(
    "/:id",
    ...adminOnly,
    validateRequest(trainerAssignmentIdParamsSchema, {
        params: true
    }),
    getTrainerAssignmentDetailsHandler
);

export default router;
