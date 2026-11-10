import {
    getMatchingOutcomeReport,
    getTrainerAssignmentReport
} from "../repositories/organizationDashboard.matching.repository.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../../../core/constants/index.js";

import AppError from "../../../../core/errors/AppError.js";


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
 * Normalizes grouped counts into a complete status summary.
 *
 * @param {Array<Object>} records - Grouped repository records.
 * @param {string[]} expectedValues - Expected categories.
 * @param {string} field - Category field name.
 * @returns {Object} Normalized category counts.
 */
const normalizeCounts = (records, expectedValues, field) => {
    const counts = Object.fromEntries(
        expectedValues.map((value) => [value, 0])
    );

    for (const record of records) {
        if (Object.hasOwn(counts, record[field])) {
            counts[record[field]] = record.count;
        }
    }

    return counts;
};


/**
 * Calculates the sum of grouped counts.
 *
 * @param {Object} counts - Category counts.
 * @returns {number} Total count.
 */
const getTotal = (counts) => {
    return Object.values(counts).reduce(
        (total, count) => total + count,
        0
    );
};


/**
 * Retrieves matching and trainer assignment reports.
 *
 * All data is restricted to the authenticated organisation.
 *
 * @param {Object} options - Reporting options.
 * @param {string} options.orgId - Current organisation ID.
 * @param {number} [options.periodMonths=12] - Reporting period.
 * @returns {Promise<Object>} Matching and assignment report.
 * @throws {AppError} If reporting options are invalid.
 */
export const getOrganizationMatchingReport = async ({
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

    let matchingRecords;
    let assignmentRecords;

    try {
        [
            matchingRecords,
            assignmentRecords
        ] = await Promise.all([
            getMatchingOutcomeReport({
                orgId,
                startDate,
                endDate
            }),

            getTrainerAssignmentReport({
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

    const matchingOutcomes = normalizeCounts(
        matchingRecords,
        MATCHING_OUTCOMES,
        "outcome"
    );

    const assignments = normalizeCounts(
        assignmentRecords,
        ASSIGNMENT_STATUSES,
        "status"
    );

    const totalMatchingRuns = getTotal(matchingOutcomes);
    const totalAssignments = getTotal(assignments);

    return {
        generatedAt: new Date(),

        period: {
            months: periodMonths,
            startDate,
            endDate
        },

        matching: {
            totalRuns: totalMatchingRuns,
            outcomes: matchingOutcomes,

            strongOutcomeRate: totalMatchingRuns > 0
                ? Number(
                    (
                        matchingOutcomes.strong_found /
                        totalMatchingRuns *
                        100
                    ).toFixed(2)
                )
                : 0
        },

        assignments: {
            total: totalAssignments,
            statuses: assignments,

            completionRate: totalAssignments > 0
                ? Number(
                    (
                        assignments.completed /
                        totalAssignments *
                        100
                    ).toFixed(2)
                )
                : 0
        }
    };
};