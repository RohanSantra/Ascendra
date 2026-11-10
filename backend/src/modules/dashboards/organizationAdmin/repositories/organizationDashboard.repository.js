import mongoose from "mongoose";

import OrganizationMembership from "../../../organizationMemberships/organizationMembership.model.js";
import TrainerProfile from "../../../trainerProfiles/trainerProfile.model.js";

import Competency from "../../../competencies/competency.model.js";
import Skill from "../../../skills/skill.model.js";
import CompetencyEvidence from "../../../competencyEvidence/submissions/competencyEvidence.model.js";

import TrainingRequirement from "../../../trainingRequirements/trainingRequirement.model.js";
import MatchRun from "../../../matchRun/matchRun.model.js";
import TrainerAssignment from "../../../trainerAssignments/trainerAssignment.model.js";

import Course from "../../../courses/course.model.js";
import CourseMaterial from "../../../courseMaterials/courseMaterial.model.js";
import Enrollment from "../../../enrollments/enrollment.model.js";

import Assessment from "../../../assessments/assessment.model.js";
import AssessmentAttempt from "../../../assessments/assessmentAttempt.model.js";

import LearningProgress from "../../../learningProgress/learningProgress.model.js";
import Notification from "../../../notifications/notification.model.js";
import Feedback from "../../../feedback/feedback.model.js";
import Announcement from "../../../announcements/announcement.model.js";


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
 * Returns aggregate counts grouped by a specified field.
 *
 * @param {import("mongoose").Model} model - Mongoose model.
 * @param {mongoose.Types.ObjectId} orgId - Organisation ID.
 * @param {string} field - Field or nested field to group by.
 * @param {Object} additionalMatch - Additional aggregation filters.
 * @returns {Promise<Array<Object>>} Grouped aggregate counts.
 */
const getOrganizationGroupedCounts = async (
    model,
    orgId,
    field,
    additionalMatch = {}
) => {
    return model.aggregate([
        {
            $match: {
                org: orgId,
                ...additionalMatch
            }
        },
        {
            $group: {
                _id: `$${field}`,
                count: {
                    $sum: 1
                }
            }
        },
        {
            $project: {
                _id: 0,
                category: "$_id",
                count: 1
            }
        },
        {
            $sort: {
                category: 1
            }
        }
    ]);
};


/**
 * Returns membership counts grouped by role and status.
 *
 * @param {mongoose.Types.ObjectId} orgId - Organisation ID.
 * @returns {Promise<Array<Object>>} Membership counts.
 */
export const getOrganizationMembershipCounts = async (orgId) => {
    return OrganizationMembership.aggregate([
        {
            $match: {
                org: orgId
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
 * Returns trainer counts grouped by approval status.
 *
 * @param {mongoose.Types.ObjectId} orgId - Organisation ID.
 * @returns {Promise<Array<Object>>} Trainer approval counts.
 */
export const getTrainerApprovalCounts = async (orgId) => {
    return getOrganizationGroupedCounts(
        TrainerProfile,
        orgId,
        "approval.status"
    );
};


/**
 * Returns trainer counts grouped by availability status.
 *
 * @param {mongoose.Types.ObjectId} orgId - Organisation ID.
 * @returns {Promise<Array<Object>>} Trainer availability counts.
 */
export const getTrainerAvailabilityCounts = async (orgId) => {
    return getOrganizationGroupedCounts(
        TrainerProfile,
        orgId,
        "availability.status"
    );
};


/**
 * Returns competency counts grouped by lifecycle status.
 *
 * @param {mongoose.Types.ObjectId} orgId - Organisation ID.
 * @returns {Promise<Array<Object>>} Competency counts.
 */
export const getCompetencyCounts = async (orgId) => {
    return getOrganizationGroupedCounts(
        Competency,
        orgId,
        "status"
    );
};


/**
 * Returns skill counts grouped by lifecycle status.
 *
 * @param {mongoose.Types.ObjectId} orgId - Organisation ID.
 * @returns {Promise<Array<Object>>} Skill counts.
 */
export const getSkillCounts = async (orgId) => {
    return getOrganizationGroupedCounts(
        Skill,
        orgId,
        "status"
    );
};


/**
 * Returns evidence counts grouped by verification status.
 *
 * Deleted and superseded evidence is excluded.
 *
 * @param {mongoose.Types.ObjectId} orgId - Organisation ID.
 * @returns {Promise<Array<Object>>} Evidence verification counts.
 */
export const getCompetencyEvidenceCounts = async (orgId) => {
    return getOrganizationGroupedCounts(
        CompetencyEvidence,
        orgId,
        "verification.status",
        {
            isDeleted: false,
            supersededBy: null
        }
    );
};


/**
 * Returns training requirement counts grouped by status.
 *
 * @param {mongoose.Types.ObjectId} orgId - Organisation ID.
 * @returns {Promise<Array<Object>>} Requirement counts.
 */
export const getTrainingRequirementCounts = async (orgId) => {
    return getOrganizationGroupedCounts(
        TrainingRequirement,
        orgId,
        "status"
    );
};


/**
 * Returns matching run counts grouped by outcome.
 *
 * @param {mongoose.Types.ObjectId} orgId - Organisation ID.
 * @returns {Promise<Array<Object>>} Matching outcome counts.
 */
export const getMatchingOutcomeCounts = async (orgId) => {
    return getOrganizationGroupedCounts(
        MatchRun,
        orgId,
        "outcome"
    );
};


/**
 * Returns trainer assignment counts grouped by status.
 *
 * @param {mongoose.Types.ObjectId} orgId - Organisation ID.
 * @returns {Promise<Array<Object>>} Assignment counts.
 */
export const getTrainerAssignmentCounts = async (orgId) => {
    return getOrganizationGroupedCounts(
        TrainerAssignment,
        orgId,
        "status"
    );
};


/**
 * Returns course counts grouped by status.
 *
 * @param {mongoose.Types.ObjectId} orgId - Organisation ID.
 * @returns {Promise<Array<Object>>} Course counts.
 */
export const getCourseCounts = async (orgId) => {
    return getOrganizationGroupedCounts(
        Course,
        orgId,
        "status"
    );
};


/**
 * Returns course material counts grouped by status.
 *
 * @param {mongoose.Types.ObjectId} orgId - Organisation ID.
 * @returns {Promise<Array<Object>>} Course material counts.
 */
export const getCourseMaterialCounts = async (orgId) => {
    return getOrganizationGroupedCounts(
        CourseMaterial,
        orgId,
        "status"
    );
};


/**
 * Returns enrolment counts grouped by status.
 *
 * @param {mongoose.Types.ObjectId} orgId - Organisation ID.
 * @returns {Promise<Array<Object>>} Enrolment counts.
 */
export const getEnrollmentCounts = async (orgId) => {
    return getOrganizationGroupedCounts(
        Enrollment,
        orgId,
        "status"
    );
};


/**
 * Returns assessment version counts grouped by status.
 *
 * Each version is counted separately.
 *
 * @param {mongoose.Types.ObjectId} orgId - Organisation ID.
 * @returns {Promise<Array<Object>>} Assessment counts.
 */
export const getAssessmentCounts = async (orgId) => {
    return getOrganizationGroupedCounts(
        Assessment,
        orgId,
        "status"
    );
};


/**
 * Returns assessment attempt counts grouped by status.
 *
 * @param {mongoose.Types.ObjectId} orgId - Organisation ID.
 * @returns {Promise<Array<Object>>} Attempt counts.
 */
export const getAssessmentAttemptCounts = async (orgId) => {
    return getOrganizationGroupedCounts(
        AssessmentAttempt,
        orgId,
        "status"
    );
};


/**
 * Returns learning progress counts grouped by status.
 *
 * @param {mongoose.Types.ObjectId} orgId - Organisation ID.
 * @returns {Promise<Array<Object>>} Learning progress counts.
 */
export const getLearningProgressCounts = async (orgId) => {
    return getOrganizationGroupedCounts(
        LearningProgress,
        orgId,
        "status"
    );
};

/**
 * Returns notification counts grouped by status.
 *
 * Also retrieves the number of notifications created
 * during the last 30 days.
 *
 * @param {mongoose.Types.ObjectId} orgId - Organisation ID.
 * @returns {Promise<Object>} Notification aggregate counts.
 */
export const getNotificationCounts = async (orgId) => {
    const [byStatus, recent] = await Promise.all([
        getOrganizationGroupedCounts(
            Notification,
            orgId,
            "status"
        ),

        Notification.countDocuments({
            org: orgId,
            createdAt: {
                $gte: new Date(
                    Date.now() - 30 * 24 * 60 * 60 * 1000
                )
            }
        })
    ]);

    return {
        byStatus,
        recent
    };
};

/**
 * Returns feedback counts grouped by visibility status.
 *
 * @param {mongoose.Types.ObjectId} orgId - Organisation ID.
 * @returns {Promise<Array<Object>>} Feedback counts.
 */
export const getFeedbackCounts = async (orgId) => {
    return getOrganizationGroupedCounts(
        Feedback,
        orgId,
        "status"
    );
};


/**
 * Returns announcement counts grouped by lifecycle status.
 *
 * @param {mongoose.Types.ObjectId} orgId - Organisation ID.
 * @returns {Promise<Array<Object>>} Announcement counts.
 */
export const getAnnouncementCounts = async (orgId) => {
    return getOrganizationGroupedCounts(
        Announcement,
        orgId,
        "status"
    );
};


/**
 * Retrieves aggregate dashboard data for one organisation.
 *
 * All queries are scoped to the supplied organisation ID.
 *
 * @param {Object} options - Dashboard options.
 * @param {string|mongoose.Types.ObjectId} options.orgId - Organisation ID.
 * @returns {Promise<Object>} Organisation dashboard aggregate data.
 */
export const getOrganizationDashboardOverview = async ({
    orgId
}) => {
    const organizationId = toOrganizationObjectId(orgId);

    const [
        totalMemberships,
        membershipCounts,
        trainerApprovalCounts,
        trainerAvailabilityCounts,
        competencyCounts,
        skillCounts,
        evidenceCounts,
        requirementCounts,
        matchingOutcomeCounts,
        assignmentCounts,
        courseCounts,
        materialCounts,
        enrollmentCounts,
        assessmentCounts,
        assessmentAttemptCounts,
        learningProgressCounts,
        notificationCounts,
        feedbackCounts,
        announcementCounts
    ] = await Promise.all([
        OrganizationMembership.countDocuments({
            org: organizationId
        }),

        getOrganizationMembershipCounts(organizationId),
        getTrainerApprovalCounts(organizationId),
        getTrainerAvailabilityCounts(organizationId),
        getCompetencyCounts(organizationId),
        getSkillCounts(organizationId),
        getCompetencyEvidenceCounts(organizationId),
        getTrainingRequirementCounts(organizationId),
        getMatchingOutcomeCounts(organizationId),
        getTrainerAssignmentCounts(organizationId),
        getCourseCounts(organizationId),
        getCourseMaterialCounts(organizationId),
        getEnrollmentCounts(organizationId),
        getAssessmentCounts(organizationId),
        getAssessmentAttemptCounts(organizationId),
        getLearningProgressCounts(organizationId),
        getNotificationCounts(organizationId),
        getFeedbackCounts(organizationId),
        getAnnouncementCounts(organizationId)
    ]);

    return {
        memberships: {
            total: totalMemberships,
            byRoleAndStatus: membershipCounts
        },

        trainers: {
            approval: trainerApprovalCounts,
            availability: trainerAvailabilityCounts
        },

        competencies: {
            lifecycle: competencyCounts
        },

        skills: {
            lifecycle: skillCounts
        },

        competencyEvidence: {
            verification: evidenceCounts
        },

        trainingRequirements: {
            lifecycle: requirementCounts
        },

        matching: {
            outcomes: matchingOutcomeCounts
        },

        trainerAssignments: {
            lifecycle: assignmentCounts
        },

        courses: {
            lifecycle: courseCounts
        },

        courseMaterials: {
            lifecycle: materialCounts
        },

        enrollments: {
            lifecycle: enrollmentCounts
        },

        assessments: {
            lifecycle: assessmentCounts
        },

        assessmentAttempts: {
            lifecycle: assessmentAttemptCounts
        },

        learningProgress: {
            lifecycle: learningProgressCounts
        },

        notifications: {
            lifecycle: notificationCounts.byStatus,
            recent: notificationCounts.recent
        },
        feedback: {
            lifecycle: feedbackCounts
        },

        announcements: {
            lifecycle: announcementCounts
        }
    };
};