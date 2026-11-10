import mongoose from "mongoose";

import CompetencyEvidence from "../../../competencyEvidence/submissions/competencyEvidence.model.js";


/**
 * Validates and converts an organisation ID.
 *
 * @param {string|mongoose.Types.ObjectId} orgId - Organisation ID.
 * @returns {mongoose.Types.ObjectId} Validated organisation ID.
 */
const toOrganizationObjectId = (orgId) => {
    if (!mongoose.isValidObjectId(orgId)) {
        throw new Error("A valid organisation ID is required.");
    }

    return new mongoose.Types.ObjectId(orgId);
};


/**
 * Retrieves evidence verification counts for an organisation.
 *
 * Deleted and superseded evidence records are excluded.
 *
 * @param {Object} options - Reporting options.
 * @param {string|mongoose.Types.ObjectId} options.orgId - Organisation ID.
 * @returns {Promise<Array<Object>>} Evidence verification counts.
 */
export const getEvidenceVerificationCounts = async ({
    orgId
}) => {
    const organizationId = toOrganizationObjectId(orgId);

    return CompetencyEvidence.aggregate([
        {
            $match: {
                org: organizationId,
                isDeleted: false,
                supersededBy: null
            }
        },
        {
            $group: {
                _id: "$verification.status",
                count: {
                    $sum: 1
                }
            }
        },
        {
            $project: {
                _id: 0,
                status: "$_id",
                count: 1
            }
        },
        {
            $sort: {
                status: 1
            }
        }
    ]);
};


/**
 * Retrieves monthly evidence submission counts.
 *
 * @param {Object} options - Reporting options.
 * @param {string|mongoose.Types.ObjectId} options.orgId - Organisation ID.
 * @param {Date} options.startDate - Inclusive submission date.
 * @param {Date} options.endDate - Exclusive submission date.
 * @returns {Promise<Array<Object>>} Monthly evidence counts.
 */
export const getEvidenceSubmissionTrends = async ({
    orgId,
    startDate,
    endDate
}) => {
    const organizationId = toOrganizationObjectId(orgId);

    if (
        !(startDate instanceof Date) ||
        Number.isNaN(startDate.getTime()) ||
        !(endDate instanceof Date) ||
        Number.isNaN(endDate.getTime()) ||
        startDate >= endDate
    ) {
        throw new Error("A valid reporting date range is required.");
    }

    return CompetencyEvidence.aggregate([
        {
            $match: {
                org: organizationId,
                isDeleted: false,
                supersededBy: null,
                createdAt: {
                    $gte: startDate,
                    $lt: endDate
                }
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: {
                        format: "%Y-%m",
                        date: "$createdAt",
                        timezone: "UTC"
                    }
                },
                count: {
                    $sum: 1
                }
            }
        },
        {
            $project: {
                _id: 0,
                period: "$_id",
                count: 1
            }
        },
        {
            $sort: {
                period: 1
            }
        }
    ]);
};