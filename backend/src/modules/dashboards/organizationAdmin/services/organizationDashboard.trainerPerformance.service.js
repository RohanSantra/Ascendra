import {
    getTrainerAssignmentPerformance,
    getTrainerCoursePerformance
} from "../repositories/organizationDashboard.trainerPerformance.repository.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../../../core/constants/index.js";

import AppError from "../../../../core/errors/AppError.js";


/**
 * Creates a UTC reporting date range.
 *
 * @param {number} periodMonths - Number of months to include.
 * @returns {{startDate: Date, endDate: Date}} Reporting date range.
 */
const getReportingDateRange = (periodMonths) => {
    const now = new Date();

    const endDate = new Date(
        Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth() + 1,
            1
        )
    );

    const startDate = new Date(
        Date.UTC(
            endDate.getUTCFullYear(),
            endDate.getUTCMonth() - periodMonths,
            1
        )
    );

    return {
        startDate,
        endDate
    };
};


/**
 * Combines assignment and course statistics by trainer.
 *
 * @param {Array<Object>} assignmentRecords - Assignment statistics.
 * @param {Array<Object>} courseRecords - Course statistics.
 * @returns {Array<Object>} Combined trainer performance.
 */
const combineTrainerPerformance = (
    assignmentRecords,
    courseRecords
) => {
    const trainers = new Map();

    const createEmptyRecord = (trainerId) => ({
        trainerId,

        totalAssignments: 0,
        assigned: 0,
        inProgress: 0,
        completedAssignments: 0,
        cancelledAssignments: 0,

        totalCourses: 0,
        totalEnrollments: 0,
        completedEnrollments: 0,

        assignmentCompletionRate: 0,
        enrollmentCompletionRate: 0
    });

    for (const record of assignmentRecords) {
        trainers.set(
            String(record.trainerId),
            {
                ...createEmptyRecord(record.trainerId),

                totalAssignments: record.totalAssignments,
                assigned: record.assigned,
                inProgress: record.inProgress,
                completedAssignments: record.completed,
                cancelledAssignments: record.cancelled
            }
        );
    }

    for (const record of courseRecords) {
        const key = String(record.trainerId);

        const existing = trainers.get(key) ||
            createEmptyRecord(record.trainerId);

        existing.totalCourses = record.totalCourses;
        existing.totalEnrollments = record.totalEnrollments;
        existing.completedEnrollments =
            record.completedEnrollments;

        trainers.set(key, existing);
    }

    return Array.from(trainers.values())
        .map((trainer) => ({
            ...trainer,

            assignmentCompletionRate:
                trainer.totalAssignments > 0
                    ? Number(
                        (
                            trainer.completedAssignments /
                            trainer.totalAssignments *
                            100
                        ).toFixed(2)
                    )
                    : 0,

            enrollmentCompletionRate:
                trainer.totalEnrollments > 0
                    ? Number(
                        (
                            trainer.completedEnrollments /
                            trainer.totalEnrollments *
                            100
                        ).toFixed(2)
                    )
                    : 0
        }))
        .sort(
            (first, second) =>
                second.totalAssignments -
                first.totalAssignments
        );
};


/**
 * Retrieves trainer workload and course performance statistics.
 *
 * @param {Object} options - Reporting options.
 * @param {string} options.orgId - Current organisation ID.
 * @param {number} [options.periodMonths=12] - Reporting period.
 * @returns {Promise<Object>} Trainer performance report.
 * @throws {AppError} If reporting options are invalid.
 */
export const getOrganizationTrainerPerformanceReport = async ({
    orgId,
    periodMonths = 12
}) => {
    if (!orgId) {
        throw new AppError(
            "Organisation context is required.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    if (
        !Number.isInteger(periodMonths) ||
        periodMonths < 1 ||
        periodMonths > 24
    ) {
        throw new AppError(
            "Reporting period must be between 1 and 24 months.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    const { startDate, endDate } =
        getReportingDateRange(periodMonths);

    let assignmentRecords;
    let courseRecords;

    try {
        [
            assignmentRecords,
            courseRecords
        ] = await Promise.all([
            getTrainerAssignmentPerformance({
                orgId,
                startDate,
                endDate
            }),

            getTrainerCoursePerformance({
                orgId,
                startDate,
                endDate
            })
        ]);
    } catch (error) {
        if (
            error?.message === "A valid organisation ID is required." ||
            error?.message === "A valid reporting date range is required."
        ) {
            throw new AppError(
                "A valid organisation reporting context is required.",
                HTTP_STATUS.BAD_REQUEST,
                ERROR_CODES.VALIDATION_ERROR
            );
        }

        throw error;
    }

    const trainers = combineTrainerPerformance(
        assignmentRecords,
        courseRecords
    );

    const overview = trainers.reduce(
        (summary, trainer) => {
            summary.totalTrainers += 1;
            summary.totalAssignments += trainer.totalAssignments;
            summary.completedAssignments +=
                trainer.completedAssignments;
            summary.totalCourses += trainer.totalCourses;
            summary.totalEnrollments += trainer.totalEnrollments;
            summary.completedEnrollments +=
                trainer.completedEnrollments;

            return summary;
        },
        {
            totalTrainers: 0,
            totalAssignments: 0,
            completedAssignments: 0,
            totalCourses: 0,
            totalEnrollments: 0,
            completedEnrollments: 0
        }
    );

    overview.assignmentCompletionRate =
        overview.totalAssignments > 0
            ? Number(
                (
                    overview.completedAssignments /
                    overview.totalAssignments *
                    100
                ).toFixed(2)
            )
            : 0;

    overview.enrollmentCompletionRate =
        overview.totalEnrollments > 0
            ? Number(
                (
                    overview.completedEnrollments /
                    overview.totalEnrollments *
                    100
                ).toFixed(2)
            )
            : 0;

    return {
        generatedAt: new Date(),

        period: {
            months: periodMonths,
            startDate,
            endDate
        },

        overview,
        trainers
    };
};