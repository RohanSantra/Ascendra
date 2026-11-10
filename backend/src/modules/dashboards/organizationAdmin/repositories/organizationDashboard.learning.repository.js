import mongoose from "mongoose";

import LearningProgress from "../../../learningProgress/learningProgress.model.js";
import Course from "../../../courses/course.model.js";


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
 * Retrieves learning progress grouped by course.
 *
 * Each progress record represents one trainee's progress
 * against one course material.
 *
 * @param {Object} options - Reporting options.
 * @param {string|mongoose.Types.ObjectId} options.orgId - Organisation ID.
 * @returns {Promise<Array<Object>>} Course-level progress summaries.
 */
export const getLearningProgressPerformance = async ({
    orgId
}) => {
    const organizationId = toOrganizationObjectId(orgId);

    return LearningProgress.aggregate([
        {
            $match: {
                org: organizationId
            }
        },
        {
            $group: {
                _id: "$course",

                totalProgressRecords: {
                    $sum: 1
                },

                notStarted: {
                    $sum: {
                        $cond: [
                            { $eq: ["$status", "not_started"] },
                            1,
                            0
                        ]
                    }
                },

                inProgress: {
                    $sum: {
                        $cond: [
                            { $eq: ["$status", "in_progress"] },
                            1,
                            0
                        ]
                    }
                },

                completed: {
                    $sum: {
                        $cond: [
                            { $eq: ["$status", "completed"] },
                            1,
                            0
                        ]
                    }
                },

                uniqueTrainees: {
                    $addToSet: "$trainee"
                }
            }
        },
        {
            $lookup: {
                from: Course.collection.name,
                let: {
                    courseId: "$_id",
                    organizationId
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    {
                                        $eq: [
                                            "$_id",
                                            "$$courseId"
                                        ]
                                    },
                                    {
                                        $eq: [
                                            "$org",
                                            "$$organizationId"
                                        ]
                                    }
                                ]
                            }
                        }
                    },
                    {
                        $project: {
                            title: 1,
                            status: 1
                        }
                    }
                ],
                as: "course"
            }
        },
        {
            $unwind: "$course"
        },
        {
            $project: {
                _id: 0,
                courseId: "$_id",
                courseTitle: "$course.title",
                courseStatus: "$course.status",
                totalProgressRecords: 1,
                uniqueTraineeCount: {
                    $size: "$uniqueTrainees"
                },
                notStarted: 1,
                inProgress: 1,
                completed: 1,
                completionRate: {
                    $cond: [
                        { $gt: ["$totalProgressRecords", 0] },
                        {
                            $round: [
                                {
                                    $multiply: [
                                        {
                                            $divide: [
                                                "$completed",
                                                "$totalProgressRecords"
                                            ]
                                        },
                                        100
                                    ]
                                },
                                2
                            ]
                        },
                        0
                    ]
                }
            }
        },
        {
            $sort: {
                courseTitle: 1
            }
        }
    ]);
};


/**
 * Retrieves monthly learning activity based on last access dates.
 *
 * Records without a lastAccessedAt value are excluded because
 * they do not represent a recorded learning access event.
 *
 * @param {Object} options - Reporting options.
 * @param {string|mongoose.Types.ObjectId} options.orgId - Organisation ID.
 * @param {Date} options.startDate - Inclusive activity date.
 * @param {Date} options.endDate - Exclusive activity date.
 * @returns {Promise<Array<Object>>} Monthly learning activity counts.
 */
export const getLearningActivityTrends = async ({
    orgId,
    startDate,
    endDate
}) => {
    const organizationId = toOrganizationObjectId(orgId);

    validateDateRange(startDate, endDate);

    return LearningProgress.aggregate([
        {
            $match: {
                org: organizationId,
                lastAccessedAt: {
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
                        date: "$lastAccessedAt",
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