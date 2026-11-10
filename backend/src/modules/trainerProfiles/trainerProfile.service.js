import TrainerProfile from "./trainerProfile.model.js";

import { HTTP_STATUS } from "../../core/constants/index.js";
import AppError from "../../core/errors/AppError.js";

/**
 * @name createTrainerProfileError
 * @description Creates a standardized trainer profile error.
 *
 * @param {string} message - Error message.
 * @param {number} statusCode - HTTP status code.
 * @param {string} code - Application error code.
 * @returns {AppError} Trainer profile error.
 */
const createTrainerProfileError = (message, statusCode, code) => {
    return new AppError(message, statusCode, code);
};

/**
 * @name findMyTrainerProfile
 * @description Finds a trainer profile belonging to the authenticated
 * user inside the selected organization.
 *
 * @param {Object} options - Lookup options.
 * @param {string} options.orgId - Organization identifier.
 * @param {string} options.userId - Authenticated user identifier.
 * @param {Object} options.session - Optional MongoDB session.
 * @returns {Promise<Object>} Trainer profile document.
 */
const findMyTrainerProfile = async ({
    orgId,
    userId,
    session = null
}) => {
    let query = TrainerProfile.findOne({
        org: orgId,
        user: userId
    });

    if (session) {
        query = query.session(session);
    }

    const profile = await query;

    if (!profile) {
        throw createTrainerProfileError(
            "Trainer profile was not found in this organization.",
            HTTP_STATUS.NOT_FOUND,
            "TRAINER_PROFILE_NOT_FOUND"
        );
    }

    return profile;
};

/**
 * @name serializeMyTrainerProfile
 * @description Returns safe trainer profile information.
 *
 * System-managed fields are returned for viewing but cannot be
 * modified through the profile management operations.
 *
 * @param {Object} profile - Trainer profile document.
 * @returns {Object} Serialized trainer profile.
 */
const serializeMyTrainerProfile = (profile) => ({
    id: profile._id.toString(),
    orgId: profile.org.toString(),
    userId: profile.user.toString(),

    professionalDetails: profile.professionalDetails,

    approval: {
        status: profile.approval.status,
        reviewedAt: profile.approval.reviewedAt,
        rejectionReason: profile.approval.rejectionReason,
        suspendedAt: profile.approval.suspendedAt,
        suspensionReason: profile.approval.suspensionReason
    },

    competencySummary: profile.competencySummary,

    skills: profile.skills,

    evidenceStats: profile.evidenceStats,

    experience: profile.experience,

    availability: profile.availability,

    completion: profile.completion,

    competencyRecomputedAt: profile.competencyRecomputedAt,

    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
});

/**
 * @name getMyTrainerProfile
 * @description Retrieves the authenticated trainer's profile
 * within the selected organization.
 *
 * @param {Object} options - Lookup options.
 * @param {string} options.orgId - Organization identifier.
 * @param {string} options.userId - Authenticated user identifier.
 * @returns {Promise<Object>} Serialized trainer profile.
 */
export const getMyTrainerProfile = async ({
    orgId,
    userId
}) => {
    const profile = await findMyTrainerProfile({
        orgId,
        userId
    });

    return serializeMyTrainerProfile(profile);
};

/**
 * @name updateMyTrainerProfessionalDetails
 * @description Updates editable professional information.
 *
 * Only explicitly permitted professional fields can be modified.
 *
 * @param {Object} options - Update options.
 * @param {string} options.orgId - Organization identifier.
 * @param {string} options.userId - Authenticated user identifier.
 * @param {Object} options.data - Professional details to update.
 * @returns {Promise<Object>} Updated trainer profile.
 */
export const updateMyTrainerProfessionalDetails = async ({
    orgId,
    userId,
    data
}) => {
    const profile = await findMyTrainerProfile({
        orgId,
        userId
    });

    const allowedFields = [
        "headline",
        "bio",
        "specialization",
        "currentDesignation"
    ];

    for (const field of allowedFields) {
        if (data[field] !== undefined) {
            profile.professionalDetails[field] = data[field];
        }
    }

    await profile.save();

    return serializeMyTrainerProfile(profile);
};


/**
 * @name updateMyTrainerAvailability
 * @description Updates trainer availability preferences.
 *
 * Active training count is controlled by the assignment workflow
 * and cannot be modified by the trainer.
 *
 * The maximum concurrent training limit cannot be reduced below
 * the trainer's current active training count.
 *
 * @param {Object} options - Update options.
 * @param {string} options.orgId - Organization identifier.
 * @param {string} options.userId - Authenticated user identifier.
 * @param {Object} options.data - Availability information.
 * @returns {Promise<Object>} Updated trainer profile.
 */
export const updateMyTrainerAvailability = async ({
    orgId,
    userId,
    data
}) => {
    const profile = await findMyTrainerProfile({
        orgId,
        userId
    });

    if (
        data.maxConcurrentTrainings !== undefined &&
        data.maxConcurrentTrainings < profile.availability.activeTrainings
    ) {
        throw createTrainerProfileError(
            "Maximum concurrent trainings cannot be lower than your current active training count.",
            HTTP_STATUS.CONFLICT,
            "TRAINER_CAPACITY_BELOW_ACTIVE_COUNT"
        );
    }

    const allowedFields = [
        "status",
        "maxConcurrentTrainings"
    ];

    for (const field of allowedFields) {
        if (data[field] !== undefined) {
            profile.availability[field] = data[field];
        }
    }

    await profile.save();

    return serializeMyTrainerProfile(profile);
};
