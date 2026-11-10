import { Router } from "express";

import validateRequest from "../../middleware/validate.middleware.js";

import { authenticate } from "../auth/auth.middleware.js";

import {
    loadOrganizationMembership,
    authorizeRoles
} from "../auth/authorization.middleware.js";

import {
    createEnrollmentSchema,
    enrollmentIdParamsSchema,
    listEnrollmentsQuerySchema,
    updateEnrollmentStatusSchema
} from "./enrollment.validation.js";

import {
    createEnrollmentHandler,
    getEnrollmentHandler,
    getEnrollmentListHandler,
    updateEnrollmentStatusHandler
} from "./enrollment.controller.js";


const router = Router();


/**
 * @route POST /courses/:courseId/enrollments
 * @description Creates an enrollment for a trainee in a course.
 * @access Trainee, Organisation Admin
 */
router.post(
    "/courses/:courseId/enrollments",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainee", "admin"),
    validateRequest(createEnrollmentSchema, {
        body: true,
        params: true
    }),
    createEnrollmentHandler
);


/**
 * @route GET /enrollments
 * @description Retrieves enrollments belonging to the active organisation.
 * @access Trainee, Trainer, Organisation Admin
 */
router.get(
    "/enrollments",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainee", "trainer", "admin"),
    validateRequest(listEnrollmentsQuerySchema, {
        query: true
    }),
    getEnrollmentListHandler
);


/**
 * @route GET /enrollments/:enrollmentId
 * @description Retrieves an enrollment by its ID.
 * @access Trainee, Trainer, Organisation Admin
 */
router.get(
    "/enrollments/:enrollmentId",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainee", "trainer", "admin"),
    validateRequest(enrollmentIdParamsSchema, {
        params: true
    }),
    getEnrollmentHandler
);


/**
 * @route PATCH /enrollments/:enrollmentId/status
 * @description Updates the status of an enrollment.
 * @access Trainee, Trainer, Organisation Admin
 */
router.patch(
    "/enrollments/:enrollmentId/status",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainee", "trainer", "admin"),
    validateRequest(updateEnrollmentStatusSchema, {
        body: true,
        params: true
    }),
    updateEnrollmentStatusHandler
);


export default router;