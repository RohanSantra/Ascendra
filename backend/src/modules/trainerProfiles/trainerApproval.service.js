
import mongoose from "mongoose";

import TrainerProfile from "./trainerProfile.model.js";
import OrganizationMembership from "../organizationMemberships/organizationMembership.model.js";

import { HTTP_STATUS } from "../../core/constants/index.js";
import AppError from "../../core/errors/AppError.js";

/**
 * @name createTrainerApprovalError
 * @description Creates a standardized trainer approval error.
 * @param {string} message - Error message.
 * @param {number} statusCode - HTTP status code.
 * @param {string} code - Application error code.
 * @returns {AppError} Trainer approval error.
 */
const createTrainerApprovalError = (message, statusCode, code) => {
    return new AppError(message, statusCode, code);
};

/**
 * @name serializeTrainerProfile
 * @description Returns safe trainer profile information for admin review.
 * @param {Object} profile - Trainer profile document.
 * @returns {Object} Serialized trainer profile.
 */
const serializeTrainerProfile = (profile) => ({
    id: profile._id.toString(),
    orgId: profile.org.toString(),
    userId: profile.user?._id?.toString()
        ?? profile.user?.toString()
        ?? null,
    professionalDetails: profile.professionalDetails,
    approval: {
        status: profile.approval.status,
        reviewedBy: profile.approval.reviewedBy?.toString() ?? null,
        reviewedAt: profile.approval.reviewedAt,
        suspendedBy: profile.approval.suspendedBy?.toString() ?? null,
        rejectionReason: profile.approval.rejectionReason,
        suspendedAt: profile.approval.suspendedAt,
        suspensionReason: profile.approval.suspensionReason
    },
    evidenceStats: profile.evidenceStats,
    experience: profile.experience,
    completion: profile.completion,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
});

/**
 * @name assertApprovedTrainerMembership
 * @description Ensures the trainer has an approved trainer membership
 * in the same organization.
 * @param {Object} profile - Trainer profile document.
 * @param {string} orgId - Organization identifier.
 * @param {Object} mongoSession - MongoDB session.
 * @returns {Promise<Object>} Approved membership.
 */
const assertApprovedTrainerMembership = async (
    profile,
    orgId,
    mongoSession
) => {
    const membership = await OrganizationMembership.findOne({
        org: orgId,
        user: profile.user,
        role: "trainer",
        status: "approved"
    }).session(mongoSession);

    if (!membership) {
        throw createTrainerApprovalError(
            "Trainer membership must be approved before eligibility can be reviewed.",
            HTTP_STATUS.CONFLICT,
            "TRAINER_MEMBERSHIP_NOT_APPROVED"
        );
    }

    return membership;
};

/**
 * @name findTrainerProfileForDecision
 * @description Retrieves an organization-scoped trainer profile and
 * verifies that it is awaiting eligibility review.
 * @param {Object} options - Lookup options.
 * @param {string} options.profileId - Trainer profile identifier.
 * @param {string} options.orgId - Organization identifier.
 * @param {Object} options.mongoSession - MongoDB session.
 * @returns {Promise<Object>} Trainer profile document.
 */
const findTrainerProfileForDecision = async ({
    profileId,
    orgId,
    mongoSession
}) => {
    const profile = await TrainerProfile.findOne({
        _id: profileId,
        org: orgId
    }).session(mongoSession);

    if (!profile) {
        throw createTrainerApprovalError(
            "Trainer profile was not found.",
            HTTP_STATUS.NOT_FOUND,
            "TRAINER_PROFILE_NOT_FOUND"
        );
    }

    await assertApprovedTrainerMembership(
        profile,
        orgId,
        mongoSession
    );

    return profile;
};

/**
 * @name listPendingTrainerApprovals
 * @description Lists pending trainer profiles whose organization
 * memberships have already been approved.
 * @param {Object} options - Listing options.
 * @param {string} options.orgId - Organization identifier.
 * @param {number} options.page - Page number.
 * @param {number} options.limit - Page size.
 * @returns {Promise<Object>} Paginated pending trainer profiles.
 */
export const listPendingTrainerApprovals = async ({
    orgId,
    page,
    limit
}) => {
    const skip = (page - 1) * limit;

    const approvedMemberships = await OrganizationMembership.find({
        org: orgId,
        role: "trainer",
        status: "approved"
    })
        .select("user")
        .lean();

    const approvedTrainerIds = approvedMemberships.map(
        (membership) => membership.user
    );

    if (approvedTrainerIds.length === 0) {
        return {
            items: [],
            pagination: {
                page,
                limit,
                total: 0,
                totalPages: 0
            }
        };
    }

    const filter = {
        org: orgId,
        user: { $in: approvedTrainerIds },
        "approval.status": "pending"
    };

    const [profiles, total] = await Promise.all([
        TrainerProfile.find(filter)
            .sort({ createdAt: 1, _id: 1 })
            .skip(skip)
            .limit(limit)
            .populate({
                path: "user",
                select: "firstName lastName email phone"
            })
            .lean(),

        TrainerProfile.countDocuments(filter)
    ]);

    return {
        items: profiles.map((profile) => ({
            ...serializeTrainerProfile(profile),
            user: profile.user
                ? {
                    id: profile.user._id.toString(),
                    firstName: profile.user.firstName,
                    lastName: profile.user.lastName,
                    email: profile.user.email,
                    phone: profile.user.phone ?? null
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
 * @name approveTrainerEligibility
 * @description Approves a pending trainer's eligibility.
 * The trainer must have an approved organization membership.
 * @param {Object} options - Approval information.
 * @param {string} options.profileId - Trainer profile identifier.
 * @param {string} options.orgId - Admin's organization identifier.
 * @param {string} options.adminId - Approving admin's user identifier.
 * @returns {Promise<Object>} Updated trainer profile.
 */
export const approveTrainerEligibility = async ({
    profileId,
    orgId,
    adminId
}) => {
    const mongoSession = await mongoose.startSession();

    try {
        let result;

        await mongoSession.withTransaction(async () => {
            const profile = await findTrainerProfileForDecision({
                profileId,
                orgId,
                mongoSession
            });

            if (profile.approval.status !== "pending") {
                throw createTrainerApprovalError(
                    "Only pending trainer profiles can be approved.",
                    HTTP_STATUS.CONFLICT,
                    "TRAINER_APPROVAL_INVALID_STATUS"
                );
            }

            profile.approval.status = "approved";
            profile.approval.reviewedBy = adminId;
            profile.approval.reviewedAt = new Date();
            profile.approval.suspendedBy = null;
            profile.approval.rejectionReason = null;
            profile.approval.suspendedAt = null;
            profile.approval.suspensionReason = null;

            await profile.save({ session: mongoSession });

            result = serializeTrainerProfile(profile);
        });

        return result;
    } finally {
        await mongoSession.endSession();
    }
};

/**
 * @name rejectTrainerEligibility
 * @description Rejects a pending trainer's eligibility.
 * Organization membership remains unchanged.
 * @param {Object} options - Rejection information.
 * @param {string} options.profileId - Trainer profile identifier.
 * @param {string} options.orgId - Admin's organization identifier.
 * @param {string} options.adminId - Rejecting admin's user identifier.
 * @param {string} options.reason - Rejection reason.
 * @returns {Promise<Object>} Updated trainer profile.
 */
export const rejectTrainerEligibility = async ({
    profileId,
    orgId,
    adminId,
    reason
}) => {
    const mongoSession = await mongoose.startSession();

    try {
        let result;

        await mongoSession.withTransaction(async () => {
            const profile = await findTrainerProfileForDecision({
                profileId,
                orgId,
                mongoSession
            });

            if (profile.approval.status !== "pending") {
                throw createTrainerApprovalError(
                    "Only pending trainer profiles can be rejected.",
                    HTTP_STATUS.CONFLICT,
                    "TRAINER_APPROVAL_INVALID_STATUS"
                );
            }

            profile.approval.status = "rejected";
            profile.approval.reviewedBy = adminId;
            profile.approval.reviewedAt = new Date();
            profile.approval.rejectionReason = reason;
            profile.approval.suspendedBy = null;
            profile.approval.suspendedAt = null;
            profile.approval.suspensionReason = null;

            await profile.save({ session: mongoSession });

            result = serializeTrainerProfile(profile);
        });

        return result;
    } finally {
        await mongoSession.endSession();
    }
};


/**
 * @name suspendTrainerEligibility
 * @description Suspends an approved trainer's eligibility and
 * organization membership atomically.
 *
 * @param {Object} options - Suspension information.
 * @param {string} options.profileId - Trainer profile identifier.
 * @param {string} options.orgId - Admin's organization identifier.
 * @param {string} options.adminId - Suspending admin's user identifier.
 * @param {string} options.reason - Suspension reason.
 * @returns {Promise<Object>} Updated trainer profile.
 */
export const suspendTrainerEligibility = async ({
    profileId,
    orgId,
    adminId,
    reason
}) => {
    const mongoSession = await mongoose.startSession();

    try {
        let result;

        await mongoSession.withTransaction(async () => {
            const profile = await findTrainerProfileForDecision({
                profileId,
                orgId,
                mongoSession
            });

            if (profile.approval.status !== "approved") {
                throw createTrainerApprovalError(
                    "Only approved trainers can have their eligibility suspended.",
                    HTTP_STATUS.CONFLICT,
                    "TRAINER_APPROVAL_INVALID_STATUS"
                );
            }

            // Find the same organization's approved trainer membership.
            const membership = await OrganizationMembership.findOne({
                org: orgId,
                user: profile.user,
                role: "trainer",
                status: "approved"
            }).session(mongoSession);

            if (!membership) {
                throw createTrainerApprovalError(
                    "Approved trainer membership was not found.",
                    HTTP_STATUS.CONFLICT,
                    "TRAINER_MEMBERSHIP_NOT_APPROVED"
                );
            }

            const now = new Date();

            // Suspend trainer eligibility.
            profile.approval.status = "suspended";
            profile.approval.reviewedBy = adminId;
            profile.approval.reviewedAt = now;
            profile.approval.suspendedBy = adminId;
            profile.approval.suspendedAt = now;
            profile.approval.suspensionReason = reason;

            // Suspend membership in the same organization.
            membership.status = "suspended";
            membership.suspendedBy = adminId;
            membership.suspendedAt = now;

            await profile.save({ session: mongoSession });
            await membership.save({ session: mongoSession });

            result = serializeTrainerProfile(profile);
        });

        return result;
    } finally {
        await mongoSession.endSession();
    }
};
