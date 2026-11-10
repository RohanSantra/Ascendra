import { Router } from "express";

import { authenticate } from "../auth/auth.middleware.js";

import {
    loadOrganizationMembership,
    authorizeRoles
} from "../auth/authorization.middleware.js";

import validateRequest from "../../middleware/validate.middleware.js";

import {
    submitCourseFeedbackController,
    getCourseFeedbackController,
    listCourseFeedbackController,
    updateCourseFeedbackStatusController
} from "./feedback.controller.js";

import {
    createFeedbackSchema,
    feedbackIdParamsSchema,
    listFeedbackQuerySchema,
    updateFeedbackStatusSchema
} from "./feedback.validation.js";


const router = Router();


/**
 * @route POST /courses/:courseId/feedback
 * @description Submits feedback for a completed course.
 * @access Trainee
 */
router.post(
    "/courses/:courseId/feedback",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainee"),
    validateRequest(createFeedbackSchema, {
        params: true,
        body: true
    }),
    submitCourseFeedbackController
);


/**
 * @route GET /feedback
 * @description Retrieves feedback records within the user's organisation.
 * @access Organisation Admin, Trainer, Trainee
 */
router.get(
    "/feedback",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin", "trainer", "trainee"),
    validateRequest(listFeedbackQuerySchema, {
        query: true
    }),
    listCourseFeedbackController
);


/**
 * @route GET /feedback/:feedbackId
 * @description Retrieves a feedback record.
 * @access Organisation Admin, Trainer, Trainee
 */
router.get(
    "/feedback/:feedbackId",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin", "trainer", "trainee"),
    validateRequest(feedbackIdParamsSchema, {
        params: true
    }),
    getCourseFeedbackController
);


/**
 * @route PATCH /feedback/:feedbackId/status
 * @description Hides or restores a feedback record.
 * @access Organisation Admin
 */
router.patch(
    "/feedback/:feedbackId/status",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin"),
    validateRequest(updateFeedbackStatusSchema, {
        params: true,
        body: true
    }),
    updateCourseFeedbackStatusController
);


export default router;