import { Router } from "express";

import { authenticate } from "../auth/auth.middleware.js";

import {
    loadOrganizationMembership,
    authorizeRoles
} from "../auth/authorization.middleware.js";

import validateRequest from "../../middleware/validate.middleware.js";

import {
    getNotificationController,
    listNotificationsController,
    markNotificationAsReadController,
    markAllNotificationsAsReadController,
    getUnreadNotificationCountController
} from "./notification.controller.js";

import {
    notificationIdParamsSchema,
    listNotificationsQuerySchema
} from "./notification.validation.js";


const router = Router();


/**
 * @route GET /notifications
 * @description Retrieves notifications belonging to the current user.
 * @access Organisation Admin, Trainer, Trainee
 */
router.get(
    "/notifications",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin", "trainer", "trainee"),
    validateRequest(listNotificationsQuerySchema, {
        query: true
    }),
    listNotificationsController
);


/**
 * @route GET /notifications/unread-count
 * @description Retrieves the unread notification count.
 * @access Organisation Admin, Trainer, Trainee
 */
router.get(
    "/notifications/unread-count",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin", "trainer", "trainee"),
    getUnreadNotificationCountController
);


/**
 * @route GET /notifications/:notificationId
 * @description Retrieves one notification.
 * @access Organisation Admin, Trainer, Trainee
 */
router.get(
    "/notifications/:notificationId",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin", "trainer", "trainee"),
    validateRequest(notificationIdParamsSchema, {
        params: true
    }),
    getNotificationController
);


/**
 * @route PATCH /notifications/read-all
 * @description Marks all current-user notifications as read.
 * @access Organisation Admin, Trainer, Trainee
 */
router.patch(
    "/notifications/read-all",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin", "trainer", "trainee"),
    markAllNotificationsAsReadController
);


/**
 * @route PATCH /notifications/:notificationId/read
 * @description Marks one notification as read.
 * @access Organisation Admin, Trainer, Trainee
 */
router.patch(
    "/notifications/:notificationId/read",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin", "trainer", "trainee"),
    validateRequest(notificationIdParamsSchema, {
        params: true
    }),
    markNotificationAsReadController
);


export default router;