import {
    getOrganizationActivityTrends
} from "../repositories/organizationDashboard.reporting.repository.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../../../core/constants/index.js";

import AppError from "../../../../core/errors/AppError.js";


/**
 * Returns the UTC date range for a monthly reporting period.
 *
 * The current month is included. The end date is exclusive,
 * and the start date is the first day of the earliest month.
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
 * Creates a continuous monthly timeline.
 *
 * Months without activity are included with a count of zero.
 *
 * @param {Date} startDate - Inclusive start date.
 * @param {Date} endDate - Exclusive end date.
 * @param {Array<Object>} records - Monthly aggregation results.
 * @returns {Array<Object>} Normalized monthly records.
 */
const normalizeMonthlyTrend = (
    startDate,
    endDate,
    records
) => {
    const countsByMonth = new Map(
        records.map((record) => [
            record.period,
            record.count
        ])
    );

    const normalized = [];

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

        normalized.push({
            period,
            count: countsByMonth.get(period) || 0
        });

        current.setUTCMonth(
            current.getUTCMonth() + 1
        );
    }

    return normalized;
};


/**
 * Normalizes all monthly activity trends.
 *
 * @param {Object} trends - Raw repository trend data.
 * @param {Date} startDate - Inclusive start date.
 * @param {Date} endDate - Exclusive end date.
 * @returns {Object} Continuous monthly activity trends.
 */
const normalizeActivityTrends = (
    trends,
    startDate,
    endDate
) => {
    const trendKeys = [
        "memberships",
        "trainerProfiles",
        "competencyEvidence",
        "trainingRequirements",
        "matchingRuns",
        "trainerAssignments",
        "courses",
        "enrollments",
        "assessmentAttempts",
        "learningProgress"
    ];

    return Object.fromEntries(
        trendKeys.map((key) => [
            key,
            normalizeMonthlyTrend(
                startDate,
                endDate,
                trends[key] || []
            )
        ])
    );
};


/**
 * Retrieves monthly activity reports for the current organisation.
 *
 * All report data is scoped to the authenticated organisation.
 * The reporting period is limited to a maximum of 24 months.
 *
 * @param {Object} options - Reporting options.
 * @param {string} options.orgId - Current organisation ID.
 * @param {number} [options.periodMonths=12] - Number of months to report.
 * @returns {Promise<Object>} Monthly organisation activity report.
 * @throws {AppError} If the reporting options are invalid.
 */
export const getOrganizationActivityReport = async ({
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

    let trends;

    try {
        trends = await getOrganizationActivityTrends({
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

    return {
        generatedAt: new Date(),

        period: {
            months: periodMonths,
            startDate,
            endDate
        },

        activity: normalizeActivityTrends(
            trends,
            startDate,
            endDate
        )
    };
};