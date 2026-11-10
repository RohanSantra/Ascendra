
import CompetencyEvidence from "../submissions/competencyEvidence.model.js";
import TrainerProfile from "../../trainerProfiles/trainerProfile.model.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../../core/constants/index.js";

import AppError from "../../../core/errors/AppError.js";

/**
 * @name getTrainerEvidenceForRecomputation
 * @description Retrieves all evidence records belonging to a trainer
 * within an organization for competency summary recomputation.
 *
 * Deleted and superseded records are intentionally included so that
 * the evidence engine can calculate complete evidence statistics.
 *
 * @param {Object} params - Retrieval parameters.
 * @param {string} params.orgId - Organization ID.
 * @param {string} params.trainerProfileId - Trainer profile ID.
 * @param {Object} [params.session] - Optional MongoDB session.
 * @returns {Promise<Object[]>} Evidence records.
 */
export const getTrainerEvidenceForRecomputation = async ({
    orgId,
    trainerProfileId,
    session
}) => {
    return CompetencyEvidence.find({
        org: orgId,
        trainerProfile: trainerProfileId
    })
        .select(
            "_id type competencies skills details verification isDeleted supersededBy createdAt"
        )
        .sort({ _id: 1 })
        .session(session || null)
        .lean();
};

/**
 * @name updateTrainerEvidenceSummary
 * @description Updates the derived evidence summary fields of a trainer
 * profile using optimistic concurrency control.
 *
 * Only evidence-derived fields are modified. Other trainer profile
 * information is preserved.
 *
 * The optional MongoDB session allows this update to participate
 * in the same transaction as the evidence modification.
 *
 * @param {Object} params - Update parameters.
 * @param {string} params.orgId - Organization ID.
 * @param {string} params.trainerProfileId - Trainer profile ID.
 * @param {Object} params.summary - Mapped trainer profile summary.
 * @param {Object} [params.session] - Optional MongoDB session.
 * @returns {Promise<Object>} Updated trainer profile.
 * @throws {AppError} If the profile does not exist or a concurrent
 * update causes a version conflict.
 */
export const updateTrainerEvidenceSummary = async ({
    orgId,
    trainerProfileId,
    summary,
    session
}) => {
    const trainerProfile = await TrainerProfile.findOne({
        _id: trainerProfileId,
        org: orgId
    }).session(session || null);

    if (!trainerProfile) {
        throw new AppError(
            "Trainer profile not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    trainerProfile.set({
        competencySummary: summary.competencySummary,
        skills: summary.skills,
        evidenceStats: summary.evidenceStats,
        experience: summary.experience,
        competencyRecomputedAt: summary.competencyRecomputedAt
    });

    try {
        await trainerProfile.save({ session });
    } catch (error) {
        if (error.name === "VersionError") {
            throw new AppError(
                "Trainer profile was updated concurrently. Please retry the operation.",
                HTTP_STATUS.CONFLICT,
                ERROR_CODES.RESOURCE_CONFLICT
            );
        }

        throw error;
    }

    return trainerProfile;
};
