
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
    evidenceIdParamsSchema,
    pendingEvidenceQuerySchema,
    rejectEvidenceSchema
} from "./evidenceVerification.validation.js";

import {
    listPendingEvidenceHandler,
    getPendingEvidenceHandler,
    approveEvidenceHandler,
    rejectEvidenceHandler
} from "./evidenceVerification.controller.js";

const router = Router();

/**
 * @name adminOnly
 * @description Applies authentication, organization membership
 * validation, and administrator role authorization.
 */
const adminOnly = [
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin")
];

/**
 * @route GET /pending
 * @description Retrieves pending competency evidence for
 * administrator review with pagination and filters.
 * @access Admin
 */
router.get(
    "/pending",
    ...adminOnly,
    validateRequest(pendingEvidenceQuerySchema, {
        query: true
    }),
    listPendingEvidenceHandler
);

/**
 * @route GET /:id
 * @description Retrieves individual pending evidence details.
 * @access Admin
 */
router.get(
    "/:id",
    ...adminOnly,
    validateRequest(evidenceIdParamsSchema, {
        params: true
    }),
    getPendingEvidenceHandler
);

/**
 * @route PATCH /:id/approve
 * @description Verifies submitted competency evidence.
 * @access Admin
 */
router.patch(
    "/:id/approve",
    ...adminOnly,
    validateRequest(evidenceIdParamsSchema, {
        params: true
    }),
    approveEvidenceHandler
);

/**
 * @route PATCH /:id/reject
 * @description Rejects submitted competency evidence with a reason.
 * @access Admin
 */
router.patch(
    "/:id/reject",
    ...adminOnly,
    validateRequest(rejectEvidenceSchema, {
        body: true,
        params: true
    }),
    rejectEvidenceHandler
);

export default router;
