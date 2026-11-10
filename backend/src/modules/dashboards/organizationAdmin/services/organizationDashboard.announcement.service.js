import {
    getAnnouncementStatusCounts,
    getAnnouncementAudienceCounts,
    getAnnouncementPublicationTrends
} from "../repositories/organizationDashboard.announcement.repository.js";

import AppError from "../../../../core/errors/AppError.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../../../core/constants/index.js";


const ANNOUNCEMENT_STATUSES = [
    "draft",
    "published",
    "archived"
];

const ANNOUNCEMENT_AUDIENCES = [
    "everyone",
    "trainers",
    "trainees"
];


/**
 * Normalizes grouped counts.
 *
 * @param {Array<Object>} records - Aggregation results.
 * @param {string} key - Grouping field.
 * @param {Array<string>} categories - Expected categories.
 * @returns {Object} Normalized counts.
 */
const normalizeCounts = (records, key, categories) => {
    const counts = Object.fromEntries(
        categories.map((category) => [category, 0])
    );

    for (const record of records) {
        if (Object.hasOwn(counts, record[key])) {
            counts[record[key]] = record.count;
        }
    }

    return counts;
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
 * Retrieves detailed announcement reporting for an organisation.
 *
 * @param {Object} options - Reporting options.
 * @param {string} options.orgId - Organisation ID.
 * @param {Date} options.startDate - Inclusive reporting start date.
 * @param {Date} options.endDate - Exclusive reporting end date.
 * @returns {Promise<Object>} Announcement reporting data.
 * @throws {AppError} If the reporting information is invalid.
 */
export const getOrganizationAnnouncementReport = async ({
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
        audienceRecords,
        publicationRecords
    ] = await Promise.all([
        getAnnouncementStatusCounts({ orgId }),
        getAnnouncementAudienceCounts({ orgId }),
        getAnnouncementPublicationTrends({
            orgId,
            startDate,
            endDate
        })
    ]);

    const byStatus = normalizeCounts(
        statusRecords,
        "status",
        ANNOUNCEMENT_STATUSES
    );

    const byAudience = normalizeCounts(
        audienceRecords,
        "audience",
        ANNOUNCEMENT_AUDIENCES
    );

    return {
        generatedAt: new Date(),

        period: {
            startDate,
            endDate
        },

        overview: {
            total: Object.values(byStatus).reduce(
                (total, count) => total + count,
                0
            ),
            draft: byStatus.draft,
            published: byStatus.published,
            archived: byStatus.archived
        },

        announcements: {
            byStatus,
            publishedByAudience: byAudience
        },

        publicationTrends: normalizeMonthlyTrends(
            publicationRecords,
            startDate,
            endDate
        )
    };
};