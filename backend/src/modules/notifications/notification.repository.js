import Notification from "./notification.model.js";


/**
 * Creates a notification.
 *
 * @param {Object} notificationData
 * @param {Object} options
 * @param {Object|null} options.session
 * @returns {Promise<Object>}
 */
export const createNotification = async (
    notificationData,
    { session = null } = {}
) => {
    const [notification] = await Notification.create(
        [notificationData],
        { session }
    );

    return notification;
};


/**
 * Creates multiple notifications in one bulk operation.
 *
 * Useful when an organisation-wide event needs to notify
 * several members.
 *
 * @param {Array<Object>} notifications
 * @param {Object} options
 * @param {Object|null} options.session
 * @returns {Promise<Array<Object>>}
 */
export const createManyNotifications = async (
    notifications,
    { session = null } = {}
) => {
    if (!notifications.length) {
        return [];
    }

    return Notification.insertMany(
        notifications,
        {
            session,
            ordered: false
        }
    );
};


/**
 * Retrieves one notification belonging to a recipient
 * within an organisation.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.recipientId
 * @param {string} params.notificationId
 * @param {Object} options
 * @param {Object|null} options.session
 * @returns {Promise<Object|null>}
 */
export const getNotificationById = async (
    {
        orgId,
        recipientId,
        notificationId
    },
    { session = null } = {}
) => {
    return Notification.findOne({
        _id: notificationId,
        org: orgId,
        recipient: recipientId
    })
        .populate("actor", "firstName lastName")
        .session(session)
        .lean();
};


/**
 * Retrieves paginated notifications for one recipient.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.recipientId
 * @param {Object} params.filters
 * @param {Object} params.pagination
 * @param {Object} params.sort
 * @param {Object} options
 * @param {Object|null} options.session
 * @returns {Promise<Object>}
 */
export const getNotifications = async (
    {
        orgId,
        recipientId,
        filters = {},
        pagination,
        sort
    },
    { session = null } = {}
) => {
    const query = {
        org: orgId,
        recipient: recipientId
    };

    if (filters.status) {
        query.status = filters.status;
    }

    if (filters.type) {
        query.type = filters.type;
    }

    if (filters.expiresAt) {
        query.$or = [
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } }
        ];
    }

    const safeSortFields = [
        "createdAt",
        "updatedAt"
    ];

    const sortField = safeSortFields.includes(sort?.sortBy)
        ? sort.sortBy
        : "createdAt";

    const sortDirection = sort?.sortOrder === "asc" ? 1 : -1;

    const skip = (pagination.page - 1) * pagination.limit;

    const [data, total] = await Promise.all([
        Notification.find(query)
            .sort({ [sortField]: sortDirection })
            .skip(skip)
            .limit(pagination.limit)
            .populate("actor", "firstName lastName")
            .session(session)
            .lean(),

        Notification.countDocuments(query).session(session)
    ]);

    return {
        data,
        meta: {
            total,
            page: pagination.page,
            limit: pagination.limit,
            totalPages: Math.ceil(total / pagination.limit)
        }
    };
};


/**
 * Marks one recipient-owned notification as read.
 *
 * Only unread notifications are modified.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.recipientId
 * @param {string} params.notificationId
 * @param {Object} options
 * @param {Object|null} options.session
 * @returns {Promise<Object|null>}
 */
export const markNotificationAsRead = async (
    {
        orgId,
        recipientId,
        notificationId
    },
    { session = null } = {}
) => {
    return Notification.findOneAndUpdate(
        {
            _id: notificationId,
            org: orgId,
            recipient: recipientId,
            status: "unread"
        },
        {
            $set: {
                status: "read",
                readAt: new Date()
            }
        },
        {
            returnDocument: "after",
            runValidators: true,
            session
        }
    )
        .populate("actor", "firstName lastName")
        .lean();
};


/**
 * Marks all unread notifications as read for a recipient.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.recipientId
 * @param {Object} options
 * @param {Object|null} options.session
 * @returns {Promise<Object>}
 */
export const markAllNotificationsAsRead = async (
    {
        orgId,
        recipientId
    },
    { session = null } = {}
) => {
    const result = await Notification.updateMany(
        {
            org: orgId,
            recipient: recipientId,
            status: "unread"
        },
        {
            $set: {
                status: "read",
                readAt: new Date()
            }
        },
        { session }
    );

    return {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
    };
};


/**
 * Counts unread notifications for a recipient.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.recipientId
 * @param {Object} options
 * @param {Object|null} options.session
 * @returns {Promise<number>}
 */
export const countUnreadNotifications = async (
    {
        orgId,
        recipientId
    },
    { session = null } = {}
) => {
    return Notification.countDocuments({
        org: orgId,
        recipient: recipientId,
        status: "unread"
    }).session(session);
};