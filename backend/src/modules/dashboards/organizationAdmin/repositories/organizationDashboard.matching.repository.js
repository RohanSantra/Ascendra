import mongoose from "mongoose";

import MatchRun from "../../../matchRun/matchRun.model.js";
import TrainerAssignment from "../../../trainerAssignments/trainerAssignment.model.js";


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
 * Validates a reporting date range.
 *
 * @param {Date} startDate - Inclusive start date.
 * @param {Date} endDate - Exclusive end date.
 * @throws {Error} If the date range is invalid.
 */
const validateDateRange = (startDate, endDate) => {
    if (
        !(startDate instanceof Date) ||
        Number.isNaN(startDate.getTime()) ||
        !(endDate instanceof Date) ||
        Number.isNaN(endDate.getTime()) ||
        startDate >= endDate
    ) {
        throw new Error("A valid reporting date range is required.");
    }
};


/**
 * Retrieves matching outcomes for an organisation.
 *
 * Matching runs are grouped by their recorded outcome.
 *
 * @param {Object} options - Reporting options.
 * @param {string|mongoose.Types.ObjectId} options.orgId - Organisation ID.
 * @param {Date} options.startDate - Inclusive matching date.
 * @param {Date} options.endDate - Exclusive matching date.
 * @returns {Promise<Array<Object>>} Matching outcome counts.
 */
export const getMatchingOutcomeReport = async ({
    orgId,
    startDate,
    endDate
}) => {
    const organizationId = toOrganizationObjectId(orgId);

    validateDateRange(startDate, endDate);

    return MatchRun.aggregate([
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
                _id: "$outcome",
                count: {
                    $sum: 1
                }
            }
        },
        {
            $project: {
                _id: 0,
                outcome: "$_id",
                count: 1
            }
        },
        {
            $sort: {
                outcome: 1
            }
        }
    ]);
};


/**
 * Retrieves trainer assignment lifecycle counts.
 *
 * @param {Object} options - Reporting options.
 * @param {string|mongoose.Types.ObjectId} options.orgId - Organisation ID.
 * @param {Date} options.startDate - Inclusive assignment date.
 * @param {Date} options.endDate - Exclusive assignment date.
 * @returns {Promise<Array<Object>>} Assignment status counts.
 */
export const getTrainerAssignmentReport = async ({
    orgId,
    startDate,
    endDate
}) => {
    const organizationId = toOrganizationObjectId(orgId);

    validateDateRange(startDate, endDate);

    return TrainerAssignment.aggregate([
        {
            $match: {
                org: organizationId,
                assignedAt: {
                    $gte: startDate,
                    $lt: endDate
                }
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