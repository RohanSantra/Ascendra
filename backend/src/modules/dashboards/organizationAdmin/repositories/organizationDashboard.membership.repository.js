import mongoose from "mongoose";

import OrganizationMembership from "../../../organizationMemberships/organizationMembership.model.js";
import TrainerProfile from "../../../trainerProfiles/trainerProfile.model.js";


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
 * Retrieves membership counts grouped by role and status.
 *
 * @param {Object} options - Reporting options.
 * @param {string|mongoose.Types.ObjectId} options.orgId - Organisation ID.
 * @returns {Promise<Array<Object>>} Membership distribution.
 */
export const getMembershipDistribution = async ({
    orgId
}) => {
    const organizationId = toOrganizationObjectId(orgId);

    return OrganizationMembership.aggregate([
        {
            $match: {
                org: organizationId
            }
        },
        {
            $group: {
                _id: {
                    role: "$role",
                    status: "$status"
                },
                count: {
                    $sum: 1
                }
            }
        },
        {
            $project: {
                _id: 0,
                role: "$_id.role",
                status: "$_id.status",
                count: 1
            }
        },
        {
            $sort: {
                role: 1,
                status: 1
            }
        }
    ]);
};


/**
 * Retrieves monthly membership registration trends.
 *
 * Membership creation dates represent when membership records
 * were created, not necessarily when invitations were accepted.
 *
 * @param {Object} options - Reporting options.
 * @param {string|mongoose.Types.ObjectId} options.orgId - Organisation ID.
 * @param {Date} options.startDate - Inclusive creation date.
 * @param {Date} options.endDate - Exclusive creation date.
 * @returns {Promise<Array<Object>>} Monthly membership counts.
 */
export const getMembershipRegistrationTrends = async ({
    orgId,
    startDate,
    endDate
}) => {
    const organizationId = toOrganizationObjectId(orgId);

    validateDateRange(startDate, endDate);

    return OrganizationMembership.aggregate([
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
                    month: {
                        $dateToString: {
                            format: "%Y-%m",
                            date: "$createdAt",
                            timezone: "UTC"
                        }
                    },
                    role: "$role"
                },
                count: {
                    $sum: 1
                }
            }
        },
        {
            $project: {
                _id: 0,
                period: "$_id.month",
                role: "$_id.role",
                count: 1
            }
        },
        {
            $sort: {
                period: 1,
                role: 1
            }
        }
    ]);
};


/**
 * Retrieves trainer profile approval counts.
 *
 * @param {Object} options - Reporting options.
 * @param {string|mongoose.Types.ObjectId} options.orgId - Organisation ID.
 * @returns {Promise<Array<Object>>} Trainer approval distribution.
 */
export const getTrainerProfileApprovalDistribution = async ({
    orgId
}) => {
    const organizationId = toOrganizationObjectId(orgId);

    return TrainerProfile.aggregate([
        {
            $match: {
                org: organizationId
            }
        },
        {
            $group: {
                _id: "$approvalStatus",
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