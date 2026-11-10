import {
    createOrganizationInvitation,
    acceptOrganizationInvitation,
    revokeOrganizationInvitation,
    listOrganizationInvitations
} from "./organizationInvitation.service.js";

import ApiResponse from "../../core/responses/ApiResponse.js";
import asyncHandler from "../../core/utils/asyncHandler.js";

/**
 * Creates an organisation invitation.
 *
 * @route POST /organization-invitations
 * @access Organisation Admin
 */
export const createInvitation = asyncHandler(async (req, res) => {
    const {
        email,
        role,
        expiresInDays
    } = req.validated.body;

    const invitation = await createOrganizationInvitation({
        orgId: req.user.orgId,
        adminId: req.user.userId,
        email,
        role,
        expiresInDays
    });

    return ApiResponse.created(
        res,
        "Organisation invitation sent successfully.",
        invitation
    );
});

/**
 * Accepts an organisation invitation.
 *
 * @route POST /organization-invitations/accept
 * @access Authenticated User
 */
export const acceptInvitation = asyncHandler(async (req, res) => {
    const { token } = req.validated.body;

    const membership = await acceptOrganizationInvitation({
        token,
        userId: req.user.userId
    });

    return ApiResponse.ok(
        res,
        "Organisation invitation accepted successfully.",
        membership
    );
});

/**
 * Revokes a pending organisation invitation.
 *
 * @route PATCH /organization-invitations/:id/revoke
 * @access Organisation Admin
 */
export const revokeInvitation = asyncHandler(async (req, res) => {
    const { id: invitationId } = req.validated.params;

    const invitation = await revokeOrganizationInvitation({
        invitationId,
        orgId: req.user.orgId,
        adminId: req.user.userId
    });

    return ApiResponse.ok(
        res,
        "Organisation invitation revoked successfully.",
        invitation
    );
});

/**
 * Retrieves organisation invitations.
 *
 * @route GET /organization-invitations
 * @access Organisation Admin
 */
export const getOrganizationInvitations = asyncHandler(
    async (req, res) => {
        const {
            page,
            limit,
            status
        } = req.validated.query;

        const result = await listOrganizationInvitations({
            orgId: req.user.orgId,
            page,
            limit,
            status
        });

        return ApiResponse.ok(
            res,
            "Organisation invitations retrieved successfully.",
            result.items,
            {
                pagination: result.pagination
            }
        );
    }
);