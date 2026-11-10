import {
    getEvidenceVerificationCounts,
    getEvidenceSubmissionTrends
} from "../repositories/organizationDashboard.evidence.repository.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../../../core/constants/index.js";

import AppError from "../../../../core/errors/AppError.js";


const EVIDENCE_STATUSES = [
    "self_reported",
    "verified",
    "rejected"
];


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
 * Normalizes grouped evidence counts.
 *
 * @param {Array<Object>} records - Repository aggregation results.
 * @returns {Object} Evidence status counts.
 */
const normalizeEvidenceCounts = (records) => {
    const counts = Object.fromEntries(
        EVIDENCE_STATUSES.map((status) => [
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
 * Fills missing months in the evidence submission trend.
 *
 * @param {Date} startDate - Inclusive start date.
 * @param {Date} endDate - Exclusive end date.
 * @param {Array<Object>} records - Monthly evidence counts.
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
 * Retrieves competency evidence verification reports.
 *
 * @param {Object} options - Reporting options.
 * @param {string} options.orgId - Current organisation ID.
 * @param {number} [options.periodMonths=12] - Reporting period.
 * @returns {Promise<Object>} Evidence verification report.
 * @throws {AppError} If reporting options are invalid.
 */
export const getOrganizationEvidenceReport = async ({
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

    let verificationRecords;
    let submissionRecords;

    try {
        [
            verificationRecords,
            submissionRecords
        ] = await Promise.all([
            getEvidenceVerificationCounts({
                orgId
            }),

            getEvidenceSubmissionTrends({
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

    const verification = normalizeEvidenceCounts(
        verificationRecords
    );

    const totalEvidence = Object.values(
        verification
    ).reduce(
        (total, count) => total + count,
        0
    );

    const reviewedEvidence =
        verification.verified + verification.rejected;

    return {
        generatedAt: new Date(),

        period: {
            months: periodMonths,
            startDate,
            endDate
        },

        overview: {
            totalEvidence,
            selfReported: verification.self_reported,
            verified: verification.verified,
            rejected: verification.rejected,

            reviewedEvidence,

            verificationRate: reviewedEvidence > 0
                ? Number(
                    (
                        verification.verified /
                        reviewedEvidence *
                        100
                    ).toFixed(2)
                )
                : 0
        },

        verification,
        submissionTrends: normalizeMonthlyTrend(
            startDate,
            endDate,
            submissionRecords
        )
    };
};