import mongoose from "mongoose";

import Announcement from "../../../announcements/announcement.model.js";


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
 * Retrieves announcement counts grouped by lifecycle status.
 *
 * @param {Object} options - Reporting options.
 * @param {string|mongoose.Types.ObjectId} options.orgId - Organisation ID.
 * @returns {Promise<Array<Object>>} Announcement status counts.
 */
export const getAnnouncementStatusCounts = async ({
    orgId
}) => {
    const organizationId = toOrganizationObjectId(orgId);

    return Announcement.aggregate([
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
 * Retrieves announcement counts grouped by audience.
 *
 * @param {Object} options - Reporting options.
 * @param {string|mongoose.Types.ObjectId} options.orgId - Organisation ID.
 * @returns {Promise<Array<Object>>} Announcement audience counts.
 */
export const getAnnouncementAudienceCounts = async ({
    orgId
}) => {
    const organizationId = toOrganizationObjectId(orgId);

    return Announcement.aggregate([
        {
            $match: {
                org: organizationId,
                status: "published"
            }
        },
        {
            $group: {
                _id: "$audience",
                count: {
                    $sum: 1
                }
            }
        },
        {
            $project: {
                _id: 0,
                audience: "$_id",
                count: 1
            }
        },
        {
            $sort: {
                audience: 1
            }
        }
    ]);
};


/**
 * Retrieves monthly announcement publication trends.
 *
 * @param {Object} options - Reporting options.
 * @param {string|mongoose.Types.ObjectId} options.orgId - Organisation ID.
 * @param {Date} options.startDate - Inclusive publication date.
 * @param {Date} options.endDate - Exclusive publication date.
 * @returns {Promise<Array<Object>>} Monthly publication counts.
 */
export const getAnnouncementPublicationTrends = async ({
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

    return Announcement.aggregate([
        {
            $match: {
                org: organizationId,
                status: "published",
                publishedAt: {
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
                        date: "$publishedAt",
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