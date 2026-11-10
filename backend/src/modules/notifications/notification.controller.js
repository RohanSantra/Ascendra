import {
    getUserNotification,
    listUserNotifications,
    markUserNotificationAsRead,
    markAllUserNotificationsAsRead,
    getUnreadNotificationCount
} from "./notification.service.js";

import ApiResponse from "../../core/responses/ApiResponse.js";
import asyncHandler from "../../core/utils/asyncHandler.js";


/**
 * Retrieves one notification belonging to the current user.
 *
 * @route GET /notifications/:notificationId
 */
export const getNotificationController = asyncHandler(
    async (req, res) => {
        const notification = await getUserNotification({
            orgId: req.user.orgId,
            userId: req.user.userId,
            notificationId: req.validated.params.notificationId
        });

        return ApiResponse.ok(
            res,
            "Notification retrieved successfully.",
            notification
        );
    }
);


/**
 * Retrieves paginated notifications for the current user.
 *
 * @route GET /notifications
 */
export const listNotificationsController = asyncHandler(
    async (req, res) => {
        const { page, limit, sortOrder, status, type } =
            req.validated.query;

        const result = await listUserNotifications({
            orgId: req.user.orgId,
            userId: req.user.userId,
            filters: {
                status,
                type
            },
            pagination: {
                page,
                limit
            },
            sort: {
                sortBy: "createdAt",
                sortOrder
            }
        });

        return ApiResponse.ok(
            res,
            "Notifications retrieved successfully.",
            result.data,
            result.meta
        );
    }
);


/**
 * Marks one notification as read.
 *
 * @route PATCH /notifications/:notificationId/read
 */
export const markNotificationAsReadController = asyncHandler(
    async (req, res) => {
        const notification = await markUserNotificationAsRead({
            orgId: req.user.orgId,
            userId: req.user.userId,
            notificationId: req.validated.params.notificationId
        });

        return ApiResponse.ok(
            res,
            "Notification marked as read.",
            notification
        );
    }
);


/**
 * Marks all unread notifications as read.
 *
 * @route PATCH /notifications/read-all
 */
export const markAllNotificationsAsReadController = asyncHandler(
    async (req, res) => {
        const result = await markAllUserNotificationsAsRead({
            orgId: req.user.orgId,
            userId: req.user.userId
        });

        return ApiResponse.ok(
            res,
            "Notifications marked as read.",
            result
        );
    }
);


/**
 * Retrieves the unread notification count.
 *
 * @route GET /notifications/unread-count
 */
export const getUnreadNotificationCountController = asyncHandler(
    async (req, res) => {
        const count = await getUnreadNotificationCount({
            orgId: req.user.orgId,
            userId: req.user.userId
        });

        return ApiResponse.ok(
            res,
            "Unread notification count retrieved successfully.",
            { unreadCount: count }
        );
    }
);