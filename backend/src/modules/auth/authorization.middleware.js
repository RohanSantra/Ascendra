
import mongoose from "mongoose";

import Organization from "../organizations/organization.model.js";
import OrganizationMembership from "../organizationMemberships/organizationMembership.model.js";

import { HTTP_STATUS } from "../../core/constants/index.js";
import AppError from "../../core/errors/AppError.js";
import { asyncHandler } from "../../core/utils/index.js";

/**
 * @name loadOrganizationMembership
 * @description Resolves the authenticated user's membership in the
 * explicitly selected organization using the X-Organization-Id header.
 *
 * Authentication identifies the global user. This middleware resolves
 * their organization-specific authorization context.
 */
export const loadOrganizationMembership = asyncHandler(
    async (req, res, next) => {
        if (!req.user?.userId) {
            throw new AppError(
                "Authentication is required.",
                HTTP_STATUS.UNAUTHORIZED,
                "AUTH_REQUIRED"
            );
        }

        const organizationId = req.get("X-Organization-Id");

        if (!organizationId) {
            throw new AppError(
                "Organization selection is required. Provide the X-Organization-Id header.",
                HTTP_STATUS.BAD_REQUEST,
                "ORGANIZATION_ID_REQUIRED"
            );
        }

        if (!mongoose.isValidObjectId(organizationId)) {
            throw new AppError(
                "The selected organization ID is invalid.",
                HTTP_STATUS.BAD_REQUEST,
                "INVALID_ORGANIZATION_ID"
            );
        }

        const organization = await Organization.findById(organizationId)
            .select("_id status")
            .lean();

        if (!organization) {
            throw new AppError(
                "The selected organization was not found.",
                HTTP_STATUS.NOT_FOUND,
                "ORGANIZATION_NOT_FOUND"
            );
        }

        if (organization.status !== "active") {
            throw new AppError(
                "This organization is not currently active.",
                HTTP_STATUS.FORBIDDEN,
                "ORGANIZATION_NOT_ACTIVE"
            );
        }

        const membership = await OrganizationMembership.findOne({
            org: organization._id,
            user: req.user.userId
        }).lean();

        if (!membership) {
            throw new AppError(
                "You do not have a membership in the selected organization.",
                HTTP_STATUS.FORBIDDEN,
                "ORGANIZATION_MEMBERSHIP_REQUIRED"
            );
        }

        if (membership.status === "suspended") {
            throw new AppError(
                "Your membership in this organization is suspended.",
                HTTP_STATUS.FORBIDDEN,
                "ORGANIZATION_MEMBERSHIP_SUSPENDED"
            );
        }

        if (membership.status === "rejected") {
            throw new AppError(
                "Your membership request for this organization was rejected.",
                HTTP_STATUS.FORBIDDEN,
                "ORGANIZATION_MEMBERSHIP_REJECTED"
            );
        }

        if (membership.status !== "approved") {
            throw new AppError(
                "Your membership in this organization has not been approved.",
                HTTP_STATUS.FORBIDDEN,
                "ORGANIZATION_MEMBERSHIP_NOT_APPROVED"
            );
        }

        req.user = {
            ...req.user,
            orgId: organization._id.toString(),
            membershipId: membership._id.toString(),
            role: membership.role
        };

        next();
    }
);


/**
 * @name authorizeRoles
 * @description Restricts access to users with one of the permitted
 * organization membership roles.
 *
 * @param {...string} allowedRoles
 * @returns {Function} Express middleware.
 */
export const authorizeRoles = (...allowedRoles) => {
    const validRoles = ["admin", "trainer", "trainee"];

    if (
        allowedRoles.length === 0 ||
        allowedRoles.some((role) => !validRoles.includes(role))
    ) {
        throw new Error(
            "authorizeRoles requires at least one valid organization role."
        );
    }

    return (req, res, next) => {
        if (!req.user?.role) {
            return next(
                new AppError(
                    "Organization authorization is required.",
                    HTTP_STATUS.FORBIDDEN,
                    "ORGANIZATION_AUTHORIZATION_REQUIRED"
                )
            );
        }

        if (!allowedRoles.includes(req.user.role)) {
            return next(
                new AppError(
                    "You do not have permission to perform this action.",
                    HTTP_STATUS.FORBIDDEN,
                    "INSUFFICIENT_ROLE"
                )
            );
        }

        next();
    };
};


/**
 * @name authorizePlatformAdmin
 * @description Restricts access to users with the global platform
 * administrator role. Does not require organization membership.
 */
export const authorizePlatformAdmin = (req, res, next) => {
    if (!req.user?.userId) {
        return next(
            new AppError(
                "Authentication is required.",
                HTTP_STATUS.UNAUTHORIZED,
                "AUTH_REQUIRED"
            )
        );
    }

    if (req.user.platformRole !== "platform_admin") {
        return next(
            new AppError(
                "Platform administrator permission is required.",
                HTTP_STATUS.FORBIDDEN,
                "PLATFORM_ADMIN_REQUIRED"
            )
        );
    }

    next();
};
