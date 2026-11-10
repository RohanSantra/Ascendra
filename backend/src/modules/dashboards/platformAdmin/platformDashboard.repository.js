import Organization from "../../organizations/organization.model.js";
import OrganizationMembership from "../../organizationMemberships/organizationMembership.model.js";
import User from "../../auth/user.model.js";


/**
 * Returns organisation counts grouped by lifecycle status.
 *
 * Only aggregate counts are returned. No organisation-owned
 * operational or training data is accessed.
 *
 * @returns {Promise<Array<Object>>}
 */
export const getOrganizationLifecycleCounts = async () => {
    return Organization.aggregate([
        {
            $group: {
                _id: "$status",
                count: { $sum: 1 }
            }
        },
        {
            $project: {
                _id: 0,
                status: "$_id",
                count: 1
            }
        },
        {
            $sort: {
                status: 1
            }
        }
    ]);
};


/**
 * Returns global user counts grouped by account status.
 *
 * Each user account is counted only once, even when the user
 * belongs to multiple organisations.
 *
 * @returns {Promise<Array<Object>>}
 */
export const getUserStatusCounts = async () => {
    return User.aggregate([
        {
            $group: {
                _id: "$status",
                count: { $sum: 1 }
            }
        },
        {
            $project: {
                _id: 0,
                status: "$_id",
                count: 1
            }
        },
        {
            $sort: {
                status: 1
            }
        }
    ]);
};


/**
 * Returns global user counts grouped by platform-level role.
 *
 * Organisation-level roles are deliberately excluded from
 * this aggregation because they belong to memberships.
 *
 * @returns {Promise<Array<Object>>}
 */
export const getPlatformRoleCounts = async () => {
    return User.aggregate([
        {
            $group: {
                _id: "$platformRole",
                count: { $sum: 1 }
            }
        },
        {
            $project: {
                _id: 0,
                platformRole: "$_id",
                count: 1
            }
        },
        {
            $sort: {
                platformRole: 1
            }
        }
    ]);
};


/**
 * Returns membership counts grouped by organisation role
 * and membership approval status.
 *
 * Memberships are counted separately from unique user accounts.
 *
 * @returns {Promise<Array<Object>>}
 */
export const getMembershipCounts = async () => {
    return OrganizationMembership.aggregate([
        {
            $group: {
                _id: {
                    role: "$role",
                    status: "$status"
                },
                count: { $sum: 1 }
            }
        },
        {
            $project: {
                _id: 0,
                role: "$_id.role",
                status: "$_id.status",
                count: 1
            }
        },
        {
            $sort: {
                role: 1,
                status: 1
            }
        }
    ]);
};


/**
 * Returns organisation registration counts grouped by month.
 *
 * The date range is supplied by the dashboard service.
 * Only organisation creation dates and aggregate counts
 * are returned.
 *
 * @param {Object} options
 * @param {Date} options.startDate - Inclusive start date.
 * @param {Date} options.endDate - Exclusive end date.
 * @returns {Promise<Array<Object>>}
 */
export const getOrganizationRegistrationTrend = async ({
    startDate,
    endDate
}) => {
    return Organization.aggregate([
        {
            $match: {
                createdAt: {
                    $gte: startDate,
                    $lt: endDate
                }
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: {
                        format: "%Y-%m",
                        date: "$createdAt",
                        timezone: "UTC"
                    }
                },
                count: { $sum: 1 }
            }
        },
        {
            $project: {
                _id: 0,
                period: "$_id",
                count: 1
            }
        },
        {
            $sort: {
                period: 1
            }
        }
    ]);
};


/**
 * Returns unique user registration counts grouped by month.
 *
 * Users are counted globally, not once per organisation
 * membership.
 *
 * @param {Object} options
 * @param {Date} options.startDate - Inclusive start date.
 * @param {Date} options.endDate - Exclusive end date.
 * @returns {Promise<Array<Object>>}
 */
export const getUserRegistrationTrend = async ({
    startDate,
    endDate
}) => {
    return User.aggregate([
        {
            $match: {
                createdAt: {
                    $gte: startDate,
                    $lt: endDate
                }
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: {
                        format: "%Y-%m",
                        date: "$createdAt",
                        timezone: "UTC"
                    }
                },
                count: { $sum: 1 }
            }
        },
        {
            $project: {
                _id: 0,
                period: "$_id",
                count: 1
            }
        },
        {
            $sort: {
                period: 1
            }
        }
    ]);
};


/**
 * Returns the main platform-wide dashboard counts.
 *
 * These are aggregate statistics only. This method does not
 * retrieve organisation names, individual users, or any
 * organisation-specific learning and training information.
 *
 * @returns {Promise<Object>}
 */
export const getPlatformOverviewCounts = async () => {
    const [
        totalOrganizations,
        totalUsers,
        totalMemberships,
        totalPlatformAdmins
    ] = await Promise.all([
        Organization.countDocuments(),
        User.countDocuments(),
        OrganizationMembership.countDocuments(),
        User.countDocuments({
            platformRole: "platform_admin"
        })
    ]);

    return {
        totalOrganizations,
        totalUsers,
        totalMemberships,
        totalPlatformAdmins
    };
};