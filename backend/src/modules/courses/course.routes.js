
import { Router } from "express";

import validateRequest from "../../middleware/validate.middleware.js";

import { authenticate } from "../auth/auth.middleware.js";

import {
    loadOrganizationMembership,
    authorizeRoles
} from "../auth/authorization.middleware.js";

import {
    createCourseSchema,
    updateCourseSchema,
    courseIdParamsSchema,
    listCoursesQuerySchema,
    updateCourseStatusSchema
} from "./course.validation.js";

import {
    createCourseHandler,
    getCourseHandler,
    getCourseListHandler,
    updateCourseHandler,
    transitionCourseStatusHandler
} from "./course.controller.js";

const router = Router();

/**
 * @route POST /courses
 * @description Creates a course from a trainer assignment.
 * @access Trainer
 */
router.post(
    "/",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainer"),
    validateRequest(createCourseSchema, { body: true }),
    createCourseHandler
);

/**
 * @route GET /courses
 * @description Retrieves courses for the active organisation.
 * @access Trainer, Organisation Admin
 */
router.get(
    "/",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainer", "admin"),
    validateRequest(listCoursesQuerySchema, { query: true }),
    getCourseListHandler
);

/**
 * @route GET /courses/:id
 * @description Retrieves a course by ID.
 * @access Trainer, Organisation Admin
 */
router.get(
    "/:id",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainer", "admin"),
    validateRequest(courseIdParamsSchema, { params: true }),
    getCourseHandler
);

/**
 * @route PATCH /courses/:id
 * @description Updates a draft course.
 * @access Trainer, Organisation Admin
 */
router.patch(
    "/:id",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainer", "admin"),
    validateRequest(updateCourseSchema, {
        body: true,
        params: true
    }),
    updateCourseHandler
);

/**
 * @route PATCH /courses/:id/status
 * @description Changes the lifecycle status of a course.
 * @access Trainer, Organisation Admin
 */
router.patch(
    "/:id/status",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainer", "admin"),
    validateRequest(
        courseIdParamsSchema.extend({
            body: updateCourseStatusSchema
        }),
        { body: true, params: true }
    ),
    transitionCourseStatusHandler
);

export default router;
