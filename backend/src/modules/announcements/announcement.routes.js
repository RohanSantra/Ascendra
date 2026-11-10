import { Router } from "express";

import { authenticate } from "../auth/auth.middleware.js";

import {
    loadOrganizationMembership,
    authorizeRoles
} from "../auth/authorization.middleware.js";

import validateRequest from "../../middleware/validate.middleware.js";

import {
    createAnnouncementController,
    getAnnouncementController,
    listAnnouncementsController,
    updateAnnouncementController,
    publishAnnouncementController,
    archiveAnnouncementController
} from "./announcement.controller.js";

import {
    createAnnouncementSchema,
    announcementIdParamsSchema,
    updateAnnouncementSchema,
    listAnnouncementsQuerySchema
} from "./announcement.validation.js";


const router = Router();


/**
 * @route POST /announcements
 * @description Creates an organisation announcement draft.
 * @access Organisation Admin
 */
router.post(
    "/announcements",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin"),
    validateRequest(createAnnouncementSchema, {
        body: true
    }),
    createAnnouncementController
);


/**
 * @route GET /announcements
 * @description Retrieves announcements available to the current member.
 * @access Organisation Admin, Trainer, Trainee
 */
router.get(
    "/announcements",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin", "trainer", "trainee"),
    validateRequest(listAnnouncementsQuerySchema, {
        query: true
    }),
    listAnnouncementsController
);


/**
 * @route GET /announcements/:announcementId
 * @description Retrieves an announcement.
 * @access Organisation Admin, Trainer, Trainee
 */
router.get(
    "/announcements/:announcementId",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin", "trainer", "trainee"),
    validateRequest(announcementIdParamsSchema, {
        params: true
    }),
    getAnnouncementController
);


/**
 * @route PATCH /announcements/:announcementId
 * @description Updates a draft announcement.
 * @access Organisation Admin
 */
router.patch(
    "/announcements/:announcementId",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin"),
    validateRequest(updateAnnouncementSchema, {
        params: true,
        body: true
    }),
    updateAnnouncementController
);


/**
 * @route PATCH /announcements/:announcementId/publish
 * @description Publishes a draft announcement.
 * @access Organisation Admin
 */
router.patch(
    "/announcements/:announcementId/publish",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin"),
    validateRequest(announcementIdParamsSchema, {
        params: true
    }),
    publishAnnouncementController
);


/**
 * @route PATCH /announcements/:announcementId/archive
 * @description Archives an announcement.
 * @access Organisation Admin
 */
router.patch(
    "/announcements/:announcementId/archive",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin"),
    validateRequest(announcementIdParamsSchema, {
        params: true
    }),
    archiveAnnouncementController
);


export default router;