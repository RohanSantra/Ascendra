import {
    getFeedbackStatusCounts,
    getFeedbackRatingDistribution,
    getFeedbackRatingSummary,
    getFeedbackSubmissionTrends
} from "../repositories/organizationDashboard.feedback.repository.js";

import AppError from "../../../../core/errors/AppError.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../../../core/constants/index.js";


const FEEDBACK_STATUSES = [
    "submitted",
    "hidden"
];

const FEEDBACK_RATINGS = [
    1,
    2,
    3,
    4,
    5
];


/**
 * Normalizes grouped status counts.
 *
 * @param {Array<Object>} records - Aggregation results.
 * @param {Array<string>} statuses - Expected statuses.
 * @returns {Object} Normalized status counts.
 */
const normalizeStatusCounts = (records, statuses) => {
    const counts = Object.fromEntries(
        statuses.map((status) => [status, 0])
    );

    for (const record of records) {
        if (Object.hasOwn(counts, record.status)) {
            counts[record.status] = record.count;
        }
    }

    return counts;
};


/**
 * Normalizes feedback rating distribution.
 *
 * @param {Array<Object>} records - Aggregation results.
 * @returns {Object} Rating distribution.
 */
const normalizeRatingDistribution = (records) => {
    const distribution = Object.fromEntries(
        FEEDBACK_RATINGS.map((rating) => [rating, 0])
    );

    for (const record of records) {
        if (Object.hasOwn(distribution, record.rating)) {
            distribution[record.rating] = record.count;
        }
    }

    return distribution;
};


/**
 * Generates a complete monthly trend with zero-value months.
 *
 * @param {Array<Object>} records - Monthly aggregation results.
 * @param {Date} startDate - Inclusive reporting start date.
 * @param {Date} endDate - Exclusive reporting end date.
 * @returns {Array<Object>} Complete monthly trend.
 */
const normalizeMonthlyTrends = (
    records,
    startDate,
    endDate
) => {
    const counts = new Map(
        records.map((record) => [
            record.period,
            record.count
        ])
    );

    const trends = [];

    const current = new Date(
        Date.UTC(
            startDate.getUTCFullYear(),
            startDate.getUTCMonth(),
            1
        )
    );

    while (current < endDate) {
        const period = current.toISOString().slice(0, 7);

        trends.push({
            period,
            count: counts.get(period) ?? 0
        });

        current.setUTCMonth(current.getUTCMonth() + 1);
    }

    return trends;
};


/**
 * Retrieves detailed feedback reporting for an organisation.
 *
 * All reporting queries are restricted to the supplied
 * organisation ID.
 *
 * @param {Object} options - Reporting options.
 * @param {string} options.orgId - Organisation ID.
 * @param {Date} options.startDate - Inclusive reporting start date.
 * @param {Date} options.endDate - Exclusive reporting end date.
 * @returns {Promise<Object>} Feedback reporting data.
 * @throws {AppError} If the reporting date range is invalid.
 */
export const getOrganizationFeedbackReport = async ({
    orgId,
    startDate,
    endDate
}) => {
    if (
        !orgId ||
        !(startDate instanceof Date) ||
        Number.isNaN(startDate.getTime()) ||
        !(endDate instanceof Date) ||
        Number.isNaN(endDate.getTime()) ||
        startDate >= endDate
    ) {
        throw new AppError(
            "Valid organisation and reporting date information is required.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    const [
        statusRecords,
        ratingRecords,
        ratingSummary,
        submissionRecords
    ] = await Promise.all([
        getFeedbackStatusCounts({ orgId }),
        getFeedbackRatingDistribution({ orgId }),
        getFeedbackRatingSummary({ orgId }),
        getFeedbackSubmissionTrends({
            orgId,
            startDate,
            endDate
        })
    ]);

    const byStatus = normalizeStatusCounts(
        statusRecords,
        FEEDBACK_STATUSES
    );

    const ratingDistribution = normalizeRatingDistribution(
        ratingRecords
    );

    return {
        generatedAt: new Date(),

        period: {
            startDate,
            endDate
        },

        overview: {
            total: byStatus.submitted + byStatus.hidden,
            submitted: byStatus.submitted,
            hidden: byStatus.hidden,
            averageRating: ratingSummary.averageRating,
            totalRatings: ratingSummary.totalRatings
        },

        feedback: {
            byStatus
        },

        ratings: {
            average: ratingSummary.averageRating,
            total: ratingSummary.totalRatings,
            distribution: ratingDistribution
        },

        submissionTrends: normalizeMonthlyTrends(
            submissionRecords,
            startDate,
            endDate
        )
    };
};