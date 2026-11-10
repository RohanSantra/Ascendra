import mongoose from "mongoose";

import {
    recomputeTrainerEvidenceSummary
} from "../domain/evidenceRecomputation.service.js";

import CompetencyEvidence from "./competencyEvidence.model.js";

import OrganizationMembership from "../../organizationMemberships/organizationMembership.model.js";
import TrainerProfile from "../../trainerProfiles/trainerProfile.model.js";

import Competency from "../../competencies/competency.model.js";
import Skill from "../../skills/skill.model.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../../core/constants/index.js";

import AppError from "../../../core/errors/AppError.js";

import assertOrganizationReferences from "../../../core/utils/organizationReferences.js";

/**
 * @name createEvidenceError
 * @description Creates a standardized application error.
 *
 * @param {string} message - Error message.
 * @param {number} statusCode - HTTP status code.
 * @param {string} code - Application error code.
 * @returns {AppError} Application error instance.
 */
const createEvidenceError = (message, statusCode, code) => {
    return new AppError(message, statusCode, code);
};

/**
 * @name escapeRegex
 * @description Escapes special regex characters in search input.
 *
 * @param {string} value - Search input.
 * @returns {string} Escaped search value.
 */
const escapeRegex = (value) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * @name serializeEvidence
 * @description Converts an evidence document into a safe response.
 *
 * Internal storage keys and other private storage metadata are
 * deliberately excluded from the response.
 *
 * @param {Object} evidence - Evidence document or plain object.
 * @returns {Object} Serialized evidence.
 */
const serializeEvidence = (evidence) => {
    const verification = evidence.verification || {};
    const file = evidence.file || null;

    return {
        id: evidence._id.toString(),
        org: evidence.org.toString(),
        user: evidence.user.toString(),
        trainerProfile: evidence.trainerProfile.toString(),

        type: evidence.type,

        competencies: (evidence.competencies || []).map(
            (id) => id.toString()
        ),

        skills: (evidence.skills || []).map(
            (id) => id.toString()
        ),

        title: evidence.title,
        description: evidence.description,
        details: evidence.details || {},

        file: file
            ? {
                originalName: file.originalName,
                storageProvider: file.storageProvider,
                mimeType: file.mimeType,
                size: file.size,
                uploadedAt: file.uploadedAt
            }
            : null,

        verification: {
            status: verification.status,
            verifiedBy: verification.verifiedBy
                ? verification.verifiedBy.toString()
                : null,
            verifiedAt: verification.verifiedAt,
            rejectionReason: verification.rejectionReason
        },

        isDeleted: evidence.isDeleted,
        deletedAt: evidence.deletedAt,
        supersededBy: evidence.supersededBy
            ? evidence.supersededBy.toString()
            : null,
        supersededAt: evidence.supersededAt,

        createdAt: evidence.createdAt,
        updatedAt: evidence.updatedAt
    };
};

/**
 * @name executeEvidenceTransaction
 * @description Executes an evidence lifecycle operation and its
 * derived summary recomputation within one MongoDB transaction.
 *
 * @param {Function} operation - Transaction operation.
 * @returns {Promise<*>} Transaction operation result.
 */
const executeEvidenceTransaction = async (operation) => {
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
 * @name getApprovedTrainerProfile
 * @description Ensures the user has an approved trainer membership
 * and an approved trainer profile in the organization.
 *
 * @param {Object} params - Trainer lookup parameters.
 * @param {string} params.orgId - Organization ID.
 * @param {string} params.userId - User ID.
 * @param {Object} params.session - MongoDB transaction session.
 * @returns {Promise<Object>} Approved trainer profile.
 */
const getApprovedTrainerProfile = async ({
    orgId,
    userId,
    session
}) => {
    const membership = await OrganizationMembership.findOne({
        org: orgId,
        user: userId,
        role: "trainer",
        status: "approved"
    })
        .session(session)
        .lean();

    if (!membership) {
        throw createEvidenceError(
            "An approved trainer membership is required.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.RESOURCE_ACCESS_DENIED
        );
    }

    const trainerProfile = await TrainerProfile.findOne({
        org: orgId,
        user: userId,
        "approval.status": "approved"
    })
        .session(session)
        .lean();

    if (!trainerProfile) {
        throw createEvidenceError(
            "An approved trainer profile is required.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.RESOURCE_ACCESS_DENIED
        );
    }

    return trainerProfile;
};



/**
 * @name validateEvidenceReferences
 * @description Validates competency and skill references against
 * the organization's active records.
 *
 * @param {Object} params - Reference validation parameters.
 * @param {string} params.orgId - Organization ID.
 * @param {string[]} params.competencyIds - Competency IDs.
 * @param {string[]} params.skillIds - Skill IDs.
 * @param {Object} params.session - MongoDB transaction session.
 * @returns {Promise<Object>} Validated reference IDs.
 */
const validateEvidenceReferences = async ({
    orgId,
    competencyIds = [],
    skillIds = [],
    session
}) => {
    const [competencies, skills] = await Promise.all([
        assertOrganizationReferences({
            model: Competency,
            ids: competencyIds,
            organizationId: orgId,
            resourceName: "Competency",
            session
        }),

        assertOrganizationReferences({
            model: Skill,
            ids: skillIds,
            organizationId: orgId,
            resourceName: "Skill",
            session
        })
    ]);

    const [activeCompetencyCount, activeSkillCount] =
        await Promise.all([
            competencies.length
                ? Competency.countDocuments({
                    _id: { $in: competencies },
                    org: orgId,
                    status: "active"
                }).session(session)
                : 0,

            skills.length
                ? Skill.countDocuments({
                    _id: { $in: skills },
                    org: orgId,
                    status: "active"
                }).session(session)
                : 0
        ]);

    if (activeCompetencyCount !== competencies.length) {
        throw createEvidenceError(
            "One or more competencies are archived or unavailable.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    if (activeSkillCount !== skills.length) {
        throw createEvidenceError(
            "One or more skills are archived or unavailable.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    return {
        competencies,
        skills
    };
};



/**
 * @name createEvidence
 * @description Submits competency evidence for an approved trainer
 * and recomputes the trainer's competency summary atomically.
 *
 * @param {Object} params - Evidence submission parameters.
 * @param {string} params.orgId - Organization ID.
 * @param {string} params.userId - Authenticated trainer ID.
 * @param {Object} params.data - Validated evidence data.
 * @returns {Promise<Object>} Created evidence.
 */
export const createEvidence = async ({
    orgId,
    userId,
    data
}) => {
    return executeEvidenceTransaction(async (session) => {
        // Step 1: Verify trainer membership and profile approval
        // using the transaction session.
        const trainerProfile = await getApprovedTrainerProfile({
            orgId,
            userId,
            session
        });

        // Step 2: Validate that all referenced competencies and
        // skills belong to this organization and are active.
        const references = await validateEvidenceReferences({
            orgId,
            competencyIds: data.competencies,
            skillIds: data.skills,
            session
        });

        // Step 3: Create the evidence record.
        const [evidence] = await CompetencyEvidence.create(
            [{
                org: orgId,
                user: userId,
                trainerProfile: trainerProfile._id,

                type: data.type,

                competencies: references.competencies,
                skills: references.skills,

                title: data.title,
                description: data.description,
                details: data.details,

                verification: {
                    status: "self_reported",
                    verifiedBy: null,
                    verifiedAt: null,
                    rejectionReason: null
                },

                isDeleted: false
            }],
            { session }
        );

        // Step 4: Recompute and persist the trainer's derived
        // competency and skill summaries in the same transaction.
        await recomputeTrainerEvidenceSummary({
            orgId,
            trainerProfileId: trainerProfile._id,
            session
        });

        return serializeEvidence(evidence);
    });
};


/**
 * @name listMyEvidence
 * @description Retrieves evidence submitted by the authenticated
 * trainer with pagination and optional filters.
 *
 * @param {Object} params - List parameters.
 * @param {string} params.orgId - Organization ID.
 * @param {string} params.userId - Trainer user ID.
 * @param {number} params.page - Page number.
 * @param {number} params.limit - Records per page.
 * @param {string} [params.type] - Evidence type filter.
 * @param {string} [params.verificationStatus="all"] - Review filter.
 * @param {string} [params.search] - Search term.
 * @returns {Promise<Object>} Evidence and pagination information.
 */
export const listMyEvidence = async ({
    orgId,
    userId,
    page,
    limit,
    type,
    verificationStatus = "all",
    search
}) => {
    const filter = {
        org: orgId,
        user: userId,
        isDeleted: false,
        supersededBy: null
    };

    if (type) {
        filter.type = type;
    }

    if (verificationStatus !== "all") {
        filter["verification.status"] = verificationStatus;
    }

    if (search) {
        const searchRegex = new RegExp(
            escapeRegex(search),
            "i"
        );

        filter.$or = [
            { title: searchRegex },
            { description: searchRegex }
        ];
    }

    const skip = (page - 1) * limit;

    const [evidenceRecords, total] = await Promise.all([
        CompetencyEvidence.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),

        CompetencyEvidence.countDocuments(filter)
    ]);

    return {
        items: evidenceRecords.map(serializeEvidence),

        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

/**
 * @name getMyEvidenceById
 * @description Retrieves an evidence record belonging to
 * the authenticated trainer.
 *
 * @param {Object} params - Retrieval parameters.
 * @param {string} params.evidenceId - Evidence ID.
 * @param {string} params.orgId - Organization ID.
 * @param {string} params.userId - Trainer user ID.
 * @returns {Promise<Object>} Retrieved evidence.
 */
export const getMyEvidenceById = async ({
    evidenceId,
    orgId,
    userId
}) => {
    const evidence = await CompetencyEvidence.findOne({
        _id: evidenceId,
        org: orgId,
        user: userId,
        isDeleted: false
    }).lean();

    if (!evidence) {
        throw createEvidenceError(
            "Evidence not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    return serializeEvidence(evidence);
};

/**
 * @name deleteMyEvidence
 * @description Soft-deletes an evidence record and recomputes the
 * trainer's competency summary atomically.
 *
 * Verified evidence cannot be deleted.
 *
 * @param {Object} params - Deletion parameters.
 * @param {string} params.evidenceId - Evidence ID.
 * @param {string} params.orgId - Organization ID.
 * @param {string} params.userId - Trainer user ID.
 * @returns {Promise<Object>} Soft-deleted evidence.
 */
export const deleteMyEvidence = async ({
    evidenceId,
    orgId,
    userId
}) => {
    return executeEvidenceTransaction(async (session) => {
        const evidence = await CompetencyEvidence.findOne({
            _id: evidenceId,
            org: orgId,
            user: userId,
            isDeleted: false,
            supersededBy: null
        }).session(session);

        if (!evidence) {
            throw createEvidenceError(
                "Evidence not found.",
                HTTP_STATUS.NOT_FOUND,
                ERROR_CODES.RESOURCE_NOT_FOUND
            );
        }

        if (evidence.verification.status === "verified") {
            throw createEvidenceError(
                "Verified evidence cannot be deleted.",
                HTTP_STATUS.CONFLICT,
                ERROR_CODES.RESOURCE_CONFLICT
            );
        }

        evidence.isDeleted = true;
        evidence.deletedAt = new Date();
        evidence.deletedBy = userId;

        await evidence.save({ session });

        await recomputeTrainerEvidenceSummary({
            orgId,
            trainerProfileId: evidence.trainerProfile,
            session
        });

        return serializeEvidence(evidence);
    });
};