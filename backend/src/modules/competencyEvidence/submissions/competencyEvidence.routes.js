
import { Router } from "express";

import {
    authenticate
} from "../../auth/auth.middleware.js";

import {
    loadOrganizationMembership,
    authorizeRoles
} from "../../auth/authorization.middleware.js";

import validateRequest from "../../../middleware/validate.middleware.js";

import {
    createEvidenceSchema,
    evidenceIdParamsSchema,
    evidenceListQuerySchema
} from "./competencyEvidence.validation.js";

import {
    createEvidenceHandler,
    listMyEvidenceHandler,
    getMyEvidenceHandler,
    deleteMyEvidenceHandler
} from "./competencyEvidence.controller.js";

const router = Router();

/**
 * @name trainerOnly
 * @description Applies authentication, organization membership
 * validation, and trainer role authorization.
 */
const trainerOnly = [
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainer")
];

/**
 * @route POST /
 * @description Submits new competency evidence.
 * @access Trainer
 */
router.post(
    "/",
    ...trainerOnly,
    validateRequest(createEvidenceSchema, {
        body: true
    }),
    createEvidenceHandler
);

/**
 * @route GET /
 * @description Retrieves the authenticated trainer's evidence
 * with pagination and optional filters.
 * @access Trainer
 */
router.get(
    "/",
    ...trainerOnly,
    validateRequest(evidenceListQuerySchema, {
        query: true
    }),
    listMyEvidenceHandler
);

/**
 * @route GET /:id
 * @description Retrieves an individual evidence record
 * belonging to the authenticated trainer.
 * @access Trainer
 */
router.get(
    "/:id",
    ...trainerOnly,
    validateRequest(evidenceIdParamsSchema, {
        params: true
    }),
    getMyEvidenceHandler
);

/**
 * @route DELETE /:id
 * @description Soft-deletes an evidence record belonging
 * to the authenticated trainer.
 * @access Trainer
 */
router.delete(
    "/:id",
    ...trainerOnly,
    validateRequest(evidenceIdParamsSchema, {
        params: true
    }),
    deleteMyEvidenceHandler
);

export default router;
