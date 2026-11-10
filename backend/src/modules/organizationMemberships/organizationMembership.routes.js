
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
    createMembershipRequestSchema,
    membershipIdParamsSchema,
    pendingMembershipQuerySchema,
    rejectMembershipSchema
} from "./organizationMembership.validation.js";

import {
    requestOrganizationMembership,
    getPendingMemberships,
    approveOrganizationMembership,
    rejectOrganizationMembership,
    suspendOrganizationMembership,
    getMyMemberships
} from "./organizationMembership.controller.js";

const router = Router();

/**
 * @route GET /api/v1/memberships/me
 * @description Lists memberships of the authenticated user.
 * @access Authenticated user
 */
router.get(
    "/me",
    authenticate,
    getMyMemberships
);

/**
 * @route POST /api/v1/memberships/request
 * @description Requests membership in an existing organization.
 * @access Authenticated user
 */
router.post(
    "/request",
    authenticate,
    validateRequest(createMembershipRequestSchema, {
        body: true
    }),
    requestOrganizationMembership
);


const adminOnly = [
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin")
];

/**
 * @route GET /api/v1/memberships/pending
 * @description Lists pending organisation membership requests.
 * @access Admin
 */
router.get(
    "/pending",
    ...adminOnly,
    validateRequest(pendingMembershipQuerySchema, { query: true }),
    getPendingMemberships
);

/**
 * @route PATCH /api/v1/memberships/:id/approve
 * @description Approves a pending membership.
 * @access Admin
 */
router.patch(
    "/:id/approve",
    ...adminOnly,
    validateRequest(membershipIdParamsSchema, { params: true }),
    approveOrganizationMembership
);

/**
 * @route PATCH /api/v1/memberships/:id/reject
 * @description Rejects a pending membership.
 * @access Admin
 */
router.patch(
    "/:id/reject",
    ...adminOnly,
    validateRequest(rejectMembershipSchema, {
        params: true,
        body: true
    }),
    rejectOrganizationMembership
);

/**
 * @route PATCH /api/v1/memberships/:id/suspend
 * @description Suspends an approved membership.
 * @access Admin
 */
router.patch(
    "/:id/suspend",
    ...adminOnly,
    validateRequest(membershipIdParamsSchema, { params: true }),
    suspendOrganizationMembership
);

export default router;
