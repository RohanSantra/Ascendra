import { Router } from "express";

import {
    createInvitation,
    acceptInvitation,
    revokeInvitation,
    getOrganizationInvitations
} from "./organizationInvitation.controller.js";

import {
    createOrganizationInvitationSchema,
    acceptOrganizationInvitationSchema,
    revokeOrganizationInvitationSchema,
    listOrganizationInvitationsQuerySchema
} from "./organizationInvitation.validation.js";

import {
    authenticate
} from "../auth/auth.middleware.js";

import {
    loadOrganizationMembership,
    authorizeRoles
} from "../auth/authorization.middleware.js";

import validateRequest from "../../middleware/validate.middleware.js";


const router = Router();


/**
 * @route GET /organization-invitations
 * @description Retrieves organisation invitations with optional status filtering and pagination.
 * @access Organisation Admin
 */
router.get(
    "/",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin"),
    validateRequest(listOrganizationInvitationsQuerySchema, {
        query: true
    }),
    getOrganizationInvitations
);


/**
 * @route POST /organization-invitations
 * @description Creates an invitation for a trainer or trainee.
 * @access Organisation Admin
 */
router.post(
    "/",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin"),
    validateRequest(createOrganizationInvitationSchema, {
        body: true
    }),
    createInvitation
);


/**
 * @route POST /organization-invitations/accept
 * @description Accepts an organisation invitation for the authenticated user.
 * @access Authenticated User
 */
router.post(
    "/accept",
    authenticate,
    validateRequest(acceptOrganizationInvitationSchema, {
        body: true
    }),
    acceptInvitation
);


/**
 * @route PATCH /organization-invitations/:id/revoke
 * @description Revokes a pending organisation invitation.
 * @access Organisation Admin
 */
router.patch(
    "/:id/revoke",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin"),
    validateRequest(revokeOrganizationInvitationSchema, {
        params: true
    }),
    revokeInvitation
);


export default router;