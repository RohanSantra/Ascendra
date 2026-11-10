import {
    getOrganizationLifecycleCounts,
    getUserStatusCounts,
    getPlatformRoleCounts,
    getMembershipCounts,
    getOrganizationRegistrationTrend,
    getUserRegistrationTrend,
    getPlatformOverviewCounts
} from "./platformDashboard.repository.js";


const ORGANIZATION_STATUSES = [
    "pending",
    "active",
    "rejected",
    "suspended",
    "deactivated"
];

const USER_STATUSES = [
    "active",
    "suspended",
    "deactivated"
];

const PLATFORM_ROLES = [
    "user",
    "platform_admin"
];

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


/**
 * Creates a complete count object with zero values for
 * categories that have no matching records.
 *
 * @param {Array<Object>} records - Aggregation results.
 * @param {string} key - Field containing the category.
 * @param {Array<string>} categories - Expected categories.
 * @returns {Object}
 */
const normalizeCounts = (records, key, categories) => {
    const counts = Object.fromEntries(
        categories.map((category) => [category, 0])
    );

    for (const record of records) {
        if (Object.prototype.hasOwnProperty.call(counts, record[key])) {
            counts[record[key]] = record.count;
        }
    }

    return counts;
};


/**
 * Creates a complete role and membership-status count matrix.
 *
 * @param {Array<Object>} records - Membership aggregation results.
 * @returns {Object}
 */
const normalizeMembershipCounts = (records) => {
    const counts = Object.fromEntries(
        MEMBERSHIP_ROLES.map((role) => [
            role,
            Object.fromEntries(
                MEMBERSHIP_STATUSES.map((status) => [status, 0])
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
 * Returns the date range used for registration trends.
 *
 * The current month is included. The start date is the first
 * day of the earliest month in the requested period.
 *
 * @param {number} periodMonths - Number of months to include.
 * @returns {{startDate: Date, endDate: Date}}
 */
const getRegistrationDateRange = (periodMonths) => {
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
 * Retrieves the Platform Administrator dashboard.
 *
 * The dashboard contains platform-wide aggregate statistics only.
 * It does not expose organisation-specific training, competency,
 * matching, course, assessment, feedback, or learning records.
 *
 * @param {Object} options
 * @param {number} [options.periodMonths=12] - Trend period in months.
 * @returns {Promise<Object>}
 */
export const getPlatformDashboard = async ({
    periodMonths = 12
} = {}) => {
    if (
        !Number.isInteger(periodMonths) ||
        periodMonths < 1 ||
        periodMonths > 24
    ) {
        throw new Error(
            "Dashboard trend period must be between 1 and 24 months."
        );
    }

    const { startDate, endDate } =
        getRegistrationDateRange(periodMonths);

    const [
        overview,
        organizationLifecycleRecords,
        userStatusRecords,
        platformRoleRecords,
        membershipRecords,
        organizationRegistrationTrend,
        userRegistrationTrend
    ] = await Promise.all([
        getPlatformOverviewCounts(),
        getOrganizationLifecycleCounts(),
        getUserStatusCounts(),
        getPlatformRoleCounts(),
        getMembershipCounts(),
        getOrganizationRegistrationTrend({
            startDate,
            endDate
        }),
        getUserRegistrationTrend({
            startDate,
            endDate
        })
    ]);

    return {
        generatedAt: new Date(),

        period: {
            months: periodMonths,
            startDate,
            endDate
        },

        overview,

        organizations: {
            lifecycle: normalizeCounts(
                organizationLifecycleRecords,
                "status",
                ORGANIZATION_STATUSES
            )
        },

        users: {
            status: normalizeCounts(
                userStatusRecords,
                "status",
                USER_STATUSES
            ),

            platformRoles: normalizeCounts(
                platformRoleRecords,
                "platformRole",
                PLATFORM_ROLES
            )
        },

        memberships: {
            total: overview.totalMemberships,
            roles: normalizeMembershipCounts(membershipRecords)
        },

        registrationTrends: {
            organizations: organizationRegistrationTrend,
            users: userRegistrationTrend
        }
    };
};