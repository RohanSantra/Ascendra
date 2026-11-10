
import {
    listDiscoverableOrganizations,
    createOrganizationApplication,
    listPendingOrganizationApplications,
    approveOrganizationApplication,
    rejectOrganizationApplication,
    suspendOrganization,
    reactivateOrganization,
} from "./organization.service.js";

import ApiResponse from "../../core/responses/ApiResponse.js";
import { asyncHandler } from "../../core/utils/index.js";

/**
 * GET /organizations
 *
 * Returns publicly discoverable active organisations.
 */
export const getDiscoverableOrganizations = asyncHandler(
    async (req, res) => {
        const result = await listDiscoverableOrganizations(
            req.validated.query
        );

        return ApiResponse.ok(
            res,
            "Organisations retrieved successfully.",
            result.organizations,
            result.pagination
        );
    }
);

/**
 * POST /organizations/applications
 *
 * Allows an authenticated user to apply to create an organisation.
 *
 * The applicant automatically receives a pending admin membership.
 * Platform Administrator approval is required before access is granted.
 */
export const submitOrganizationApplication = asyncHandler(
    async (req, res) => {
        const result = await createOrganizationApplication({
            applicantId: req.user.userId,
            applicationData: req.validated.body,
        });

        return ApiResponse.created(
            res,
            "Organisation application submitted successfully.",
            {
                organization: {
                    id: result.organization._id,
                    name: result.organization.name,
                    slug: result.organization.slug,
                    status: result.organization.status,
                    createdAt: result.organization.createdAt,
                },
                membership: {
                    id: result.membership._id,
                    role: result.membership.role,
                    status: result.membership.status,
                },
            }
        );
    }
);

/**
 * GET /organizations/applications/pending
 *
 * Platform Administrator endpoint.
 *
 * Returns pending organisation applications with pagination.
 */
export const getPendingOrganizationApplications = asyncHandler(
    async (req, res) => {
        const result = await listPendingOrganizationApplications(
            req.validated.query
        );

        return ApiResponse.ok(
            res,
            "Pending organisation applications retrieved successfully.",
            result.organizations,
            result.pagination
        );
    }
);

/**
 * PATCH /organizations/applications/:id/approve
 *
 * Approves a pending organisation application.
 */
export const approveOrganization = asyncHandler(
    async (req, res) => {
        const result = await approveOrganizationApplication({
            organizationId: req.validated.params.id,
            platformAdminId: req.user.userId,
        });

        return ApiResponse.ok(
            res,
            "Organisation application approved successfully.",
            {
                organization: {
                    id: result.organization._id,
                    name: result.organization.name,
                    slug: result.organization.slug,
                    status: result.organization.status,
                    statusChangedAt: result.organization.statusChangedAt,
                },
                membership: {
                    id: result.membership._id,
                    user: result.membership.user,
                    role: result.membership.role,
                    status: result.membership.status,
                    joinedAt: result.membership.joinedAt,
                },
            }
        );
    }
);

/**
 * PATCH /organizations/applications/:id/reject
 *
 * Rejects a pending organisation application.
 */
export const rejectOrganization = asyncHandler(
    async (req, res) => {
        const result = await rejectOrganizationApplication({
            organizationId: req.validated.params.id,
            platformAdminId: req.user.userId,
            reason: req.validated.body.reason,
        });

        return ApiResponse.ok(
            res,
            "Organisation application rejected successfully.",
            {
                organization: {
                    id: result.organization._id,
                    name: result.organization.name,
                    slug: result.organization.slug,
                    status: result.organization.status,
                    statusChangedAt: result.organization.statusChangedAt,
                    statusChangeReason:
                        result.organization.statusChangeReason,
                },
                membership: {
                    id: result.membership._id,
                    user: result.membership.user,
                    role: result.membership.role,
                    status: result.membership.status,
                    rejectedAt: result.membership.rejectedAt,
                    rejectionReason: result.membership.rejectionReason,
                },
            }
        );
    }
);

/**
 * PATCH /organizations/:id/suspend
 *
 * Suspends an active organisation.
 */
export const suspendOrganizationController = asyncHandler(
    async (req, res) => {
        const organization = await suspendOrganization({
            organizationId: req.validated.params.id,
            platformAdminId: req.user.userId,
            reason: req.validated.body.reason,
        });

        return ApiResponse.ok(
            res,
            "Organisation suspended successfully.",
            {
                id: organization._id,
                name: organization.name,
                slug: organization.slug,
                status: organization.status,
                statusChangedAt: organization.statusChangedAt,
                statusChangeReason: organization.statusChangeReason,
            }
        );
    }
);

/**
 * PATCH /organizations/:id/reactivate
 *
 * Reactivates a suspended organisation.
 */
export const reactivateOrganizationController = asyncHandler(
    async (req, res) => {
        const organization = await reactivateOrganization({
            organizationId: req.validated.params.id,
            platformAdminId: req.user.userId,
            reason: req.validated.body.reason,
        });

        return ApiResponse.ok(
            res,
            "Organisation reactivated successfully.",
            {
                id: organization._id,
                name: organization.name,
                slug: organization.slug,
                status: organization.status,
                statusChangedAt: organization.statusChangedAt,
                statusChangeReason: organization.statusChangeReason,
            }
        );
    }
);
