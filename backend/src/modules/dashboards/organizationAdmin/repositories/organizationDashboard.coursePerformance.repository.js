import mongoose from "mongoose";

import Enrollment from "../../../enrollments/enrollment.model.js";
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
 * Retrieves course performance using enrolment records.
 *
 * Withdrawn and cancelled enrolments are excluded from the
 * completion-rate denominator. Course information is also
 * restricted to the same organisation.
 *
 * @param {Object} options - Reporting options.
 * @param {string|mongoose.Types.ObjectId} options.orgId - Organisation ID.
 * @param {Date} options.startDate - Inclusive enrolment creation date.
 * @param {Date} options.endDate - Exclusive enrolment creation date.
 * @returns {Promise<Array<Object>>} Course performance summaries.
 */
export const getCoursePerformanceSummary = async ({
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

    return Enrollment.aggregate([
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
                _id: "$course",

                totalEnrollments: {
                    $sum: 1
                },

                enrolled: {
                    $sum: {
                        $cond: [
                            { $eq: ["$status", "enrolled"] },
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

                withdrawn: {
                    $sum: {
                        $cond: [
                            { $eq: ["$status", "withdrawn"] },
                            1,
                            0
                        ]
                    }
                },

                cancelled: {
                    $sum: {
                        $cond: [
                            { $eq: ["$status", "cancelled"] },
                            1,
                            0
                        ]
                    }
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
                            trainer: 1,
                            status: 1,
                            startDate: 1,
                            endDate: 1
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
            $addFields: {
                eligibleEnrollments: {
                    $subtract: [
                        "$totalEnrollments",
                        {
                            $add: [
                                "$withdrawn",
                                "$cancelled"
                            ]
                        }
                    ]
                }
            }
        },
        {
            $project: {
                _id: 0,
                courseId: "$_id",
                courseTitle: "$course.title",
                trainerId: "$course.trainer",
                courseStatus: "$course.status",
                startDate: "$course.startDate",
                endDate: "$course.endDate",

                totalEnrollments: 1,
                enrolled: 1,
                inProgress: 1,
                completed: 1,
                withdrawn: 1,
                cancelled: 1,
                eligibleEnrollments: 1,

                completionRate: {
                    $cond: [
                        { $gt: ["$eligibleEnrollments", 0] },
                        {
                            $round: [
                                {
                                    $multiply: [
                                        {
                                            $divide: [
                                                "$completed",
                                                "$eligibleEnrollments"
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