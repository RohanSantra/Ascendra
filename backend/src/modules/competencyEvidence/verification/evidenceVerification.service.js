
import mongoose from "mongoose";

import {
    recomputeTrainerEvidenceSummary
} from "../domain/evidenceRecomputation.service.js";

import CompetencyEvidence from "../submissions/competencyEvidence.model.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../../core/constants/index.js";

import AppError from "../../../core/errors/AppError.js";

/**
 * @name createVerificationError
 * @description Creates a standardized application error.
 *
 * @param {string} message - Error message.
 * @param {number} statusCode - HTTP status code.
 * @param {string} code - Application error code.
 * @returns {AppError} Application error instance.
 */
const createVerificationError = (
    message,
    statusCode,
    code
) => {
    return new AppError(message, statusCode, code);
};

/**
 * @name executeVerificationTransaction
 * @description Executes an evidence verification operation and its
 * trainer summary recomputation within one MongoDB transaction.
 *
 * @param {Function} operation - Transaction operation.
 * @returns {Promise<*>} Transaction operation result.
 */
const executeVerificationTransaction = async (operation) => {
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
 * @name getReferenceId
 * @description Extracts an ID from a populated document or ObjectId.
 *
 * @param {Object|string} value - Reference value.
 * @returns {string|null} Reference ID.
 */
const getReferenceId = (value) => {
    if (!value) {
        return null;
    }

    return value._id
        ? value._id.toString()
        : value.toString();
};

/**
 * @name serializeReference
 * @description Serializes a populated reference or ObjectId.
 *
 * @param {Object|string} reference - Reference value.
 * @param {string[]} fields - Allowed populated fields.
 * @returns {Object|string|null} Safe reference representation.
 */
const serializeReference = (reference, fields = []) => {
    if (!reference) {
        return null;
    }

    if (!reference._id) {
        return reference.toString();
    }

    const result = {
        id: reference._id.toString()
    };

    for (const field of fields) {
        if (reference[field] !== undefined) {
            result[field] = reference[field];
        }
    }

    return result;
};

/**
 * @name serializeEvidenceForReview
 * @description Converts evidence into a safe administrator response.
 *
 * Internal storage keys and private file metadata are excluded.
 *
 * @param {Object} evidence - Evidence document.
 * @returns {Object} Serialized evidence.
 */
const serializeEvidenceForReview = (evidence) => {
    const verification = evidence.verification || {};
    const file = evidence.file || null;

    return {
        id: getReferenceId(evidence._id),

        user: serializeReference(
            evidence.user,
            ["firstName", "lastName", "email"]
        ),

        trainerProfile: getReferenceId(evidence.trainerProfile),

        type: evidence.type,

        title: evidence.title,
        description: evidence.description,

        competencies: (evidence.competencies || []).map(
            (competency) => serializeReference(
                competency,
                ["name", "slug", "category"]
            )
        ),

        skills: (evidence.skills || []).map(
            (skill) => serializeReference(
                skill,
                ["name", "slug", "category"]
            )
        ),

        details: evidence.details || {},

        file: file
            ? {
                originalName: file.originalName,
                mimeType: file.mimeType,
                size: file.size,
                uploadedAt: file.uploadedAt
            }
            : null,


        verification: {
            status: verification.status,

            verifiedBy: getReferenceId(
                verification.verifiedBy
            ),

            verifiedAt: verification.verifiedAt,

            rejectedBy: getReferenceId(
                verification.rejectedBy
            ),

            rejectedAt: verification.rejectedAt,

            rejectionReason: verification.rejectionReason
        },


        createdAt: evidence.createdAt,
        updatedAt: evidence.updatedAt
    };
};

/**
 * @name populateEvidenceForReview
 * @description Populates safe trainer, competency and skill information.
 *
 * @param {Object} query - Mongoose query.
 * @returns {Object} Populated Mongoose query.
 */
const populateEvidenceForReview = (query) => {
    return query
        .populate({
            path: "user",
            select: "firstName lastName email"
        })
        .populate({
            path: "competencies",
            select: "name slug category"
        })
        .populate({
            path: "skills",
            select: "name slug category"
        });
};

/**
 * @name assertPendingEvidenceExists
 * @description Checks that evidence exists and is eligible for review.
 *
 * @param {Object} params - Lookup parameters.
 * @param {string} params.evidenceId - Evidence ID.
 * @param {string} params.orgId - Organization ID.
 * @param {Object} params.session - MongoDB session.
 * @returns {Promise<Object>} Pending evidence document.
 */
const assertPendingEvidenceExists = async ({
    evidenceId,
    orgId,
    session
}) => {
    const evidence = await CompetencyEvidence.findOne({
        _id: evidenceId,
        org: orgId,
        isDeleted: false,
        supersededBy: null
    })
        .session(session)
        .lean();

    if (!evidence) {
        throw createVerificationError(
            "Evidence not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    if (evidence.verification.status !== "self_reported") {
        throw createVerificationError(
            "This evidence has already been reviewed.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    return evidence;
};

/**
 * @name listPendingEvidence
 * @description Retrieves pending evidence belonging to the
 * administrator's organization.
 *
 * @param {Object} params - List parameters.
 * @param {string} params.orgId - Organization ID.
 * @param {number} params.page - Page number.
 * @param {number} params.limit - Records per page.
 * @param {string} [params.type] - Evidence type filter.
 * @param {string} [params.search] - Search term.
 * @returns {Promise<Object>} Pending evidence and pagination.
 */
export const listPendingEvidence = async ({
    orgId,
    page,
    limit,
    type,
    search
}) => {
    const filter = {
        org: orgId,
        isDeleted: false,
        supersededBy: null,
        "verification.status": "self_reported"
    };

    if (type) {
        filter.type = type;
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
        populateEvidenceForReview(
            CompetencyEvidence.find(filter)
                .sort({ createdAt: 1, _id: 1 })
                .skip(skip)
                .limit(limit)
        ).lean(),

        CompetencyEvidence.countDocuments(filter)
    ]);

    return {
        items: evidenceRecords.map(
            serializeEvidenceForReview
        ),

        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

/**
 * @name getPendingEvidenceById
 * @description Retrieves pending evidence details for administrator review.
 *
 * @param {Object} params - Retrieval parameters.
 * @param {string} params.evidenceId - Evidence ID.
 * @param {string} params.orgId - Organization ID.
 * @returns {Promise<Object>} Evidence details.
 */
export const getPendingEvidenceById = async ({
    evidenceId,
    orgId
}) => {
    await assertPendingEvidenceExists({
        evidenceId,
        orgId
    });

    const evidence = await populateEvidenceForReview(
        CompetencyEvidence.findOne({
            _id: evidenceId,
            org: orgId,
            isDeleted: false,
            supersededBy: null,
            "verification.status": "self_reported"
        })
    ).lean();

    if (!evidence) {
        throw createVerificationError(
            "Evidence is no longer pending review.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    return serializeEvidenceForReview(evidence);
};

/**
 * @name approveEvidence
 * @description Verifies pending evidence and recomputes the trainer's
 * competency summary within the same MongoDB transaction.
 *
 * Conditional updates prevent duplicate or concurrent reviews.
 *
 * @param {Object} params - Approval parameters.
 * @param {string} params.evidenceId - Evidence ID.
 * @param {string} params.orgId - Organization ID.
 * @param {string} params.adminId - Administrator user ID.
 * @returns {Promise<Object>} Verified evidence.
 */
export const approveEvidence = async ({
    evidenceId,
    orgId,
    adminId
}) => {
    return executeVerificationTransaction(async (session) => {
        await assertPendingEvidenceExists({
            evidenceId,
            orgId,
            session
        });

        const evidence = await populateEvidenceForReview(
            CompetencyEvidence.findOneAndUpdate(
                {
                    _id: evidenceId,
                    org: orgId,
                    isDeleted: false,
                    supersededBy: null,
                    "verification.status": "self_reported"
                },
                {
                    $set: {
                        "verification.status": "verified",
                        "verification.verifiedBy": adminId,
                        "verification.verifiedAt": new Date(),
                        "verification.rejectionReason": null
                    }
                },
                {
                    returnDocument: "after",
                    runValidators: true
                }
            ).session(session)
        ).lean();

        if (!evidence) {
            throw createVerificationError(
                "Evidence has already been reviewed or is no longer available.",
                HTTP_STATUS.CONFLICT,
                ERROR_CODES.RESOURCE_CONFLICT
            );
        }

        await recomputeTrainerEvidenceSummary({
            orgId,
            trainerProfileId: evidence.trainerProfile,
            session
        });

        return serializeEvidenceForReview(evidence);
    });
};

/**
 * @name rejectEvidence
 * @description Rejects pending evidence and recomputes the trainer's
 * competency summary within the same MongoDB transaction.
 *
 * Conditional updates prevent duplicate or concurrent reviews.
 *
 * @param {Object} params - Rejection parameters.
 * @param {string} params.evidenceId - Evidence ID.
 * @param {string} params.orgId - Organization ID.
 * @param {string} params.adminId - Administrator user ID.
 * @param {string} params.reason - Rejection reason.
 * @returns {Promise<Object>} Rejected evidence.
 */
export const rejectEvidence = async ({
    evidenceId,
    orgId,
    adminId,
    reason
}) => {
    return executeVerificationTransaction(async (session) => {
        await assertPendingEvidenceExists({
            evidenceId,
            orgId,
            session
        });

        const evidence = await populateEvidenceForReview(
            CompetencyEvidence.findOneAndUpdate(
                {
                    _id: evidenceId,
                    org: orgId,
                    isDeleted: false,
                    supersededBy: null,
                    "verification.status": "self_reported"
                },
                {
                    $set: {
                        "verification.status": "rejected",

                        // Rejection audit information.
                        "verification.rejectedBy": adminId,
                        "verification.rejectedAt": new Date(),
                        "verification.rejectionReason": reason,

                        // A rejected record must not retain verification audit data.
                        "verification.verifiedBy": null,
                        "verification.verifiedAt": null
                    }
                },
                {
                    returnDocument: "after",
                    runValidators: true
                }
            ).session(session)
        ).lean();

        if (!evidence) {
            throw createVerificationError(
                "Evidence has already been reviewed or is no longer available.",
                HTTP_STATUS.CONFLICT,
                ERROR_CODES.RESOURCE_CONFLICT
            );
        }

        await recomputeTrainerEvidenceSummary({
            orgId,
            trainerProfileId: evidence.trainerProfile,
            session
        });

        return serializeEvidenceForReview(evidence);
    });
};
