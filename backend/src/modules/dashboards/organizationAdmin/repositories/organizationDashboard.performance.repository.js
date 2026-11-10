import mongoose from "mongoose";

import AssessmentAttempt from "../../../assessments/assessmentAttempt.model.js";
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
 * Retrieves assessment performance grouped by course and assessment version.
 *
 * Only evaluated attempts are included because submitted attempts
 * may not yet have a final score.
 *
 * Pass/fail classification uses the passing percentage stored in
 * each attempt's assessment snapshot, preserving the threshold
 * that applied when the trainee started the attempt.
 *
 * @param {Object} options - Reporting options.
 * @param {string|mongoose.Types.ObjectId} options.orgId - Organisation ID.
 * @param {Date} options.startDate - Inclusive attempt creation date.
 * @param {Date} options.endDate - Exclusive attempt creation date.
 * @returns {Promise<Array<Object>>} Assessment performance summaries.
 */
export const getAssessmentPerformanceSummary = async ({
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

    return AssessmentAttempt.aggregate([
        {
            $match: {
                org: organizationId,
                status: "evaluated",
                createdAt: {
                    $gte: startDate,
                    $lt: endDate
                },
                totalMarks: {
                    $gt: 0
                },
                score: {
                    $ne: null
                }
            }
        },
        {
            $addFields: {
                scorePercentage: {
                    $multiply: [
                        {
                            $divide: [
                                "$score",
                                "$totalMarks"
                            ]
                        },
                        100
                    ]
                }
            }
        },
        {
            $group: {
                _id: {
                    course: "$course",
                    assessment: "$assessment",
                    version: "$assessmentVersion"
                },
                assessmentTitle: {
                    $first: "$assessmentSnapshot.title"
                },
                passingPercentage: {
                    $first: "$assessmentSnapshot.passingPercentage"
                },
                totalEvaluatedAttempts: {
                    $sum: 1
                },
                averageScorePercentage: {
                    $avg: "$scorePercentage"
                },
                passedAttempts: {
                    $sum: {
                        $cond: [
                            {
                                $gte: [
                                    "$scorePercentage",
                                    "$assessmentSnapshot.passingPercentage"
                                ]
                            },
                            1,
                            0
                        ]
                    }
                },
                failedAttempts: {
                    $sum: {
                        $cond: [
                            {
                                $lt: [
                                    "$scorePercentage",
                                    "$assessmentSnapshot.passingPercentage"
                                ]
                            },
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
                    courseId: "$_id.course",
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
                            title: 1
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
                courseId: "$_id.course",
                courseTitle: "$course.title",
                assessmentId: "$_id.assessment",
                assessmentVersion: "$_id.version",
                assessmentTitle: 1,
                passingPercentage: 1,
                totalEvaluatedAttempts: 1,
                averageScorePercentage: {
                    $round: [
                        "$averageScorePercentage",
                        2
                    ]
                },
                passedAttempts: 1,
                failedAttempts: 1,
                passRate: {
                    $round: [
                        {
                            $multiply: [
                                {
                                    $divide: [
                                        "$passedAttempts",
                                        "$totalEvaluatedAttempts"
                                    ]
                                },
                                100
                            ]
                        },
                        2
                    ]
                }
            }
        },
        {
            $sort: {
                courseTitle: 1,
                assessmentTitle: 1,
                assessmentVersion: -1
            }
        }
    ]);
};