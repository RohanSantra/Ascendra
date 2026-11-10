import {
    getRequirementStatusCounts,
    getRequirementCreationTrends,
    getRequirementReportingStatuses
} from "../repositories/organizationDashboard.requirement.repository.js";

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
 * Normalizes monthly requirement creation trends.
 *
 * @param {Date} startDate - Inclusive start date.
 * @param {Date} endDate - Exclusive end date.
 * @param {Array<Object>} records - Repository trend records.
 * @returns {Array<Object>} Continuous monthly trend.
 */
const normalizeMonthlyTrend = (
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
 * Normalizes requirement lifecycle counts.
 *
 * @param {Array<Object>} records - Repository aggregation records.
 * @returns {Object} Requirement status counts.
 */
const normalizeRequirementCounts = (records) => {
    const statuses = getRequirementReportingStatuses();

    const counts = Object.fromEntries(
        statuses.map((status) => [
            status,
            0
        ])
    );

    for (const record of records) {
        if (Object.hasOwn(counts, record.status)) {
            counts[record.status] = record.count;
        }
    }

    return counts;
};


/**
 * Retrieves training requirement reports for an organisation.
 *
 * @param {Object} options - Reporting options.
 * @param {string} options.orgId - Current organisation ID.
 * @param {number} [options.periodMonths=12] - Reporting period.
 * @returns {Promise<Object>} Training requirement report.
 * @throws {AppError} If reporting options are invalid.
 */
export const getOrganizationRequirementReport = async ({
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

    let statusRecords;
    let creationRecords;

    try {
        [
            statusRecords,
            creationRecords
        ] = await Promise.all([
            getRequirementStatusCounts({
                orgId
            }),

            getRequirementCreationTrends({
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

    const statuses = normalizeRequirementCounts(
        statusRecords
    );

    const totalRequirements = Object.values(
        statuses
    ).reduce(
        (total, count) => total + count,
        0
    );

    const actionableRequirements =
        statuses.ready +
        statuses.matched +
        statuses.assigned;

    return {
        generatedAt: new Date(),

        period: {
            months: periodMonths,
            startDate,
            endDate
        },

        overview: {
            totalRequirements,
            draft: statuses.draft,
            ready: statuses.ready,
            matched: statuses.matched,
            assigned: statuses.assigned,
            cancelled: statuses.cancelled,
            archived: statuses.archived,
            actionableRequirements
        },

        statuses,

        creationTrends: normalizeMonthlyTrend(
            startDate,
            endDate,
            creationRecords
        )
    };
};