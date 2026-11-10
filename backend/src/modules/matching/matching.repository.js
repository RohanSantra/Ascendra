
import OrganizationMembership from "../organizationMemberships/organizationMembership.model.js";
import CompetencyEvidence from "../competencyEvidence/submissions/competencyEvidence.model.js";
import TrainerProfile from "../trainerProfiles/trainerProfile.model.js";

import TrainingRequirement from "../trainingRequirements/trainingRequirement.model.js"
import MatchingConfig from "../matchingConfig/matchingConfig.model.js";
import MatchRun from "../matchRun/matchRun.model.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../core/constants/index.js";

import AppError from "../../core/errors/AppError.js";

/**
 * @name getTrainingRequirementForMatching
 * @description Retrieves an organization-scoped training requirement
 * that is eligible for trainer matching.
 *
 * Draft, cancelled, and archived requirements cannot be matched.
 *
 * @param {Object} params - Retrieval parameters.
 * @param {string} params.orgId - Organization ID.
 * @param {string} params.requirementId - Training requirement ID.
 * @param {Object} [params.session] - Optional MongoDB session.
 * @returns {Promise<Object>} Training requirement.
 * @throws {AppError} If the requirement is not found or is not eligible.
 */
export const getTrainingRequirementForMatching = async ({
    orgId,
    requirementId,
    session
}) => {
    const requirement = await TrainingRequirement.findOne({
        _id: requirementId,
        org: orgId,
        status: { $in: ["ready", "matched"] }
    })
        .session(session || null)
        .lean();

    if (!requirement) {
        throw new AppError(
            "Training requirement not found or is not ready for matching.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    return requirement;
};

/**
 * @name getActiveMatchingConfig
 * @description Retrieves the active matching configuration
 * belonging to an organization.
 *
 * @param {Object} params - Retrieval parameters.
 * @param {string} params.orgId - Organization ID.
 * @param {Object} [params.session] - Optional MongoDB session.
 * @returns {Promise<Object>} Active matching configuration.
 * @throws {AppError} If no active configuration exists.
 */
export const getActiveMatchingConfig = async ({
    orgId,
    session
}) => {
    const matchingConfig = await MatchingConfig.findOne({
        org: orgId,
        isActive: true
    })
        .session(session || null)
        .lean();

    if (!matchingConfig) {
        throw new AppError(
            "Active matching configuration not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    return matchingConfig;
};

/**
 * @name getEligibleTrainerProfiles
 * @description Retrieves approved trainers belonging to an organization.
 *
 * Only trainers with approved organization memberships and approved
 * trainer profiles are considered. Unavailable and on-leave trainers
 * are excluded. Trainers at capacity remain eligible so they can be
 * displayed with an at-capacity indicator.
 *
 * @param {Object} params - Retrieval parameters.
 * @param {string} params.orgId - Organization ID.
 * @param {Object} [params.session] - Optional MongoDB session.
 * @returns {Promise<Object[]>} Eligible trainer profiles.
 */
export const getEligibleTrainerProfiles = async ({
    orgId,
    session
}) => {
    const approvedMemberships = await OrganizationMembership.find({
        org: orgId,
        role: "trainer",
        status: "approved"
    })
        .select("_id user")
        .session(session || null)
        .lean();

    if (approvedMemberships.length === 0) {
        return [];
    }

    const trainerUserIds = approvedMemberships.map(
        (membership) => membership.user
    );

    return TrainerProfile.find({
        org: orgId,
        user: { $in: trainerUserIds },
        "approval.status": "approved",
        "availability.status": {
            $nin: ["unavailable", "on_leave"]
        }
    })
        .select(
            "_id org user professionalDetails approval availability completion competencySummary skills evidenceStats experience competencyRecomputedAt"
        )
        .sort({ _id: 1 })
        .session(session || null)
        .lean();
};

/**
 * @name getTrainerEvidenceForMatching
 * @description Retrieves eligible evidence records for the supplied
 * trainer profiles within an organization.
 *
 * Deleted, superseded, and rejected evidence is excluded.
 * Both verified and self-reported evidence are retrieved so that
 * the matching engine can apply the configured trust weights.
 *
 * File and storage metadata are intentionally not retrieved.
 *
 * @param {Object} params - Retrieval parameters.
 * @param {string} params.orgId - Organization ID.
 * @param {string[]} params.trainerProfileIds - Trainer profile IDs.
 * @param {Object} [params.session] - Optional MongoDB session.
 * @returns {Promise<Object[]>} Eligible evidence records.
 */
export const getTrainerEvidenceForMatching = async ({
    orgId,
    trainerProfileIds,
    session
}) => {
    if (!Array.isArray(trainerProfileIds) || trainerProfileIds.length === 0) {
        return [];
    }

    return CompetencyEvidence.find({
        org: orgId,
        trainerProfile: { $in: trainerProfileIds },
        isDeleted: false,
        supersededBy: null,
        "verification.status": {
            $in: ["verified", "self_reported"]
        }
    })
        .select(
            "_id trainerProfile type competencies skills title description details verification isDeleted supersededBy createdAt"
        )
        .sort({ trainerProfile: 1, _id: 1 })
        .session(session || null)
        .lean();
};

/**
 * @name createMatchRun
 * @description Persists a matching execution and its calculated results.
 *
 * MatchRun records are immutable after creation. This function only
 * creates a new record and does not expose update operations.
 *
 * @param {Object} params - Creation parameters.
 * @param {Object} params.matchRunData - Match run document data.
 * @param {Object} [params.session] - Optional MongoDB session.
 * @returns {Promise<Object>} Persisted match run.
 */
export const createMatchRun = async ({
    matchRunData,
    session
}) => {
    const matchRun = new MatchRun(matchRunData);

    await matchRun.save(
        session ? { session } : {}
    );

    return matchRun;
};

/**
 * @name updateRequirementAfterMatching
 * @description Updates a training requirement with the latest matching
 * execution reference and changes its status to matched.
 *
 * @param {Object} params - Update parameters.
 * @param {string} params.orgId - Organization ID.
 * @param {string} params.requirementId - Training requirement ID.
 * @param {string} params.matchRunId - Latest match run ID.
 * @param {string} params.updatedBy - User ID performing the update.
 * @param {Object} [params.session] - Optional MongoDB session.
 * @returns {Promise<Object>} Updated training requirement.
 * @throws {AppError} If the requirement cannot be updated.
 */
export const updateRequirementAfterMatching = async ({
    orgId,
    requirementId,
    matchRunId,
    updatedBy,
    session
}) => {
    const requirement = await TrainingRequirement.findOneAndUpdate(
        {
            _id: requirementId,
            org: orgId,
            status: { $in: ["ready", "matched"] }
        },
        {
            $set: {
                latestMatchRun: matchRunId,
                status: "matched",
                updatedBy
            }
        },
        {
            returnDocument: "after",
            runValidators: true,
            session
        }
    );

    if (!requirement) {
        throw new AppError(
            "Training requirement could not be updated after matching.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    return requirement;
};

/**
 * @name getMatchRuns
 * @description Retrieves paginated matching run history
 * belonging to an organization.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {number} params.page
 * @param {number} params.limit
 * @returns {Promise<Object>}
 */
export const getMatchRuns = async ({
    orgId,
    page = 1,
    limit = 20
}) => {
    const filter = {
        org: orgId
    };

    const skip = (page - 1) * limit;

    const [matchRuns, total] = await Promise.all([
        MatchRun.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),

        MatchRun.countDocuments(filter)
    ]);

    return {
        matchRuns,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

/**
 * @name getMatchRunById
 * @description Retrieves one matching run belonging
 * to the selected organization.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.matchRunId
 * @returns {Promise<Object|null>}
 */
export const getMatchRunById = async ({
    orgId,
    matchRunId
}) => {
    return MatchRun.findOne({
        _id: matchRunId,
        org: orgId
    }).lean();
};