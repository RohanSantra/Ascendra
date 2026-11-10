import {
    getMembershipDistribution,
    getMembershipRegistrationTrends,
    getTrainerProfileApprovalDistribution
} from "../repositories/organizationDashboard.membership.repository.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../../../core/constants/index.js";

import AppError from "../../../../core/errors/AppError.js";


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

const TRAINER_APPROVAL_STATUSES = [
    "pending",
    "approved",
    "rejected",
    "suspended"
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
 * Normalizes membership distribution into role/status groups.
 *
 * @param {Array<Object>} records - Repository membership records.
 * @returns {Object} Normalized membership distribution.
 */
const normalizeMembershipDistribution = (records) => {
    const distribution = Object.fromEntries(
        MEMBERSHIP_ROLES.map((role) => [
            role,
            Object.fromEntries(
                MEMBERSHIP_STATUSES.map((status) => [
                    status,
                    0
                ])
            )
        ])
    );

    for (const record of records) {
        if (
            Object.hasOwn(distribution, record.role) &&
            Object.hasOwn(
                distribution[record.role],
                record.status
            )
        ) {
            distribution[record.role][record.status] =
                record.count;
        }
    }

    return distribution;
};


/**
 * Normalizes trainer approval distribution.
 *
 * @param {Array<Object>} records - Repository approval records.
 * @returns {Object} Approval status counts.
 */
const normalizeTrainerApprovalDistribution = (records) => {
    const distribution = Object.fromEntries(
        TRAINER_APPROVAL_STATUSES.map((status) => [
            status,
            0
        ])
    );

    for (const record of records) {
        if (Object.hasOwn(distribution, record.status)) {
            distribution[record.status] = record.count;
        }
    }

    return distribution;
};


/**
 * Normalizes monthly membership trends.
 *
 * @param {Date} startDate - Inclusive start date.
 * @param {Date} endDate - Exclusive end date.
 * @param {Array<Object>} records - Repository trend records.
 * @returns {Array<Object>} Continuous monthly registration trend.
 */
const normalizeMonthlyRegistrationTrends = (
    startDate,
    endDate,
    records
) => {
    const counts = new Map();

    for (const record of records) {
        if (!counts.has(record.period)) {
            counts.set(record.period, {});
        }

        counts.get(record.period)[record.role] = record.count;
    }

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

        const roleCounts = counts.get(period) || {};

        result.push({
            period,
            admin: roleCounts.admin || 0,
            trainer: roleCounts.trainer || 0,
            trainee: roleCounts.trainee || 0
        });

        current.setUTCMonth(
            current.getUTCMonth() + 1
        );
    }

    return result;
};


/**
 * Retrieves organisation membership and registration reports.
 *
 * @param {Object} options - Reporting options.
 * @param {string} options.orgId - Current organisation ID.
 * @param {number} [options.periodMonths=12] - Reporting period.
 * @returns {Promise<Object>} Membership report.
 * @throws {AppError} If reporting options are invalid.
 */
export const getOrganizationMembershipReport = async ({
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

    let membershipRecords;
    let registrationRecords;
    let trainerApprovalRecords;

    try {
        [
            membershipRecords,
            registrationRecords,
            trainerApprovalRecords
        ] = await Promise.all([
            getMembershipDistribution({
                orgId
            }),

            getMembershipRegistrationTrends({
                orgId,
                startDate,
                endDate
            }),

            getTrainerProfileApprovalDistribution({
                orgId
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

    const memberships = normalizeMembershipDistribution(
        membershipRecords
    );

    const trainerApprovals =
        normalizeTrainerApprovalDistribution(
            trainerApprovalRecords
        );

    const membershipTotals = Object.fromEntries(
        MEMBERSHIP_ROLES.map((role) => [
            role,
            Object.values(memberships[role]).reduce(
                (total, count) => total + count,
                0
            )
        ])
    );

    const totalMemberships = Object.values(
        membershipTotals
    ).reduce(
        (total, count) => total + count,
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
            totalMemberships,
            totalAdmins: membershipTotals.admin,
            totalTrainers: membershipTotals.trainer,
            totalTrainees: membershipTotals.trainee,
            approvedMemberships:
                MEMBERSHIP_ROLES.reduce(
                    (total, role) =>
                        total + memberships[role].approved,
                    0
                ),
            pendingMemberships:
                MEMBERSHIP_ROLES.reduce(
                    (total, role) =>
                        total + memberships[role].pending,
                    0
                ),
            suspendedMemberships:
                MEMBERSHIP_ROLES.reduce(
                    (total, role) =>
                        total + memberships[role].suspended,
                    0
                )
        },

        membershipDistribution: memberships,

        trainerApprovals: {
            total: Object.values(
                trainerApprovals
            ).reduce(
                (total, count) => total + count,
                0
            ),
            statuses: trainerApprovals
        },

        registrationTrends:
            normalizeMonthlyRegistrationTrends(
                startDate,
                endDate,
                registrationRecords
            )
    };
};