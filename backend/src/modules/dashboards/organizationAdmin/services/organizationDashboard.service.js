import {
    getOrganizationDashboardOverview
} from "../repositories/organizationDashboard.repository.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../../../core/constants/index.js";

import AppError from "../../../../core/errors/AppError.js";


const MEMBERSHIP_ROLES = [
    "admin",
    "trainer",
    "trainee"
];

const MEMBERSHIP_STATUSES = [
    "pending",
    "approved",
    "rejected",
    "suspended"
];

const TRAINER_APPROVAL_STATUSES = [
    "pending",
    "approved",
    "rejected",
    "suspended"
];

const TRAINER_AVAILABILITY_STATUSES = [
    "available",
    "limited",
    "unavailable",
    "on_leave"
];

const EVIDENCE_STATUSES = [
    "self_reported",
    "verified",
    "rejected"
];

const REQUIREMENT_STATUSES = [
    "draft",
    "ready",
    "matched",
    "assigned",
    "cancelled",
    "archived"
];

const MATCHING_OUTCOMES = [
    "strong_found",
    "partial_only",
    "none_suitable"
];

const ASSIGNMENT_STATUSES = [
    "assigned",
    "in_progress",
    "completed",
    "cancelled"
];

const COURSE_STATUSES = [
    "draft",
    "published",
    "ongoing",
    "completed",
    "cancelled",
    "archived"
];

const MATERIAL_STATUSES = [
    "active",
    "archived"
];

const ENROLLMENT_STATUSES = [
    "enrolled",
    "in_progress",
    "completed",
    "withdrawn",
    "cancelled"
];

const ASSESSMENT_STATUSES = [
    "draft",
    "published",
    "archived"
];

const ASSESSMENT_ATTEMPT_STATUSES = [
    "in_progress",
    "submitted",
    "evaluated",
    "expired"
];

const LEARNING_PROGRESS_STATUSES = [
    "not_started",
    "in_progress",
    "completed"
];

const FEEDBACK_STATUSES = [
    "submitted",
    "hidden"
];

const ANNOUNCEMENT_STATUSES = [
    "draft",
    "published",
    "archived"
];

const NOTIFICATION_STATUSES = [
    "unread",
    "read",
    "archived"
];

/**
 * Creates a complete count object with zero values for
 * categories that have no matching records.
 *
 * @param {Array<Object>} records - Aggregation results.
 * @param {string} key - Field containing the category.
 * @param {Array<string>} categories - Expected categories.
 * @returns {Object} Normalized category counts.
 */
const normalizeCounts = (records, key, categories) => {
    const counts = Object.fromEntries(
        categories.map((category) => [category, 0])
    );

    for (const record of records) {
        if (
            Object.prototype.hasOwnProperty.call(
                counts,
                record[key]
            )
        ) {
            counts[record[key]] = record.count;
        }
    }

    return counts;
};


/**
 * Creates a complete membership count matrix.
 *
 * @param {Array<Object>} records - Membership aggregation results.
 * @returns {Object} Counts grouped by role and status.
 */
const normalizeMembershipCounts = (records) => {
    const counts = Object.fromEntries(
        MEMBERSHIP_ROLES.map((role) => [
            role,
            Object.fromEntries(
                MEMBERSHIP_STATUSES.map((status) => [
                    status,
                    0
                ])
            )
        ])
    );

    for (const record of records) {
        if (
            counts[record.role] &&
            Object.prototype.hasOwnProperty.call(
                counts[record.role],
                record.status
            )
        ) {
            counts[record.role][record.status] = record.count;
        }
    }

    return counts;
};


/**
 * Calculates the total of a category count object.
 *
 * @param {Object} counts - Category count object.
 * @returns {number} Total count.
 */
const getTotal = (counts) => {
    return Object.values(counts).reduce(
        (total, count) => total + count,
        0
    );
};


/**
 * Calculates a percentage safely.
 *
 * @param {number} numerator - Number of successful records.
 * @param {number} denominator - Total eligible records.
 * @returns {number} Percentage rounded to two decimal places.
 */
const calculatePercentage = (numerator, denominator) => {
    if (!denominator) {
        return 0;
    }

    return Number(
        ((numerator / denominator) * 100).toFixed(2)
    );
};


/**
 * Converts grouped counts into a total and status breakdown.
 *
 * @param {Array<Object>} records - Aggregation results.
 * @param {Array<string>} statuses - Expected statuses.
 * @returns {{total: number, byStatus: Object}} Normalized summary.
 */
const createStatusSummary = (records, statuses) => {
    const byStatus = normalizeCounts(
        records,
        "category",
        statuses
    );

    return {
        total: getTotal(byStatus),
        byStatus
    };
};


/**
 * Retrieves the Organisation Administrator dashboard.
 *
 * All dashboard data is restricted to the supplied organisation.
 * The organisation ID must come from the authenticated organisation
 * context, not from request body or query parameters.
 *
 * @param {Object} options - Dashboard options.
 * @param {string} options.orgId - Current organisation ID.
 * @returns {Promise<Object>} Organisation dashboard data.
 * @throws {AppError} If the organisation ID is invalid.
 */
export const getOrganizationDashboard = async ({
    orgId
}) => {
    if (!orgId) {
        throw new AppError(
            "Organisation context is required.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    let overview;

    try {
        overview = await getOrganizationDashboardOverview({
            orgId
        });
    } catch (error) {
        if (
            error?.message ===
            "A valid organisation ID is required."
        ) {
            throw new AppError(
                "A valid organisation context is required.",
                HTTP_STATUS.BAD_REQUEST,
                ERROR_CODES.VALIDATION_ERROR
            );
        }

        throw error;
    }

    const memberships = normalizeMembershipCounts(
        overview.memberships.byRoleAndStatus
    );

    const trainerApproval = normalizeCounts(
        overview.trainers.approval,
        "category",
        TRAINER_APPROVAL_STATUSES
    );

    const trainerAvailability = normalizeCounts(
        overview.trainers.availability,
        "category",
        TRAINER_AVAILABILITY_STATUSES
    );

    const competencies = createStatusSummary(
        overview.competencies.lifecycle,
        ["active", "archived"]
    );

    const skills = createStatusSummary(
        overview.skills.lifecycle,
        ["active", "archived"]
    );

    const evidence = normalizeCounts(
        overview.competencyEvidence.verification,
        "category",
        EVIDENCE_STATUSES
    );

    const requirements = normalizeCounts(
        overview.trainingRequirements.lifecycle,
        "category",
        REQUIREMENT_STATUSES
    );

    const matchingOutcomes = normalizeCounts(
        overview.matching.outcomes,
        "category",
        MATCHING_OUTCOMES
    );

    const assignments = normalizeCounts(
        overview.trainerAssignments.lifecycle,
        "category",
        ASSIGNMENT_STATUSES
    );

    const courses = normalizeCounts(
        overview.courses.lifecycle,
        "category",
        COURSE_STATUSES
    );

    const courseMaterials = normalizeCounts(
        overview.courseMaterials.lifecycle,
        "category",
        MATERIAL_STATUSES
    );

    const enrollments = normalizeCounts(
        overview.enrollments.lifecycle,
        "category",
        ENROLLMENT_STATUSES
    );

    const assessments = normalizeCounts(
        overview.assessments.lifecycle,
        "category",
        ASSESSMENT_STATUSES
    );

    const assessmentAttempts = normalizeCounts(
        overview.assessmentAttempts.lifecycle,
        "category",
        ASSESSMENT_ATTEMPT_STATUSES
    );

    const learningProgress = normalizeCounts(
        overview.learningProgress.lifecycle,
        "category",
        LEARNING_PROGRESS_STATUSES
    );

    const feedback = normalizeCounts(
        overview.feedback.lifecycle,
        "category",
        FEEDBACK_STATUSES
    );

    const announcements = normalizeCounts(
        overview.announcements.lifecycle,
        "category",
        ANNOUNCEMENT_STATUSES
    );

    const notifications = normalizeCounts(
        overview.notifications.lifecycle,
        "category",
        NOTIFICATION_STATUSES
    );

    const totalMemberships = overview.memberships.total;

    const totalTrainers = getTotal(trainerApproval);

    const totalTrainees = getTotal(
        memberships.trainee
    );

    const eligibleEnrollments =
        enrollments.enrolled +
        enrollments.in_progress +
        enrollments.completed;

    const eligibleLearningRecords =
        learningProgress.not_started +
        learningProgress.in_progress +
        learningProgress.completed;

    const totalEvidence = getTotal(evidence);

    const totalRequirements = getTotal(requirements);

    return {
        generatedAt: new Date(),

        overview: {
            totalMemberships,
            totalTrainers,
            totalTrainees,

            approvedTrainers: trainerApproval.approved,
            pendingTrainerApprovals: trainerApproval.pending,

            activeCourses: courses.published + courses.ongoing,
            completedCourses: courses.completed,

            activeEnrollments:
                enrollments.enrolled + enrollments.in_progress,

            completedEnrollments: enrollments.completed
        },

        memberships: {
            total: totalMemberships,
            byRoleAndStatus: memberships
        },

        trainers: {
            total: totalTrainers,

            approval: {
                total: totalTrainers,
                byStatus: trainerApproval
            },

            availability: {
                total: getTotal(trainerAvailability),
                byStatus: trainerAvailability
            }
        },

        competencies,

        skills,

        competencyEvidence: {
            total: totalEvidence,
            byVerificationStatus: evidence,

            verificationRate: calculatePercentage(
                evidence.verified,
                totalEvidence
            )
        },

        trainingRequirements: {
            total: totalRequirements,
            byStatus: requirements,

            readiness: {
                ready: requirements.ready,
                matched: requirements.matched,
                assigned: requirements.assigned,

                readyOrBeyond: requirements.ready +
                    requirements.matched +
                    requirements.assigned
            }
        },

        matching: {
            totalRuns: getTotal(matchingOutcomes),
            byOutcome: matchingOutcomes
        },

        trainerAssignments: {
            total: getTotal(assignments),
            byStatus: assignments
        },

        courses: {
            total: getTotal(courses),
            byStatus: courses
        },

        courseMaterials: {
            total: getTotal(courseMaterials),
            byStatus: courseMaterials
        },

        enrollments: {
            total: getTotal(enrollments),
            byStatus: enrollments,

            completionRate: calculatePercentage(
                enrollments.completed,
                eligibleEnrollments
            )
        },

        assessments: {
            totalVersions: getTotal(assessments),
            byStatus: assessments,
            published: assessments.published
        },

        assessmentAttempts: {
            total: getTotal(assessmentAttempts),
            byStatus: assessmentAttempts,

            evaluated: assessmentAttempts.evaluated,
            pendingEvaluation: assessmentAttempts.submitted
        },

        learningProgress: {
            total: getTotal(learningProgress),
            byStatus: learningProgress,

            completionRate: calculatePercentage(
                learningProgress.completed,
                eligibleLearningRecords
            )
        },

        feedback: {
            total: getTotal(feedback),
            byStatus: feedback
        },

        announcements: {
            total: getTotal(announcements),
            byStatus: announcements
        },

        notifications: {
            total: getTotal(notifications),
            byStatus: notifications,
            unread: notifications.unread,
            read: notifications.read,
            archived: notifications.archived,
            recent: overview.notifications.recent
        }
    };
};