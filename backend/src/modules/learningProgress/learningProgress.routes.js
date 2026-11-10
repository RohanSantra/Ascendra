import { Router } from "express";

import {
    authenticate
} from "../auth/auth.middleware.js";

import {
    loadOrganizationMembership
} from "../auth/authorization.middleware.js";

import {
    authorizeRoles
} from "../auth/authorization.middleware.js";

import validateRequest from "../../middleware/validate.middleware.js";

import {
    getLearningProgressParamsSchema,
    updateLearningProgressSchema,
    listLearningProgressQuerySchema,
    getCourseLearningProgressParamsSchema
} from "./learningProgress.validation.js";

import {
    getLearningProgressController,
    updateMaterialProgressController,
    listLearningProgressController,
    getCourseLearningProgressSummaryController
} from "./learningProgress.controller.js";


const router = Router();


/**
 * @route GET /courses/:courseId/materials/:materialId/progress
 * @description Retrieves or initializes a trainee's material progress.
 * @access Trainee
 */
router.get(
    "/courses/:courseId/materials/:materialId/progress",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainee"),
    validateRequest(getLearningProgressParamsSchema, {
        params: true
    }),
    getLearningProgressController
);


/**
 * @route PATCH /courses/:courseId/materials/:materialId/progress
 * @description Updates a trainee's material progress status.
 * @access Trainee
 */
router.patch(
    "/courses/:courseId/materials/:materialId/progress",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainee"),
    validateRequest(updateLearningProgressSchema, {
        params: true,
        body: true
    }),
    updateMaterialProgressController
);


/**
 * @route GET /courses/:courseId/learning-progress/summary
 * @description Retrieves a trainee's course-level learning progress summary.
 * @access Trainee
 */
router.get(
    "/courses/:courseId/learning-progress/summary",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainee"),
    validateRequest(getCourseLearningProgressParamsSchema, {
        params: true
    }),
    getCourseLearningProgressSummaryController
);


/**
 * @route GET /courses/:courseId/learning-progress
 * @description Retrieves learning progress records for a course.
 * @access Trainer, Admin, Trainee
 */
router.get(
    "/courses/:courseId/learning-progress",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin", "trainer", "trainee"),
    validateRequest(listLearningProgressQuerySchema, {
        params: true,
        query: true
    }),
    listLearningProgressController
);


export default router;