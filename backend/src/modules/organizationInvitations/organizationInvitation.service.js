
import mongoose from "mongoose";
import { createHash, randomBytes } from "node:crypto";

import OrganizationInvitation from "./organizationInvitation.model.js";
import OrganizationMembership from "../organizationMemberships/organizationMembership.model.js";
import TrainerProfile from "../trainerProfiles/trainerProfile.model.js";
import Organization from "../organizations/organization.model.js";
import User from "../auth/user.model.js";

import { HTTP_STATUS } from "../../core/constants/index.js";
import AppError from "../../core/errors/AppError.js";
import { env } from "../../config/index.js";

import {
    sendOrganizationInvitationEmail
} from "../../core/utils/email.service.js";
import { logger } from "../../core/utils/logger.js";

/**
 * Organization Invitation Service
 *
 * Manages the complete lifecycle of organisation invitations.
 *
 * Responsibilities:
 * - Create and send organisation invitations.
 * - Accept invitations and establish memberships.
 * - Revoke pending invitations.
 * - Retrieve paginated invitation records.
 *
 * Security:
 * - Raw invitation tokens are never persisted.
 * - Only SHA-256 token hashes are stored.
 * - Invitation operations are organisation-scoped.
 * - Only authenticated users with matching email addresses
 *   can accept invitations.
 * - Invitations cannot assign administrative roles.
 *
 * Consistency:
 * - Multi-document acceptance operations use transactions.
 * - Invitation acceptance and revocation use conditional
 *   state transitions.
 * - Membership and trainer-profile approval remain separate.
 */

/**
 * Creates a standardized invitation-related application error.
 *
 * @param {string} message - Human-readable error message.
 * @param {number} statusCode - HTTP status code.
 * @param {string} code - Application error code.
 * @returns {AppError} Controlled application error.
 */
const createInvitationError = (message, statusCode, code) => {
    return new AppError(message, statusCode, code);
};

/**
 * Generates a cryptographically secure invitation token.
 *
 * A 32-byte token produces a 64-character hexadecimal string.
 *
 * @returns {string} Raw invitation token.
 */
const generateInvitationToken = () => {
    return randomBytes(32).toString("hex");
};

/**
 * Generates a SHA-256 hash of an invitation token.
 *
 * Only the resulting hash is stored in MongoDB.
 *
 * @param {string} token - Raw invitation token.
 * @returns {string} SHA-256 hexadecimal hash.
 */
const hashInvitationToken = (token) => {
    return createHash("sha256")
        .update(token)
        .digest("hex");
};

/**
 * Converts a populated or unpopulated user reference
 * into a safe API representation.
 *
 * @param {Object|string|null} user - User reference.
 * @returns {Object|null} Safe user representation.
 */
const serializeUserReference = (user) => {
    if (!user) {
        return null;
    }

    if (typeof user === "object" && user._id) {
        return {
            id: user._id.toString(),
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email
        };
    }

    return {
        id: user.toString()
    };
};

/**
 * Converts an invitation document into a safe API representation.
 *
 * Internal token hashes and database-specific fields
 * are never included in the response.
 *
 * @param {Object} invitation - Invitation document.
 * @returns {Object} Safe invitation representation.
 */
const serializeInvitation = (invitation) => {
    return {
        id: invitation._id.toString(),
        orgId: invitation.org.toString(),
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        invitedBy: serializeUserReference(invitation.invitedBy),
        expiresAt: invitation.expiresAt,
        acceptedBy: serializeUserReference(invitation.acceptedBy),
        acceptedAt: invitation.acceptedAt ?? null,
        revokedBy: serializeUserReference(invitation.revokedBy),
        revokedAt: invitation.revokedAt ?? null,
        createdAt: invitation.createdAt,
        updatedAt: invitation.updatedAt
    };
};

/**
 * Validates invitation role and expiry configuration.
 *
 * This provides a second validation boundary for service
 * callers that do not originate from HTTP routes.
 *
 * @param {string} role - Requested membership role.
 * @param {number} expiresInDays - Invitation validity in days.
 * @throws {AppError} When the supplied values are invalid.
 */
const validateInvitationOptions = (role, expiresInDays) => {
    if (!["trainer", "trainee"].includes(role)) {
        throw createInvitationError(
            "Only trainer and trainee invitations are supported.",
            HTTP_STATUS.BAD_REQUEST,
            "INVALID_INVITATION_ROLE"
        );
    }

    if (
        !Number.isInteger(expiresInDays) ||
        expiresInDays < 1 ||
        expiresInDays > 30
    ) {
        throw createInvitationError(
            "Invitation expiry must be between 1 and 30 days.",
            HTTP_STATUS.BAD_REQUEST,
            "INVALID_INVITATION_EXPIRY"
        );
    }
};

/**
 * Creates an organisation invitation and sends its email.
 *
 * Workflow:
 * 1. Validate invitation options.
 * 2. Verify that the organisation is active.
 * 3. Check for an existing membership.
 * 4. Expire older invitations.
 * 5. Create the new invitation inside a transaction.
 * 6. Send the invitation email after transaction commit.
 * 7. Revoke the invitation if email delivery fails.
 *
 * Email delivery is intentionally performed outside the
 * MongoDB transaction because it is an external side effect
 * that must not be repeated during transaction retries.
 *
 * @param {Object} options - Invitation creation information.
 * @param {string} options.orgId - Organisation identifier.
 * @param {string} options.adminId - Inviting administrator.
 * @param {string} options.email - Invited user's email.
 * @param {string} options.role - Requested membership role.
 * @param {number} options.expiresInDays - Invitation validity.
 * @returns {Promise<Object>} Created invitation summary.
 */
export const createOrganizationInvitation = async ({
    orgId,
    adminId,
    email,
    role,
    expiresInDays
}) => {
    validateInvitationOptions(role, expiresInDays);

    const normalizedEmail = email.trim().toLowerCase();

    const rawToken = generateInvitationToken();
    const tokenHash = hashInvitationToken(rawToken);

    const now = new Date();

    const expiresAt = new Date(
        now.getTime() +
        expiresInDays * 24 * 60 * 60 * 1000
    );

    const mongoSession = await mongoose.startSession();

    let createdInvitation;
    let organizationName;

    try {
        await mongoSession.withTransaction(async () => {
            /**
             * Only active organisations can issue invitations.
             */
            const organization = await Organization.findOne({
                _id: orgId,
                status: "active"
            })
                .select("_id name")
                .session(mongoSession)
                .lean();

            if (!organization) {
                throw createInvitationError(
                    "The selected organisation does not exist or is not active.",
                    HTTP_STATUS.NOT_FOUND,
                    "ORGANIZATION_NOT_AVAILABLE"
                );
            }

            organizationName = organization.name;

            /**
             * Check whether the invited email already belongs
             * to a user with an existing organisation membership.
             *
             * Pending and rejected memberships may be resolved
             * through an invitation. Approved and suspended
             * memberships must not be bypassed.
             */
            const existingUser = await User.findOne({
                email: normalizedEmail
            })
                .select("_id")
                .session(mongoSession)
                .lean();

            if (existingUser) {
                const existingMembership =
                    await OrganizationMembership.findOne({
                        org: orgId,
                        user: existingUser._id
                    })
                        .select("_id role status")
                        .session(mongoSession)
                        .lean();

                if (existingMembership) {
                    if (existingMembership.role === "admin") {
                        throw createInvitationError(
                            "An organisation administrator cannot be invited to a trainer or trainee role.",
                            HTTP_STATUS.CONFLICT,
                            "ADMIN_MEMBERSHIP_ALREADY_EXISTS"
                        );
                    }

                    if (existingMembership.status === "approved") {
                        throw createInvitationError(
                            "This user already has an approved membership in the organisation.",
                            HTTP_STATUS.CONFLICT,
                            "MEMBERSHIP_ALREADY_APPROVED"
                        );
                    }

                    if (existingMembership.status === "suspended") {
                        throw createInvitationError(
                            "This user's organisation membership is suspended.",
                            HTTP_STATUS.FORBIDDEN,
                            "MEMBERSHIP_SUSPENDED"
                        );
                    }
                }
            }

            /**
             * Expire older invitations before checking the
             * partial unique index for pending invitations.
             */
            await OrganizationInvitation.updateMany(
                {
                    org: orgId,
                    email: normalizedEmail,
                    status: "pending",
                    expiresAt: { $lte: now }
                },
                {
                    $set: {
                        status: "expired"
                    }
                },
                {
                    session: mongoSession
                }
            );

            const existingInvitation =
                await OrganizationInvitation.findOne({
                    org: orgId,
                    email: normalizedEmail,
                    status: "pending"
                })
                    .select("_id expiresAt")
                    .session(mongoSession)
                    .lean();

            if (existingInvitation) {
                throw createInvitationError(
                    "A pending invitation already exists for this email address.",
                    HTTP_STATUS.CONFLICT,
                    "INVITATION_ALREADY_PENDING"
                );
            }

            /**
             * Persist only the token hash.
             */
            [createdInvitation] = await OrganizationInvitation.create(
                [
                    {
                        org: orgId,
                        email: normalizedEmail,
                        role,
                        tokenHash,
                        status: "pending",
                        invitedBy: adminId,
                        expiresAt
                    }
                ],
                {
                    session: mongoSession
                }
            );
        });

    } catch (error) {
        /**
         * The database unique index remains the final
         * protection against concurrent invitation creation.
         */
        if (error.code === 11000) {
            throw createInvitationError(
                "A pending invitation already exists for this email address.",
                HTTP_STATUS.CONFLICT,
                "INVITATION_ALREADY_PENDING"
            );
        }

        throw error;

    } finally {
        await mongoSession.endSession();
    }

    /**
     * Construct the frontend acceptance URL after the
     * invitation has been successfully persisted.
     */
    const invitationUrl = new URL(
        "/accept-invitation",
        env.client.url
    );

    invitationUrl.searchParams.set("token", rawToken);

    try {
        await sendOrganizationInvitationEmail({
            to: normalizedEmail,
            organizationName,
            role,
            invitationUrl: invitationUrl.toString(),
            expiresAt
        });

    } catch (emailError) {
        /**
         * Email delivery failed.
         *
         * Invalidate the invitation so that an undelivered
         * invitation does not remain usable.
         *
         * The conditional update avoids overwriting a lifecycle
         * transition performed by another operation.
         */
        try {
            await OrganizationInvitation.updateOne(
                {
                    _id: createdInvitation._id,
                    status: "pending"
                },
                {
                    $set: {
                        status: "revoked",
                        revokedAt: new Date()
                    }
                }
            );

        } catch (cleanupError) {
            /**
             * Keep SMTP and database details out of the response
             * while recording the failed cleanup for operators.
             */
            logger.error(
                "Failed to revoke an invitation after email delivery failed.",
                {
                    invitationId: createdInvitation._id.toString(),
                    errorName: cleanupError.name
                }
            );
        }

        logger.error(
            "Organization invitation email delivery failed.",
            {
                invitationId: createdInvitation._id.toString(),
                errorName: emailError.name
            }
        );

        throw createInvitationError(
            "The invitation could not be delivered. Please try again.",
            HTTP_STATUS.SERVICE_UNAVAILABLE,
            "INVITATION_EMAIL_DELIVERY_FAILED"
        );
    }

    return {
        id: createdInvitation._id.toString(),
        email: normalizedEmail,
        role,
        status: "pending",
        expiresAt
    };
};

/**
 * Accepts an organisation invitation.
 *
 * The invitation is claimed through an atomic conditional
 * state transition inside a MongoDB transaction.
 *
 * The following operations commit or roll back together:
 * - Invitation acceptance.
 * - Membership creation or reactivation.
 * - Trainer profile creation when required.
 *
 * Trainer membership approval does not automatically approve
 * trainer eligibility. TrainerProfile approval remains governed
 * by the separate trainer approval workflow.
 *
 * @param {Object} options - Acceptance information.
 * @param {string} options.token - Raw invitation token.
 * @param {string} options.userId - Authenticated user identifier.
 * @returns {Promise<Object>} Accepted membership information.
 */
export const acceptOrganizationInvitation = async ({
    token,
    userId
}) => {
    const tokenHash = hashInvitationToken(token);
    const now = new Date();

    const mongoSession = await mongoose.startSession();

    let acceptanceResult;

    try {
        await mongoSession.withTransaction(async () => {
            /**
             * Atomically claim the invitation.
             *
             * Only a pending and unexpired invitation can
             * transition to accepted.
             *
             * If another request has already accepted or revoked
             * it, this conditional update will not match.
             */
            const invitation =
                await OrganizationInvitation.findOneAndUpdate(
                    {
                        tokenHash,
                        status: "pending",
                        expiresAt: { $gt: now }
                    },
                    {
                        $set: {
                            status: "accepted",
                            acceptedBy: userId,
                            acceptedAt: now
                        }
                    },
                    {
                        returnDocument: "after",
                        session: mongoSession,
                        runValidators: true
                    }
                );

            if (!invitation) {
                /**
                 * Check whether the token belongs to an
                 * expired pending invitation.
                 */
                const pendingInvitation =
                    await OrganizationInvitation.findOne({
                        tokenHash,
                        status: "pending"
                    })
                        .select("_id expiresAt")
                        .session(mongoSession)
                        .lean();

                if (
                    pendingInvitation &&
                    pendingInvitation.expiresAt <= now
                ) {
                    await OrganizationInvitation.updateOne(
                        {
                            _id: pendingInvitation._id,
                            status: "pending",
                            expiresAt: { $lte: now }
                        },
                        {
                            $set: {
                                status: "expired"
                            }
                        },
                        {
                            session: mongoSession
                        }
                    );

                    acceptanceResult = {
                        expired: true
                    };

                    return;
                }

                throw createInvitationError(
                    "The invitation is invalid, revoked, or has already been used.",
                    HTTP_STATUS.NOT_FOUND,
                    "INVITATION_NOT_FOUND"
                );
            }

            /**
             * The accepting account must exist and be active.
             */
            const user = await User.findOne({
                _id: userId,
                status: "active"
            })
                .select("_id email")
                .session(mongoSession)
                .lean();

            if (!user) {
                throw createInvitationError(
                    "An active user account is required to accept this invitation.",
                    HTTP_STATUS.FORBIDDEN,
                    "USER_NOT_ACTIVE"
                );
            }

            /**
             * Prevent an invitation from being accepted
             * by an account with a different email address.
             */
            if (
                user.email.trim().toLowerCase() !==
                invitation.email
            ) {
                throw createInvitationError(
                    "This invitation was sent to a different email address.",
                    HTTP_STATUS.FORBIDDEN,
                    "INVITATION_EMAIL_MISMATCH"
                );
            }

            /**
             * The organisation must still be active.
             */
            const organization = await Organization.findOne({
                _id: invitation.org,
                status: "active"
            })
                .select("_id")
                .session(mongoSession)
                .lean();

            if (!organization) {
                throw createInvitationError(
                    "The organisation is no longer available.",
                    HTTP_STATUS.FORBIDDEN,
                    "ORGANIZATION_NOT_AVAILABLE"
                );
            }

            /**
             * Retrieve the existing organisation membership,
             * if one already exists.
             */
            let membership = await OrganizationMembership.findOne({
                org: invitation.org,
                user: userId
            }).session(mongoSession);

            if (membership) {
                /**
                 * Invitations must never downgrade or replace
                 * an organisation administrator's role.
                 */
                if (membership.role === "admin") {
                    throw createInvitationError(
                        "An organisation administrator cannot accept a trainer or trainee invitation.",
                        HTTP_STATUS.CONFLICT,
                        "ADMIN_MEMBERSHIP_ALREADY_EXISTS"
                    );
                }

                if (membership.status === "approved") {
                    throw createInvitationError(
                        "You already have an approved membership in this organisation.",
                        HTTP_STATUS.CONFLICT,
                        "MEMBERSHIP_ALREADY_APPROVED"
                    );
                }

                if (membership.status === "suspended") {
                    throw createInvitationError(
                        "Your membership is suspended. Contact the organisation administrator.",
                        HTTP_STATUS.FORBIDDEN,
                        "MEMBERSHIP_SUSPENDED"
                    );
                }

                /**
                 * A pending or rejected membership may be
                 * approved through a valid administrator invitation.
                 */
                membership.role = invitation.role;
                membership.status = "approved";
                membership.joinedAt = now;

                membership.approvedBy = invitation.invitedBy;
                membership.approvedAt = now;

                membership.rejectedBy = null;
                membership.rejectedAt = null;
                membership.rejectionReason = null;

                membership.suspendedBy = null;
                membership.suspendedAt = null;

                await membership.save({
                    session: mongoSession
                });

            } else {
                /**
                 * Create a new approved organisation membership.
                 */
                [membership] = await OrganizationMembership.create(
                    [
                        {
                            org: invitation.org,
                            user: userId,
                            role: invitation.role,
                            status: "approved",
                            joinedAt: now,
                            approvedBy: invitation.invitedBy,
                            approvedAt: now
                        }
                    ],
                    {
                        session: mongoSession
                    }
                );
            }

            /**
             * Trainer profiles are organisation-specific.
             *
             * Create a profile only for trainer memberships.
             * Existing approval state is deliberately preserved.
             */
            if (invitation.role === "trainer") {
                await TrainerProfile.updateOne(
                    {
                        org: invitation.org,
                        user: userId
                    },
                    {
                        $setOnInsert: {
                            org: invitation.org,
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

            acceptanceResult = {
                expired: false,
                membership: {
                    id: membership._id.toString(),
                    orgId: membership.org.toString(),
                    userId: membership.user.toString(),
                    role: membership.role,
                    status: membership.status,
                    joinedAt: membership.joinedAt,
                    approvedBy: membership.approvedBy.toString(),
                    approvedAt: membership.approvedAt
                }
            };
        });

    } catch (error) {
        /**
         * A concurrent request may have created a membership
         * or trainer profile first. The transaction must not
         * leave a partially accepted invitation.
         */
        if (error.code === 11000) {
            throw createInvitationError(
                "The invitation could not be accepted because a related membership or profile already exists.",
                HTTP_STATUS.CONFLICT,
                "INVITATION_ACCEPTANCE_CONFLICT"
            );
        }

        throw error;

    } finally {
        await mongoSession.endSession();
    }

    if (acceptanceResult?.expired) {
        throw createInvitationError(
            "This invitation has expired. Ask the organisation administrator for a new invitation.",
            HTTP_STATUS.GONE,
            "INVITATION_EXPIRED"
        );
    }

    return acceptanceResult.membership;
};

/**
 * Revokes a pending organisation invitation.
 *
 * The operation is organisation-scoped and uses a conditional
 * atomic update so that an accepted or already revoked invitation
 * cannot be overwritten.
 *
 * @param {Object} options - Revocation information.
 * @param {string} options.invitationId - Invitation identifier.
 * @param {string} options.orgId - Administrator's organisation.
 * @param {string} options.adminId - Administrator identifier.
 * @returns {Promise<Object>} Updated invitation summary.
 */
export const revokeOrganizationInvitation = async ({
    invitationId,
    orgId,
    adminId
}) => {
    const now = new Date();

    /**
     * Only a pending and unexpired invitation can be revoked.
     */
    const revokedInvitation =
        await OrganizationInvitation.findOneAndUpdate(
            {
                _id: invitationId,
                org: orgId,
                status: "pending",
                expiresAt: { $gt: now }
            },
            {
                $set: {
                    status: "revoked",
                    revokedBy: adminId,
                    revokedAt: now
                }
            },
            {
                returnDocument: "after",
                runValidators: true
            }
        );

    if (revokedInvitation) {
        return serializeInvitation(revokedInvitation);
    }

    /**
     * Determine whether the invitation exists but has expired.
     */
    const invitation = await OrganizationInvitation.findOne({
        _id: invitationId,
        org: orgId
    })
        .select("_id status expiresAt")
        .lean();

    if (!invitation) {
        throw createInvitationError(
            "Invitation not found in this organisation.",
            HTTP_STATUS.NOT_FOUND,
            "INVITATION_NOT_FOUND"
        );
    }

    if (
        invitation.status === "pending" &&
        invitation.expiresAt <= now
    ) {
        await OrganizationInvitation.updateOne(
            {
                _id: invitationId,
                org: orgId,
                status: "pending",
                expiresAt: { $lte: now }
            },
            {
                $set: {
                    status: "expired"
                }
            }
        );

        throw createInvitationError(
            "This invitation has already expired.",
            HTTP_STATUS.GONE,
            "INVITATION_EXPIRED"
        );
    }

    throw createInvitationError(
        "This invitation is no longer pending and cannot be revoked.",
        HTTP_STATUS.CONFLICT,
        "INVITATION_NOT_PENDING"
    );
};

/**
 * Lists organisation invitations with pagination.
 *
 * Results are restricted to the supplied organisation.
 * Expired pending invitations are updated before retrieval.
 *
 * @param {Object} options - Listing options.
 * @param {string} options.orgId - Organisation identifier.
 * @param {number} options.page - Current page.
 * @param {number} options.limit - Records per page.
 * @param {string} [options.status] - Optional invitation status.
 * @returns {Promise<Object>} Paginated invitation results.
 */
export const listOrganizationInvitations = async ({
    orgId,
    page,
    limit,
    status
}) => {
    const now = new Date();

    /**
     * Synchronise expired invitation statuses before listing.
     */
    await OrganizationInvitation.updateMany(
        {
            org: orgId,
            status: "pending",
            expiresAt: { $lte: now }
        },
        {
            $set: {
                status: "expired"
            }
        }
    );

    const filter = {
        org: orgId
    };

    if (status) {
        filter.status = status;
    }

    const skip = (page - 1) * limit;

    const [invitations, total] = await Promise.all([
        OrganizationInvitation.find(filter)
            .select("-tokenHash")
            .populate({
                path: "invitedBy",
                select: "firstName lastName email"
            })
            .populate({
                path: "acceptedBy",
                select: "firstName lastName email"
            })
            .populate({
                path: "revokedBy",
                select: "firstName lastName email"
            })
            .sort({
                createdAt: -1,
                _id: -1
            })
            .skip(skip)
            .limit(limit)
            .lean(),

        OrganizationInvitation.countDocuments(filter)
    ]);

    return {
        items: invitations.map(serializeInvitation),

        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};
