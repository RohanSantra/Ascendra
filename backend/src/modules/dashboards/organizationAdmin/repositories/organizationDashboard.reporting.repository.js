import mongoose from "mongoose";

import OrganizationMembership from "../../../organizationMemberships/organizationMembership.model.js";
import TrainerProfile from "../../../trainerProfiles/trainerProfile.model.js";
import CompetencyEvidence from "../../../competencyEvidence/submissions/competencyEvidence.model.js";
import TrainingRequirement from "../../../trainingRequirements/trainingRequirement.model.js";
import MatchRun from "../../../matchRun/matchRun.model.js";
import TrainerAssignment from "../../../trainerAssignments/trainerAssignment.model.js";
import Course from "../../../courses/course.model.js";
import Enrollment from "../../../enrollments/enrollment.model.js";
import AssessmentAttempt from "../../../assessments/assessmentAttempt.model.js";
import LearningProgress from "../../../learningProgress/learningProgress.model.js";


/**
 * Converts an organisation ID into a MongoDB ObjectId.
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
 * Returns monthly aggregate activity counts for a model.
 *
 * The aggregation is always restricted to one organisation
 * and a supplied date range.
 *
 * @param {import("mongoose").Model} model - Mongoose model.
 * @param {Object} options - Aggregation options.
 * @param {mongoose.Types.ObjectId} options.orgId - Organisation ID.
 * @param {Date} options.startDate - Inclusive start date.
 * @param {Date} options.endDate - Exclusive end date.
 * @param {Object} options.additionalMatch - Additional filters.
 * @returns {Promise<Array<Object>>} Monthly activity counts.
 */
const getMonthlyActivityCounts = async (
    model,
    {
        orgId,
        startDate,
        endDate,
        additionalMatch = {}
    }
) => {
    return model.aggregate([
        {
            $match: {
                org: orgId,
                createdAt: {
                    $gte: startDate,
                    $lt: endDate
                },
                ...additionalMatch
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
 * Retrieves monthly organisation activity trends.
 *
 * Only aggregate counts are returned. Individual users,
 * trainers, trainees, courses and other private records
 * are never included in the result.
 *
 * @param {Object} options - Reporting options.
 * @param {string|mongoose.Types.ObjectId} options.orgId - Organisation ID.
 * @param {Date} options.startDate - Inclusive start date.
 * @param {Date} options.endDate - Exclusive end date.
 * @returns {Promise<Object>} Monthly activity trends.
 */
export const getOrganizationActivityTrends = async ({
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

    const options = {
        orgId: organizationId,
        startDate,
        endDate
    };

    const [
        memberships,
        trainerProfiles,
        competencyEvidence,
        trainingRequirements,
        matchingRuns,
        trainerAssignments,
        courses,
        enrollments,
        assessmentAttempts,
        learningProgress
    ] = await Promise.all([
        getMonthlyActivityCounts(
            OrganizationMembership,
            options
        ),

        getMonthlyActivityCounts(
            TrainerProfile,
            options
        ),

        getMonthlyActivityCounts(
            CompetencyEvidence,
            {
                ...options,
                additionalMatch: {
                    isDeleted: false,
                    supersededBy: null
                }
            }
        ),

        getMonthlyActivityCounts(
            TrainingRequirement,
            options
        ),

        getMonthlyActivityCounts(
            MatchRun,
            options
        ),

        getMonthlyActivityCounts(
            TrainerAssignment,
            options
        ),

        getMonthlyActivityCounts(
            Course,
            options
        ),

        getMonthlyActivityCounts(
            Enrollment,
            options
        ),

        getMonthlyActivityCounts(
            AssessmentAttempt,
            options
        ),

        getMonthlyActivityCounts(
            LearningProgress,
            options
        )
    ]);

    return {
        period: {
            startDate,
            endDate
        },

        memberships,
        trainerProfiles,
        competencyEvidence,
        trainingRequirements,
        matchingRuns,
        trainerAssignments,
        courses,
        enrollments,
        assessmentAttempts,
        learningProgress
    };
};