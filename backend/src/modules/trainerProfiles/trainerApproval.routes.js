
import { Router } from "express";

import validateRequest from "../../middleware/validate.middleware.js";

import {
    authenticate
} from "../auth/auth.middleware.js";

import {
    loadOrganizationMembership,
    authorizeRoles
} from "../auth/authorization.middleware.js";

import {
    trainerProfileIdParamsSchema,
    pendingTrainerApprovalQuerySchema,
    rejectTrainerApprovalSchema,
    suspendTrainerApprovalSchema
} from "./trainerApproval.validation.js";

import {
    getPendingTrainerApprovals,
    approveTrainer,
    rejectTrainer,
    suspendTrainer
} from "./trainerApproval.controller.js";

const router = Router();

const adminOnly = [
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin")
];

/**
 * @route GET /api/v1/trainer-approvals/pending
 * @description Lists trainers awaiting eligibility approval.
 * @access Admin
 */
router.get(
    "/pending",
    ...adminOnly,
    validateRequest(pendingTrainerApprovalQuerySchema, {
        query: true
    }),
    getPendingTrainerApprovals
);

/**
 * @route PATCH /api/v1/trainer-approvals/:id/approve
 * @description Approves trainer eligibility.
 * @access Admin
 */
router.patch(
    "/:id/approve",
    ...adminOnly,
    validateRequest(trainerProfileIdParamsSchema, {
        params: true
    }),
    approveTrainer
);

/**
 * @route PATCH /api/v1/trainer-approvals/:id/reject
 * @description Rejects trainer eligibility.
 * @access Admin
 */
router.patch(
    "/:id/reject",
    ...adminOnly,
    validateRequest(rejectTrainerApprovalSchema, {
        params: true,
        body: true
    }),
    rejectTrainer
);

/**
 * @route PATCH /api/v1/trainer-approvals/:id/suspend
 * @description Suspends trainer eligibility.
 * @access Admin
 */
router.patch(
    "/:id/suspend",
    ...adminOnly,
    validateRequest(suspendTrainerApprovalSchema, {
        params: true,
        body: true
    }),
    suspendTrainer
);

export default router;
