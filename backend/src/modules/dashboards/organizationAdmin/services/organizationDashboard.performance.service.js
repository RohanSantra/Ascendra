import {
    getAssessmentPerformanceSummary
} from "../repositories/organizationDashboard.performance.repository.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../../../core/constants/index.js";

import AppError from "../../../../core/errors/AppError.js";


/**
 * Creates the UTC date range for a monthly reporting period.
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
 * Retrieves assessment performance for the current organisation.
 *
 * Only evaluated attempts are included. Performance is grouped
 * by course and assessment version.
 *
 * @param {Object} options - Reporting options.
 * @param {string} options.orgId - Current organisation ID.
 * @param {number} [options.periodMonths=12] - Reporting period.
 * @returns {Promise<Object>} Assessment performance report.
 * @throws {AppError} If the reporting options are invalid.
 */
export const getAssessmentPerformanceReport = async ({
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

    let assessments;

    try {
        assessments = await getAssessmentPerformanceSummary({
            orgId,
            startDate,
            endDate
        });
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

    const totalAttempts = assessments.reduce(
        (total, assessment) =>
            total + assessment.totalEvaluatedAttempts,
        0
    );

    const totalPassed = assessments.reduce(
        (total, assessment) =>
            total + assessment.passedAttempts,
        0
    );

    const totalFailed = assessments.reduce(
        (total, assessment) =>
            total + assessment.failedAttempts,
        0
    );

    const weightedScoreTotal = assessments.reduce(
        (total, assessment) =>
            total +
            assessment.averageScorePercentage *
            assessment.totalEvaluatedAttempts,
        0
    );

    return {
        generatedAt: new Date(),

        period: {
            months: periodMonths,
            startDate,
            endDate
        },

        overview: {
            totalAssessmentVersions: assessments.length,
            totalEvaluatedAttempts: totalAttempts,
            passedAttempts: totalPassed,
            failedAttempts: totalFailed,

            passRate: totalAttempts > 0
                ? Number(
                    ((totalPassed / totalAttempts) * 100).toFixed(2)
                )
                : 0,

            averageScorePercentage: totalAttempts > 0
                ? Number(
                    (weightedScoreTotal / totalAttempts).toFixed(2)
                )
                : 0
        },

        assessments
    };
};