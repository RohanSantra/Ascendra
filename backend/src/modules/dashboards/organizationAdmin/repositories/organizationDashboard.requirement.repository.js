import mongoose from "mongoose";

import TrainingRequirement from "../../../trainingRequirements/trainingRequirement.model.js";


const REQUIREMENT_STATUSES = [
    "draft",
    "ready",
    "matched",
    "assigned",
    "cancelled",
    "archived"
];


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
 * Retrieves training requirement counts grouped by lifecycle status.
 *
 * @param {Object} options - Reporting options.
 * @param {string|mongoose.Types.ObjectId} options.orgId - Organisation ID.
 * @returns {Promise<Array<Object>>} Requirement status counts.
 */
export const getRequirementStatusCounts = async ({
    orgId
}) => {
    const organizationId = toOrganizationObjectId(orgId);

    return TrainingRequirement.aggregate([
        {
            $match: {
                org: organizationId
            }
        },
        {
            $group: {
                _id: "$status",
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
 * Retrieves monthly training requirement creation trends.
 *
 * @param {Object} options - Reporting options.
 * @param {string|mongoose.Types.ObjectId} options.orgId - Organisation ID.
 * @param {Date} options.startDate - Inclusive creation date.
 * @param {Date} options.endDate - Exclusive creation date.
 * @returns {Promise<Array<Object>>} Monthly requirement counts.
 */
export const getRequirementCreationTrends = async ({
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

    return TrainingRequirement.aggregate([
        {
            $match: {
                org: organizationId,
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


/**
 * Returns the supported training requirement lifecycle statuses.
 *
 * @returns {string[]} Supported requirement statuses.
 */
export const getRequirementReportingStatuses = () => {
    return [...REQUIREMENT_STATUSES];
};