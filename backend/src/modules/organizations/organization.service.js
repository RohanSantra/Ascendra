
import mongoose from "mongoose";

import Organization from "./organization.model.js";
import OrganizationMembership from "../organizationMemberships/organizationMembership.model.js";
import AppError from "../../core/errors/AppError.js";

/**
 * Escapes special regular-expression characters.
 *
 * This ensures that a user's search input is treated as ordinary text
 * instead of being interpreted as a regular expression.
 *
 * @param {string} value
 * @returns {string}
 */
const escapeRegex = (value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Executes an operation inside a MongoDB transaction.
 *
 * A transaction is important for workflows that modify multiple documents.
 * For example, approving an organisation must update both:
 * - The organisation's status.
 * - The applicant's admin membership status.
 *
 * If either operation fails, the transaction is rolled back.
 *
 * MongoDB transactions require a replica set or a transaction-capable
 * MongoDB deployment.
 *
 * @param {(session: mongoose.ClientSession) => Promise<any>} operation
 * @returns {Promise<any>}
 */
const executeTransaction = async (operation) => {
    const session = await mongoose.startSession();

    try {
        let result;

        await session.withTransaction(async () => {
            result = await operation(session);
        });

        return result;
    } finally {
        await session.endSession();
    }
};

/**
 * Checks whether a MongoDB duplicate-key error occurred.
 *
 * The database unique indexes remain the final protection against
 * concurrent duplicate organisation slugs.
 *
 * @param {Error} error
 * @returns {boolean}
 */
const isDuplicateKeyError = (error) => error?.code === 11000;

/**
 * Lists publicly discoverable organisations.
 *
 * Only active organisations are returned.
 * Pending, rejected, suspended, and deactivated organisations
 * must not appear in public discovery.
 *
 * @param {{page: number, limit: number, search?: string}} options
 * @returns {Promise<{organizations: Array, pagination: Object}>}
 */
export const listDiscoverableOrganizations = async ({
    page,
    limit,
    search,
}) => {
    const filter = {
        status: "active",
    };

    if (search) {
        const escapedSearch = escapeRegex(search.trim());

        filter.$or = [
            { name: { $regex: escapedSearch, $options: "i" } },
            { slug: { $regex: escapedSearch, $options: "i" } },
        ];
    }

    const skip = (page - 1) * limit;

    const [organizations, total] = await Promise.all([
        Organization.find(filter)
            .select("_id name slug description createdAt")
            .sort({ name: 1, _id: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),

        Organization.countDocuments(filter),
    ]);

    return {
        organizations,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

/**
 * Submits a new organisation application.
 *
 * The applicant receives a pending admin membership. They cannot access
 * the organisation until a Platform Administrator approves the application.
 *
 * The organisation and its initial admin membership are created together
 * in one transaction.
 *
 * @param {{
 *   applicantId: string,
 *   applicationData: Object
 * }} options
 * @returns {Promise<{organization: Object, membership: Object}>}
 */
export const createOrganizationApplication = async ({
    applicantId,
    applicationData,
}) => {
    try {
        return await executeTransaction(async (session) => {
            const existingOrganization = await Organization.exists({
                slug: applicationData.slug,
            }).session(session);

            if (existingOrganization) {
                throw new AppError(
                    "An organisation with this slug already exists.",
                    409,
                    "ORGANIZATION_SLUG_ALREADY_EXISTS"
                );
            }

            const [organization] = await Organization.create(
                [
                    {
                        ...applicationData,
                        status: "pending",
                        createdBy: applicantId,
                    },
                ],
                { session }
            );

            const [membership] = await OrganizationMembership.create(
                [
                    {
                        org: organization._id,
                        user: applicantId,
                        role: "admin",
                        status: "pending",
                    },
                ],
                { session }
            );

            return {
                organization,
                membership,
            };
        });
    } catch (error) {
        if (isDuplicateKeyError(error)) {
            throw new AppError(
                "An organisation with this slug already exists.",
                409,
                "ORGANIZATION_SLUG_ALREADY_EXISTS",
                null,
                error
            );
        }

        throw error;
    }
};

/**
 * Lists organisation applications awaiting Platform Administrator review.
 *
 * Only organisations with status "pending" are returned.
 *
 * @param {{page: number, limit: number, search?: string}} options
 * @returns {Promise<{organizations: Array, pagination: Object}>}
 */
export const listPendingOrganizationApplications = async ({
    page,
    limit,
    search,
}) => {
    const filter = {
        status: "pending",
    };

    if (search) {
        const escapedSearch = escapeRegex(search.trim());

        filter.$or = [
            { name: { $regex: escapedSearch, $options: "i" } },
            { slug: { $regex: escapedSearch, $options: "i" } },
        ];
    }

    const skip = (page - 1) * limit;

    const [organizations, total] = await Promise.all([
        Organization.find(filter)
            .select(
                "_id name slug description contactEmail contactPhone address createdBy status createdAt"
            )
            .populate({
                path: "createdBy",
                select: "firstName lastName email",
            })
            .sort({ createdAt: 1, _id: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),

        Organization.countDocuments(filter),
    ]);

    return {
        organizations,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

/**
 * Approves a pending organisation application.
 *
 * This operation:
 * 1. Finds the pending organisation.
 * 2. Finds the applicant's pending admin membership.
 * 3. Activates the organisation.
 * 4. Approves the applicant's admin membership.
 *
 * Both updates happen in one transaction.
 *
 * @param {{
 *   organizationId: string,
 *   platformAdminId: string
 * }} options
 * @returns {Promise<{organization: Object, membership: Object}>}
 */
export const approveOrganizationApplication = async ({
    organizationId,
    platformAdminId,
}) => {
    return executeTransaction(async (session) => {
        const organization = await Organization.findOne({
            _id: organizationId,
            status: "pending",
        }).session(session);

        if (!organization) {
            throw new AppError(
                "Pending organisation application not found.",
                404,
                "ORGANIZATION_APPLICATION_NOT_FOUND"
            );
        }

        const membership = await OrganizationMembership.findOne({
            org: organization._id,
            user: organization.createdBy,
            role: "admin",
            status: "pending",
        }).session(session);

        if (!membership) {
            throw new AppError(
                "The applicant's pending administrator membership was not found.",
                409,
                "ORGANIZATION_APPLICATION_MEMBERSHIP_NOT_FOUND"
            );
        }

        const now = new Date();

        organization.status = "active";
        organization.statusChangedAt = now;
        organization.statusChangedBy = platformAdminId;
        organization.statusChangeReason =
            "Organization application approved";

        membership.status = "approved";
        membership.joinedAt = now;
        membership.approvedBy = platformAdminId;
        membership.approvedAt = now;

        membership.rejectedBy = undefined;
        membership.rejectedAt = undefined;
        membership.rejectionReason = undefined;

        await organization.save({ session });
        await membership.save({ session });

        return {
            organization,
            membership,
        };
    });
};

/**
 * Rejects a pending organisation application.
 *
 * The organisation and its initial admin membership are both marked
 * as rejected in the same transaction.
 *
 * @param {{
 *   organizationId: string,
 *   platformAdminId: string,
 *   reason: string
 * }} options
 * @returns {Promise<{organization: Object, membership: Object}>}
 */
export const rejectOrganizationApplication = async ({
    organizationId,
    platformAdminId,
    reason,
}) => {
    return executeTransaction(async (session) => {
        const organization = await Organization.findOne({
            _id: organizationId,
            status: "pending",
        }).session(session);

        if (!organization) {
            throw new AppError(
                "Pending organisation application not found.",
                404,
                "ORGANIZATION_APPLICATION_NOT_FOUND"
            );
        }

        const membership = await OrganizationMembership.findOne({
            org: organization._id,
            user: organization.createdBy,
            role: "admin",
            status: "pending",
        }).session(session);

        if (!membership) {
            throw new AppError(
                "The applicant's pending administrator membership was not found.",
                409,
                "ORGANIZATION_APPLICATION_MEMBERSHIP_NOT_FOUND"
            );
        }

        const now = new Date();

        organization.status = "rejected";
        organization.statusChangedAt = now;
        organization.statusChangedBy = platformAdminId;
        organization.statusChangeReason = reason;

        membership.status = "rejected";
        membership.rejectedBy = platformAdminId;
        membership.rejectedAt = now;
        membership.rejectionReason = reason;

        membership.approvedBy = undefined;
        membership.approvedAt = undefined;
        membership.joinedAt = undefined;

        await organization.save({ session });
        await membership.save({ session });

        return {
            organization,
            membership,
        };
    });
};

/**
 * Suspends an active organisation.
 *
 * Organisation membership records are deliberately not individually
 * changed here. The organisation context middleware blocks access
 * while the organisation itself is suspended.
 *
 * This is an organisation-level action, not a global user suspension.
 *
 * @param {{
 *   organizationId: string,
 *   platformAdminId: string,
 *   reason: string
 * }} options
 * @returns {Promise<Object>}
 */
export const suspendOrganization = async ({
    organizationId,
    platformAdminId,
    reason,
}) => {
    return executeTransaction(async (session) => {
        const organization = await Organization.findOne({
            _id: organizationId,
            status: "active",
        }).session(session);

        if (!organization) {
            throw new AppError(
                "Active organisation not found.",
                404,
                "ACTIVE_ORGANIZATION_NOT_FOUND"
            );
        }

        organization.status = "suspended";
        organization.statusChangedAt = new Date();
        organization.statusChangedBy = platformAdminId;
        organization.statusChangeReason = reason;

        await organization.save({ session });

        return organization;
    });
};

/**
 * Reactivates a suspended organisation.
 *
 * Existing approved memberships remain unchanged. Once the organisation
 * becomes active, eligible members can access it again through the
 * organisation context middleware.
 *
 * @param {{
 *   organizationId: string,
 *   platformAdminId: string,
 *   reason: string
 * }} options
 * @returns {Promise<Object>}
 */
export const reactivateOrganization = async ({
    organizationId,
    platformAdminId,
    reason,
}) => {
    return executeTransaction(async (session) => {
        const organization = await Organization.findOne({
            _id: organizationId,
            status: "suspended",
        }).session(session);

        if (!organization) {
            throw new AppError(
                "Suspended organisation not found.",
                404,
                "SUSPENDED_ORGANIZATION_NOT_FOUND"
            );
        }

        organization.status = "active";
        organization.statusChangedAt = new Date();
        organization.statusChangedBy = platformAdminId;
        organization.statusChangeReason = reason;

        await organization.save({ session });

        return organization;
    });
};
