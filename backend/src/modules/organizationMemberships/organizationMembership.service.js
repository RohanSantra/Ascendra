
import mongoose from "mongoose";

import OrganizationMembership from "./organizationMembership.model.js";
import TrainerProfile from "../trainerProfiles/trainerProfile.model.js";
import Organization from "../organizations/organization.model.js";

import { HTTP_STATUS } from "../../core/constants/index.js";
import AppError from "../../core/errors/AppError.js";

/**
 * @name createMembershipError
 * @description Creates a standardized membership operation error.
 * @param {string} message - Error message.
 * @param {number} statusCode - HTTP status code.
 * @param {string} code - Application error code.
 * @returns {AppError} Membership error.
 */
const createMembershipError = (message, statusCode, code) => {
    return new AppError(message, statusCode, code);
};

/**
 * @name serializeMembership
 * @description Returns safe membership information for administrative responses.
 * @param {Object} membership - Membership document.
 * @returns {Object} Serialized membership.
 */
const serializeMembership = (membership) => ({
    id: membership._id.toString(),
    orgId: membership.org.toString(),
    userId: membership.user.toString(),
    role: membership.role,
    status: membership.status,
    joinedAt: membership.joinedAt,
    approvedBy: membership.approvedBy?.toString() ?? null,
    approvedAt: membership.approvedAt,
    rejectedBy: membership.rejectedBy?.toString() ?? null,
    rejectedAt: membership.rejectedAt,
    rejectionReason: membership.rejectionReason,
    suspendedBy: membership.suspendedBy?.toString() ?? null,
    suspendedAt: membership.suspendedAt,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt
});


/**
 * @name createMembershipRequest
 * @description Creates or reopens a user's membership request for an active organization.
 * @param {Object} options - Request information.
 * @param {string} options.orgId - Target organization identifier.
 * @param {string} options.userId - Requesting user's identifier.
 * @param {string} options.role - Requested organization role.
 * @returns {Promise<Object>} Created or updated membership.
 */
export const createMembershipRequest = async ({
    orgId,
    userId,
    role
}) => {
    const mongoSession = await mongoose.startSession();

    try {
        let result;

        await mongoSession.withTransaction(async () => {
            const organization = await Organization.findOne({
                _id: orgId,
                status: "active"
            })
                .select("_id")
                .session(mongoSession)
                .lean();

            if (!organization) {
                throw createMembershipError(
                    "The selected organization does not exist or is not active.",
                    HTTP_STATUS.NOT_FOUND,
                    "ORGANIZATION_NOT_AVAILABLE"
                );
            }

            let membership = await OrganizationMembership.findOne({
                org: orgId,
                user: userId
            }).session(mongoSession);

            if (membership) {
                if (membership.status === "approved") {
                    throw createMembershipError(
                        "You already have an approved membership in this organization.",
                        HTTP_STATUS.CONFLICT,
                        "MEMBERSHIP_ALREADY_APPROVED"
                    );
                }

                if (membership.status === "pending") {
                    throw createMembershipError(
                        "Your membership request is already pending.",
                        HTTP_STATUS.CONFLICT,
                        "MEMBERSHIP_REQUEST_ALREADY_PENDING"
                    );
                }

                if (membership.status === "suspended") {
                    throw createMembershipError(
                        "Your membership is suspended. Contact the organization administrator.",
                        HTTP_STATUS.FORBIDDEN,
                        "MEMBERSHIP_SUSPENDED"
                    );
                }

                // A rejected request can be submitted again.
                membership.role = role;
                membership.status = "pending";

                membership.joinedAt = null;
                membership.approvedBy = null;
                membership.approvedAt = null;

                membership.rejectedBy = null;
                membership.rejectedAt = null;
                membership.rejectionReason = null;

                membership.suspendedBy = null;
                membership.suspendedAt = null;

                await membership.save({ session: mongoSession });
            } else {
                [membership] = await OrganizationMembership.create(
                    [{
                        org: orgId,
                        user: userId,
                        role,
                        status: "pending"
                    }],
                    { session: mongoSession }
                );
            }

            // A trainer profile is organization-specific.
            // Trainer eligibility approval remains a separate workflow.
            if (role === "trainer") {
                await TrainerProfile.updateOne(
                    {
                        org: orgId,
                        user: userId
                    },
                    {
                        $setOnInsert: {
                            org: orgId,
                            user: userId
                        }
                    },
                    {
                        upsert: true,
                        session: mongoSession,
                        setDefaultsOnInsert: true
                    }
                );
            }

            result = serializeMembership(membership);
        });

        return result;
    } catch (error) {
        if (error.code === 11000) {
            throw createMembershipError(
                "A membership request already exists for this organization.",
                HTTP_STATUS.CONFLICT,
                "MEMBERSHIP_REQUEST_ALREADY_EXISTS"
            );
        }

        throw error;
    } finally {
        await mongoSession.endSession();
    }
};



/**
 * @name listMyMemberships
 * @description Lists all organization memberships belonging to a user.
 * @param {string} userId - Authenticated global user identifier.
 * @returns {Promise<Array>} Organization membership summaries.
 */
export const listMyMemberships = async (userId) => {
    const memberships = await OrganizationMembership.find({
        user: userId
    })
        .populate({
            path: "org",
            select: "name slug description status"
        })
        .sort({ createdAt: -1, _id: -1 })
        .lean();

    return memberships.map((membership) => ({
        id: membership._id.toString(),
        role: membership.role,
        status: membership.status,
        joinedAt: membership.joinedAt ?? null,
        requestedAt: membership.createdAt,
        rejectionReason: membership.rejectionReason ?? null,
        organization: membership.org
            ? {
                id: membership.org._id.toString(),
                name: membership.org.name,
                slug: membership.org.slug,
                description: membership.org.description ?? null,
                status: membership.org.status
            }
            : null
    }));
};



/**
 * @name listPendingMemberships
 * @description Retrieves pending membership requests for one organization.
 * @param {Object} options - Listing options.
 * @param {string} options.orgId - Organization identifier.
 * @param {number} options.page - Page number.
 * @param {number} options.limit - Page size.
 * @returns {Promise<Object>} Paginated membership requests.
 */
export const listPendingMemberships = async ({
    orgId,
    page,
    limit
}) => {
    const filter = {
        org: orgId,
        status: "pending"
    };

    const skip = (page - 1) * limit;

    const [memberships, total] = await Promise.all([
        OrganizationMembership.find(filter)
            .sort({ createdAt: 1, _id: 1 })
            .skip(skip)
            .limit(limit)
            .populate({
                path: "user",
                select: "firstName lastName email phone"
            })
            .lean(),

        OrganizationMembership.countDocuments(filter)
    ]);

    return {
        items: memberships.map((membership) => ({
            id: membership._id.toString(),
            role: membership.role,
            status: membership.status,
            createdAt: membership.createdAt,
            user: membership.user
                ? {
                    id: membership.user._id.toString(),
                    firstName: membership.user.firstName,
                    lastName: membership.user.lastName,
                    email: membership.user.email,
                    phone: membership.user.phone ?? null
                }
                : null
        })),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

/**
 * @name approveMembership
 * @description Approves a pending organization membership.
 * @param {Object} options - Approval information.
 * @param {string} options.membershipId - Membership identifier.
 * @param {string} options.orgId - Admin's organization identifier.
 * @param {string} options.adminId - Approving admin's user identifier.
 * @returns {Promise<Object>} Updated membership.
 */
export const approveMembership = async ({
    membershipId,
    orgId,
    adminId
}) => {
    const mongoSession = await mongoose.startSession();

    try {
        let result;

        await mongoSession.withTransaction(async () => {
            const membership = await OrganizationMembership.findOne({
                _id: membershipId,
                org: orgId
            }).session(mongoSession);

            if (!membership) {
                throw createMembershipError(
                    "Membership request was not found.",
                    HTTP_STATUS.NOT_FOUND,
                    "MEMBERSHIP_NOT_FOUND"
                );
            }

            if (membership.status !== "pending") {
                throw createMembershipError(
                    "Only pending memberships can be approved.",
                    HTTP_STATUS.CONFLICT,
                    "MEMBERSHIP_INVALID_STATUS"
                );
            }

            const now = new Date();

            membership.status = "approved";
            membership.joinedAt = now;
            membership.approvedBy = adminId;
            membership.approvedAt = now;

            membership.rejectedBy = null;
            membership.rejectedAt = null;
            membership.rejectionReason = null;

            await membership.save({ session: mongoSession });

            result = serializeMembership(membership);
        });

        return result;
    } finally {
        await mongoSession.endSession();
    }
};

/**
 * @name rejectMembership
 * @description Rejects a pending organization membership.
 * @param {Object} options - Rejection information.
 * @param {string} options.membershipId - Membership identifier.
 * @param {string} options.orgId - Admin's organization identifier.
 * @param {string} options.adminId - Rejecting admin's user identifier.
 * @param {string} options.reason - Rejection reason.
 * @returns {Promise<Object>} Updated membership.
 */
export const rejectMembership = async ({
    membershipId,
    orgId,
    adminId,
    reason
}) => {
    const mongoSession = await mongoose.startSession();

    try {
        let result;

        await mongoSession.withTransaction(async () => {
            const membership = await OrganizationMembership.findOne({
                _id: membershipId,
                org: orgId
            }).session(mongoSession);

            if (!membership) {
                throw createMembershipError(
                    "Membership request was not found.",
                    HTTP_STATUS.NOT_FOUND,
                    "MEMBERSHIP_NOT_FOUND"
                );
            }

            if (membership.status !== "pending") {
                throw createMembershipError(
                    "Only pending memberships can be rejected.",
                    HTTP_STATUS.CONFLICT,
                    "MEMBERSHIP_INVALID_STATUS"
                );
            }

            membership.status = "rejected";
            membership.rejectedBy = adminId;
            membership.rejectedAt = new Date();
            membership.rejectionReason = reason;

            membership.approvedBy = null;
            membership.approvedAt = null;
            membership.joinedAt = null;

            await membership.save({ session: mongoSession });

            result = serializeMembership(membership);
        });

        return result;
    } finally {
        await mongoSession.endSession();
    }
};

/**
 * @name suspendMembership
 * @description Suspends an approved membership. Trainer membership suspension
 * also suspends the associated trainer profile in the same transaction.
 * @param {Object} options - Suspension information.
 * @param {string} options.membershipId - Membership identifier.
 * @param {string} options.orgId - Admin's organization identifier.
 * @param {string} options.adminId - Suspending admin's user identifier.
 * @returns {Promise<Object>} Updated membership.
 */
export const suspendMembership = async ({
    membershipId,
    orgId,
    adminId
}) => {
    const mongoSession = await mongoose.startSession();

    try {
        let result;

        await mongoSession.withTransaction(async () => {
            const membership = await OrganizationMembership.findOne({
                _id: membershipId,
                org: orgId
            }).session(mongoSession);

            if (!membership) {
                throw createMembershipError(
                    "Membership was not found.",
                    HTTP_STATUS.NOT_FOUND,
                    "MEMBERSHIP_NOT_FOUND"
                );
            }

            if (membership.status !== "approved") {
                throw createMembershipError(
                    "Only approved memberships can be suspended.",
                    HTTP_STATUS.CONFLICT,
                    "MEMBERSHIP_INVALID_STATUS"
                );
            }

            const now = new Date();

            if (membership.role === "trainer") {
                const trainerProfile = await TrainerProfile.findOne({
                    org: orgId,
                    user: membership.user
                }).session(mongoSession);

                if (!trainerProfile) {
                    throw createMembershipError(
                        "The trainer profile associated with this membership was not found.",
                        HTTP_STATUS.CONFLICT,
                        "TRAINER_PROFILE_NOT_FOUND"
                    );
                }

                trainerProfile.approval.status = "suspended";
                trainerProfile.approval.reviewedBy = adminId;
                trainerProfile.approval.reviewedAt = now;
                trainerProfile.approval.suspendedAt = now;
                trainerProfile.approval.suspensionReason =
                    "Organization membership suspended.";

                await trainerProfile.save({ session: mongoSession });
            }

            membership.status = "suspended";
            membership.suspendedAt = now;
            membership.suspendedBy = adminId;

            await membership.save({ session: mongoSession });

            result = serializeMembership(membership);
        });

        return result;
    } finally {
        await mongoSession.endSession();
    }
};
