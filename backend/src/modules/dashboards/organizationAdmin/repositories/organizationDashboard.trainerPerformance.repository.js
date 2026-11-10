import mongoose from "mongoose";

import TrainerAssignment from "../../../trainerAssignments/trainerAssignment.model.js";
import Course from "../../../courses/course.model.js";
import Enrollment from "../../../enrollments/enrollment.model.js";


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
 * Retrieves assignment statistics grouped by trainer.
 *
 * Assignments are selected using their assignedAt date.
 *
 * @param {Object} options - Reporting options.
 * @param {string|mongoose.Types.ObjectId} options.orgId - Organisation ID.
 * @param {Date} options.startDate - Inclusive assignment date.
 * @param {Date} options.endDate - Exclusive assignment date.
 * @returns {Promise<Array<Object>>} Trainer assignment statistics.
 */
export const getTrainerAssignmentPerformance = async ({
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
                _id: "$trainer",

                totalAssignments: {
                    $sum: 1
                },

                assigned: {
                    $sum: {
                        $cond: [
                            { $eq: ["$status", "assigned"] },
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
            $project: {
                _id: 0,
                trainerId: "$_id",
                totalAssignments: 1,
                assigned: 1,
                inProgress: 1,
                completed: 1,
                cancelled: 1
            }
        },
        {
            $sort: {
                totalAssignments: -1
            }
        }
    ]);
};


/**
 * Retrieves course and enrolment statistics grouped by trainer.
 *
 * Courses are selected using their creation date. Enrolments
 * are restricted to the same organisation and selected courses.
 *
 * @param {Object} options - Reporting options.
 * @param {string|mongoose.Types.ObjectId} options.orgId - Organisation ID.
 * @param {Date} options.startDate - Inclusive course creation date.
 * @param {Date} options.endDate - Exclusive course creation date.
 * @returns {Promise<Array<Object>>} Trainer course statistics.
 */
export const getTrainerCoursePerformance = async ({
    orgId,
    startDate,
    endDate
}) => {
    const organizationId = toOrganizationObjectId(orgId);

    validateDateRange(startDate, endDate);

    return Course.aggregate([
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
            $lookup: {
                from: Enrollment.collection.name,
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
                                            "$course",
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
                        $group: {
                            _id: null,

                            totalEnrollments: {
                                $sum: 1
                            },

                            completedEnrollments: {
                                $sum: {
                                    $cond: [
                                        {
                                            $eq: [
                                                "$status",
                                                "completed"
                                            ]
                                        },
                                        1,
                                        0
                                    ]
                                }
                            }
                        }
                    }
                ],
                as: "enrollmentSummary"
            }
        },
        {
            $addFields: {
                enrollmentSummary: {
                    $ifNull: [
                        {
                            $arrayElemAt: [
                                "$enrollmentSummary",
                                0
                            ]
                        },
                        {
                            totalEnrollments: 0,
                            completedEnrollments: 0
                        }
                    ]
                }
            }
        },
        {
            $group: {
                _id: "$trainer",

                totalCourses: {
                    $sum: 1
                },

                totalEnrollments: {
                    $sum: "$enrollmentSummary.totalEnrollments"
                },

                completedEnrollments: {
                    $sum: "$enrollmentSummary.completedEnrollments"
                }
            }
        },
        {
            $project: {
                _id: 0,
                trainerId: "$_id",
                totalCourses: 1,
                totalEnrollments: 1,
                completedEnrollments: 1
            }
        },
        {
            $sort: {
                totalCourses: -1
            }
        }
    ]);
};