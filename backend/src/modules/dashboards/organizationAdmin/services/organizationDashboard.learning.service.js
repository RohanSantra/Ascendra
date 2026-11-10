import {
    getLearningProgressPerformance,
    getLearningActivityTrends
} from "../repositories/organizationDashboard.learning.repository.js";

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
 * Normalizes monthly learning activity.
 *
 * @param {Date} startDate - Inclusive start date.
 * @param {Date} endDate - Exclusive end date.
 * @param {Array<Object>} records - Repository activity records.
 * @returns {Array<Object>} Continuous monthly activity trend.
 */
const normalizeMonthlyActivity = (
    startDate,
    endDate,
    records
) => {
    const counts = new Map(
        records.map((record) => [
            record.period,
            record.count
        ])
    );

    const result = [];

    const current = new Date(
        Date.UTC(
            startDate.getUTCFullYear(),
            startDate.getUTCMonth(),
            1
        )
    );

    while (current < endDate) {
        const year = current.getUTCFullYear();

        const month = String(
            current.getUTCMonth() + 1
        ).padStart(2, "0");

        const period = `${year}-${month}`;

        result.push({
            period,
            count: counts.get(period) || 0
        });

        current.setUTCMonth(
            current.getUTCMonth() + 1
        );
    }

    return result;
};


/**
 * Calculates an aggregate completion percentage.
 *
 * @param {number} completed - Completed progress records.
 * @param {number} total - Total progress records.
 * @returns {number} Completion percentage.
 */
const calculateCompletionRate = (completed, total) => {
    if (total === 0) {
        return 0;
    }

    return Number(
        (completed / total * 100).toFixed(2)
    );
};


/**
 * Retrieves organisation learning progress reports.
 *
 * @param {Object} options - Reporting options.
 * @param {string} options.orgId - Current organisation ID.
 * @param {number} [options.periodMonths=12] - Reporting period.
 * @returns {Promise<Object>} Learning progress report.
 * @throws {AppError} If reporting options are invalid.
 */
export const getOrganizationLearningReport = async ({
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

    let courseRecords;
    let activityRecords;

    try {
        [
            courseRecords,
            activityRecords
        ] = await Promise.all([
            getLearningProgressPerformance({
                orgId
            }),

            getLearningActivityTrends({
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

    const overview = courseRecords.reduce(
        (summary, course) => {
            summary.totalCourses += 1;
            summary.totalProgressRecords +=
                course.totalProgressRecords;
            summary.uniqueTrainees +=
                course.uniqueTraineeCount;
            summary.notStarted += course.notStarted;
            summary.inProgress += course.inProgress;
            summary.completed += course.completed;

            return summary;
        },
        {
            totalCourses: 0,
            totalProgressRecords: 0,
            uniqueTrainees: 0,
            notStarted: 0,
            inProgress: 0,
            completed: 0
        }
    );

    overview.completionRate = calculateCompletionRate(
        overview.completed,
        overview.totalProgressRecords
    );

    return {
        generatedAt: new Date(),

        period: {
            months: periodMonths,
            startDate,
            endDate
        },

        overview,

        progressDistribution: {
            notStarted: overview.notStarted,
            inProgress: overview.inProgress,
            completed: overview.completed
        },

        coursePerformance: courseRecords,

        monthlyActivity: normalizeMonthlyActivity(
            startDate,
            endDate,
            activityRecords
        )
    };
};