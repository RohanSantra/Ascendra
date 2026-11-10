
import {
    createMembershipRequest,
    listPendingMemberships,
    approveMembership,
    rejectMembership,
    suspendMembership,
    listMyMemberships
} from "./organizationMembership.service.js";

import ApiResponse from "../../core/responses/ApiResponse.js";
import { asyncHandler } from "../../core/utils/index.js";



/**
 * @name requestOrganizationMembership
 * @description Submits a request to join an organization.
 */
export const requestOrganizationMembership = asyncHandler(
    async (req, res) => {
        const result = await createMembershipRequest({
            orgId: req.validated.body.orgId,
            userId: req.user.userId,
            role: req.validated.body.role
        });

        return ApiResponse.created(
            res,
            "Organization membership request submitted successfully.",
            { membership: result }
        );
    }
);


/**
 * @name getMyMemberships
 * @description Returns the authenticated user's organization memberships.
 */
export const getMyMemberships = asyncHandler(async (req, res) => {
    const memberships = await listMyMemberships(req.user.userId);

    return ApiResponse.ok(
        res,
        "Your organization memberships retrieved successfully.",
        { memberships }
    );
});




/**
 * @name getPendingMemberships
 * @description Retrieves pending organisation membership requests.
 */
export const getPendingMemberships = asyncHandler(async (req, res) => {
    const result = await listPendingMemberships({
        orgId: req.user.orgId,
        page: req.validated.query.page,
        limit: req.validated.query.limit
    });

    return ApiResponse.ok(
        res,
        "Pending membership requests retrieved successfully.",
        result.items,
        { pagination: result.pagination }
    );
});

/**
 * @name approveOrganizationMembership
 * @description Approves a pending organisation membership.
 */
export const approveOrganizationMembership = asyncHandler(
    async (req, res) => {
        const result = await approveMembership({
            membershipId: req.validated.params.id,
            orgId: req.user.orgId,
            adminId: req.user.userId
        });

        return ApiResponse.ok(
            res,
            "Organization membership approved successfully.",
            { membership: result }
        );
    }
);

/**
 * @name rejectOrganizationMembership
 * @description Rejects a pending organisation membership.
 */
export const rejectOrganizationMembership = asyncHandler(
    async (req, res) => {
        const result = await rejectMembership({
            membershipId: req.validated.params.id,
            orgId: req.user.orgId,
            adminId: req.user.userId,
            reason: req.validated.body.reason
        });

        return ApiResponse.ok(
            res,
            "Organization membership rejected successfully.",
            { membership: result }
        );
    }
);

/**
 * @name suspendOrganizationMembership
 * @description Suspends an approved organisation membership.
 */
export const suspendOrganizationMembership = asyncHandler(
    async (req, res) => {
        const result = await suspendMembership({
            membershipId: req.validated.params.id,
            orgId: req.user.orgId,
            adminId: req.user.userId
        });

        return ApiResponse.ok(
            res,
            "Organization membership suspended successfully.",
            { membership: result }
        );
    }
);
