
import { Router } from "express";

import validateRequest from "../../middleware/validate.middleware.js";

import { authenticate } from "../auth/auth.middleware.js";

import {
    loadOrganizationMembership,
    authorizeRoles
} from "../auth/authorization.middleware.js";

import {
    createTrainingRequirementSchema,
    updateTrainingRequirementSchema,
    trainingRequirementIdParamsSchema,
    listTrainingRequirementsQuerySchema
} from "./trainingRequirement.validation.js";

import {
    createTrainingRequirementHandler,
    listTrainingRequirementsHandler,
    getTrainingRequirementHandler,
    updateTrainingRequirementHandler,
    archiveTrainingRequirementHandler
} from "./trainingRequirement.controller.js";

const router = Router();

/**
 * Organization administrators must have an approved membership
 * in the selected organization.
 */
const adminOnly = [
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin")
];

/**
 * @route POST /api/v1/training-requirements
 * @description Creates a new training requirement for the selected organization.
 * @access Organization Admin
 */
router.post(
    "/",
    ...adminOnly,
    validateRequest(createTrainingRequirementSchema, { body: true }),
    createTrainingRequirementHandler
);

/**
 * @route GET /api/v1/training-requirements
 * @description Retrieves paginated training requirements belonging to the selected organization.
 * @access Organization Admin
 */
router.get(
    "/",
    ...adminOnly,
    validateRequest(listTrainingRequirementsQuerySchema, { query: true }),
    listTrainingRequirementsHandler
);

/**
 * @route GET /api/v1/training-requirements/:id
 * @description Retrieves a specific training requirement belonging to the selected organization.
 * @access Organization Admin
 */
router.get(
    "/:id",
    ...adminOnly,
    validateRequest(trainingRequirementIdParamsSchema, { params: true }),
    getTrainingRequirementHandler
);

/**
 * @route PATCH /api/v1/training-requirements/:id
 * @description Updates an existing editable training requirement.
 * @access Organization Admin
 */
router.patch(
    "/:id",
    ...adminOnly,
    validateRequest(updateTrainingRequirementSchema, {
        body: true,
        params: true
    }),
    updateTrainingRequirementHandler
);

/**
 * @route PATCH /api/v1/training-requirements/:id/archive
 * @description Archives a training requirement.
 * @access Organization Admin
 */
router.patch(
    "/:id/archive",
    ...adminOnly,
    validateRequest(trainingRequirementIdParamsSchema, { params: true }),
    archiveTrainingRequirementHandler
);

export default router;
