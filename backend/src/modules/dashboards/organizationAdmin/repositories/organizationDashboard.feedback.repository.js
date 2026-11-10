import mongoose from "mongoose";

import Feedback from "../../../feedback/feedback.model.js";


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
 * Retrieves feedback counts grouped by visibility status.
 *
 * @param {Object} options - Reporting options.
 * @param {string|mongoose.Types.ObjectId} options.orgId - Organisation ID.
 * @returns {Promise<Array<Object>>} Feedback status counts.
 */
export const getFeedbackStatusCounts = async ({
    orgId
}) => {
    const organizationId = toOrganizationObjectId(orgId);

    return Feedback.aggregate([
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
 * Retrieves feedback rating distribution for an organisation.
 *
 * @param {Object} options - Reporting options.
 * @param {string|mongoose.Types.ObjectId} options.orgId - Organisation ID.
 * @returns {Promise<Array<Object>>} Feedback rating counts.
 */
export const getFeedbackRatingDistribution = async ({
    orgId
}) => {
    const organizationId = toOrganizationObjectId(orgId);

    return Feedback.aggregate([
        {
            $match: {
                org: organizationId,
                status: "submitted"
            }
        },
        {
            $group: {
                _id: "$rating",
                count: {
                    $sum: 1
                }
            }
        },
        {
            $project: {
                _id: 0,
                rating: "$_id",
                count: 1
            }
        },
        {
            $sort: {
                rating: 1
            }
        }
    ]);
};


/**
 * Retrieves the average submitted feedback rating.
 *
 * @param {Object} options - Reporting options.
 * @param {string|mongoose.Types.ObjectId} options.orgId - Organisation ID.
 * @returns {Promise<Object|null>} Average rating and total ratings.
 */
export const getFeedbackRatingSummary = async ({
    orgId
}) => {
    const organizationId = toOrganizationObjectId(orgId);

    const [summary] = await Feedback.aggregate([
        {
            $match: {
                org: organizationId,
                status: "submitted"
            }
        },
        {
            $group: {
                _id: null,
                averageRating: {
                    $avg: "$rating"
                },
                totalRatings: {
                    $sum: 1
                }
            }
        },
        {
            $project: {
                _id: 0,
                averageRating: {
                    $round: ["$averageRating", 2]
                },
                totalRatings: 1
            }
        }
    ]);

    return summary ?? {
        averageRating: 0,
        totalRatings: 0
    };
};


/**
 * Retrieves monthly feedback submission counts.
 *
 * @param {Object} options - Reporting options.
 * @param {string|mongoose.Types.ObjectId} options.orgId - Organisation ID.
 * @param {Date} options.startDate - Inclusive submission date.
 * @param {Date} options.endDate - Exclusive submission date.
 * @returns {Promise<Array<Object>>} Monthly feedback counts.
 */
export const getFeedbackSubmissionTrends = async ({
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

    return Feedback.aggregate([
        {
            $match: {
                org: organizationId,
                status: "submitted",
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