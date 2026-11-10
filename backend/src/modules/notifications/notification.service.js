import mongoose from "mongoose";

import {
    createNotification as insertNotification,
    createManyNotifications,
    getNotificationById,
    getNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    countUnreadNotifications
} from "./notification.repository.js";

import OrganizationMembership from "../organizationMemberships/organizationMembership.model.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../core/constants/index.js";

import AppError from "../../core/errors/AppError.js";


/**
 * Creates a notification-related application error.
 *
 * @param {string} message
 * @param {number} statusCode
 * @param {string} code
 * @returns {AppError}
 */
const createNotificationError = (message, statusCode, code) => {
    return new AppError(message, statusCode, code);
};


/**
 * Validates a MongoDB ObjectId.
 *
 * @param {string} id
 * @returns {boolean}
 */
const isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};


/**
 * Validates organisation and user identifiers.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.userId
 */
const validateNotificationContext = ({ orgId, userId }) => {
    if (
        !isValidObjectId(orgId) ||
        !isValidObjectId(userId)
    ) {
        throw createNotificationError(
            "Invalid notification context.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }
};


/**
 * Creates an individual in-app notification.
 *
 * This function is intended for internal use by other
 * module services when an important event occurs.
 *
 * @param {Object} notificationData
 * @returns {Promise<Object>}
 */
export const createInAppNotification = async (notificationData) => {
    const {
        org,
        recipient,
        actor = null,
        type = "general",
        title,
        message,
        resource = null,
        metadata = null
    } = notificationData;

    if (
        !isValidObjectId(org) ||
        !isValidObjectId(recipient) ||
        (actor && !isValidObjectId(actor))
    ) {
        throw createNotificationError(
            "Invalid notification reference.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    return insertNotification({
        org,
        recipient,
        actor,
        type,
        title,
        message,
        resource,
        channels: ["in_app"],
        metadata
    });
};


/**
 * Creates in-app notifications for approved members
 * when an organisation announcement is published.
 *
 * Audience rules:
 * - everyone: trainers, trainees and administrators.
 * - trainers: trainers only.
 * - trainees: trainees only.
 *
 * The announcement publisher does not receive their
 * own announcement notification.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.actorId
 * @param {string} params.announcementId
 * @param {string} params.title
 * @param {string} params.message
 * @param {string} params.audience
 * @returns {Promise<Array<Object>>}
 */
export const createAnnouncementNotifications = async ({
    orgId,
    actorId,
    announcementId,
    title,
    message,
    audience
}) => {
    validateNotificationContext({
        orgId,
        userId: actorId
    });

    if (!isValidObjectId(announcementId)) {
        throw createNotificationError(
            "Invalid announcement reference.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    const allowedRoles = {
        everyone: ["admin", "trainer", "trainee"],
        trainers: ["trainer"],
        trainees: ["trainee"]
    };

    const roles = allowedRoles[audience];

    if (!roles) {
        throw createNotificationError(
            "Invalid announcement audience.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    const memberships = await OrganizationMembership.find({
        org: orgId,
        role: { $in: roles },
        status: "approved",
        user: { $ne: actorId }
    })
        .select("user")
        .lean();

    const notifications = memberships.map((membership) => ({
        org: orgId,
        recipient: membership.user,
        actor: actorId,
        type: "announcement_published",
        title,
        message,
        resource: {
            type: "announcement",
            id: announcementId
        },
        channels: ["in_app"]
    }));

    return createManyNotifications(notifications);
};


/**
 * Retrieves one notification belonging to the current user.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.userId
 * @param {string} params.notificationId
 * @returns {Promise<Object>}
 */
export const getUserNotification = async ({
    orgId,
    userId,
    notificationId
}) => {
    validateNotificationContext({ orgId, userId });

    if (!isValidObjectId(notificationId)) {
        throw createNotificationError(
            "Invalid notification identifier.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    const notification = await getNotificationById({
        orgId,
        recipientId: userId,
        notificationId
    });

    if (!notification) {
        throw createNotificationError(
            "Notification not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    if (
        notification.expiresAt &&
        notification.expiresAt <= new Date()
    ) {
        throw createNotificationError(
            "Notification has expired.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    return notification;
};


/**
 * Retrieves paginated notifications for the current user.
 *
 * Expired notifications are excluded from the result.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.userId
 * @param {Object} params.filters
 * @param {Object} params.pagination
 * @param {Object} params.sort
 * @returns {Promise<Object>}
 */
export const listUserNotifications = async ({
    orgId,
    userId,
    filters = {},
    pagination,
    sort
}) => {
    validateNotificationContext({ orgId, userId });

    const result = await getNotifications({
        orgId,
        recipientId: userId,
        filters: {
            ...filters,
            expiresAt: { $gt: new Date() }
        },
        pagination,
        sort
    });

    return result;
};


/**
 * Marks one notification as read.
 *
 * If the notification is already read, its existing record
 * is returned without changing its original read timestamp.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.userId
 * @param {string} params.notificationId
 * @returns {Promise<Object>}
 */
export const markUserNotificationAsRead = async ({
    orgId,
    userId,
    notificationId
}) => {
    validateNotificationContext({ orgId, userId });

    if (!isValidObjectId(notificationId)) {
        throw createNotificationError(
            "Invalid notification identifier.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    const notification = await getNotificationById({
        orgId,
        recipientId: userId,
        notificationId
    });

    if (!notification) {
        throw createNotificationError(
            "Notification not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    if (notification.status === "archived") {
        throw createNotificationError(
            "Archived notifications cannot be marked as read.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    if (notification.status === "read") {
        return notification;
    }

    const updatedNotification = await markNotificationAsRead({
        orgId,
        recipientId: userId,
        notificationId
    });

    if (updatedNotification) {
        return updatedNotification;
    }

    throw createNotificationError(
        "Unable to update the notification.",
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.RESOURCE_CONFLICT
    );
};


/**
 * Marks all unread notifications as read for the current user.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.userId
 * @returns {Promise<Object>}
 */
export const markAllUserNotificationsAsRead = async ({
    orgId,
    userId
}) => {
    validateNotificationContext({ orgId, userId });

    return markAllNotificationsAsRead({
        orgId,
        recipientId: userId
    });
};


/**
 * Retrieves the unread notification count for the current user.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.userId
 * @returns {Promise<number>}
 */
export const getUnreadNotificationCount = async ({
    orgId,
    userId
}) => {
    validateNotificationContext({ orgId, userId });

    return countUnreadNotifications({
        orgId,
        recipientId: userId
    });
};