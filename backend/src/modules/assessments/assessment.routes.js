import { Router } from "express";

import {
    authenticate
} from "../auth/auth.middleware.js";

import {
    loadOrganizationMembership,
    authorizeRoles
} from "../auth/authorization.middleware.js";

import validateRequest from "../../middleware/validate.middleware.js";

import {
    createAssessmentSchema,
    updateAssessmentSchema,
    assessmentIdParamsSchema,
    listAssessmentsQuerySchema
} from "./assessment.validation.js";

import {
    startAssessmentAttemptSchema,
    assessmentAttemptIdParamsSchema,
    saveAssessmentAnswersSchema,
    submitAssessmentAttemptSchema,
    listAssessmentAttemptsQuerySchema
} from "./assessmentAttempt.validation.js";

import {
    createAssessmentHandler,
    getAssessmentHandler,
    listAssessmentsHandler,
    updateAssessmentHandler,
    publishAssessmentHandler,
    createAssessmentVersionHandler,
    archiveAssessmentHandler
} from "./assessment.controller.js";

import {
    startAssessmentAttemptHandler,
    getAssessmentAttemptHandler,
    saveAssessmentAnswersHandler,
    submitAssessmentAttemptHandler,
    listAssessmentAttemptsHandler
} from "./assessmentAttempt.controller.js";


const router = Router();


/**
 * @route POST /courses/:courseId/assessments
 * @description Creates a new draft assessment for a course.
 * @access Trainer, Organisation Admin
 */
router.post(
    "/courses/:courseId/assessments",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainer", "admin"),
    validateRequest(createAssessmentSchema, {
        body: true,
        params: true
    }),
    createAssessmentHandler
);


/**
 * @route GET /courses/:courseId/assessments
 * @description Retrieves assessments belonging to a course.
 * @access Trainer, Trainee, Organisation Admin
 */
router.get(
    "/courses/:courseId/assessments",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainer", "trainee", "admin"),
    validateRequest(listAssessmentsQuerySchema, {
        params: true,
        query: true
    }),
    listAssessmentsHandler
);


/**
 * @route GET /assessments/:assessmentId
 * @description Retrieves an assessment by its identifier.
 * @access Trainer, Trainee, Organisation Admin
 */
router.get(
    "/assessments/:assessmentId",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainer", "trainee", "admin"),
    validateRequest(assessmentIdParamsSchema, {
        params: true
    }),
    getAssessmentHandler
);


/**
 * @route PATCH /assessments/:assessmentId
 * @description Updates an existing draft assessment.
 * @access Trainer, Organisation Admin
 */
router.patch(
    "/assessments/:assessmentId",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainer", "admin"),
    validateRequest(updateAssessmentSchema, {
        body: true,
        params: true
    }),
    updateAssessmentHandler
);


/**
 * @route PATCH /assessments/:assessmentId/publish
 * @description Publishes a draft assessment.
 * @access Trainer, Organisation Admin
 */
router.patch(
    "/assessments/:assessmentId/publish",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainer", "admin"),
    validateRequest(assessmentIdParamsSchema, {
        params: true
    }),
    publishAssessmentHandler
);


/**
 * @route POST /assessments/:assessmentId/versions
 * @description Creates a new draft version of a published assessment.
 * @access Trainer, Organisation Admin
 */
router.post(
    "/assessments/:assessmentId/versions",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainer", "admin"),
    validateRequest(assessmentIdParamsSchema, {
        params: true
    }),
    createAssessmentVersionHandler
);


/**
 * @route PATCH /assessments/:assessmentId/archive
 * @description Archives a published assessment.
 * @access Trainer, Organisation Admin
 */
router.patch(
    "/assessments/:assessmentId/archive",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainer", "admin"),
    validateRequest(assessmentIdParamsSchema, {
        params: true
    }),
    archiveAssessmentHandler
);


/**
 * @route POST /assessments/:assessmentId/attempts
 * @description Starts or resumes a trainee's assessment attempt.
 * @access Trainee
 */
router.post(
    "/assessments/:assessmentId/attempts",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainee"),
    validateRequest(startAssessmentAttemptSchema, {
        params: true
    }),
    startAssessmentAttemptHandler
);


/**
 * @route GET /assessment-attempts
 * @description Retrieves assessment attempt history.
 * @access Trainee, Trainer, Organisation Admin
 */
router.get(
    "/assessment-attempts",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainee", "trainer", "admin"),
    validateRequest(listAssessmentAttemptsQuerySchema, {
        query: true
    }),
    listAssessmentAttemptsHandler
);


/**
 * @route GET /assessment-attempts/:attemptId
 * @description Retrieves an assessment attempt.
 * @access Trainee, Trainer, Organisation Admin
 */
router.get(
    "/assessment-attempts/:attemptId",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainee", "trainer", "admin"),
    validateRequest(assessmentAttemptIdParamsSchema, {
        params: true
    }),
    getAssessmentAttemptHandler
);


/**
 * @route PATCH /assessment-attempts/:attemptId/answers
 * @description Saves or updates answers in an active assessment attempt.
 * @access Trainee
 */
router.patch(
    "/assessment-attempts/:attemptId/answers",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainee"),
    validateRequest(saveAssessmentAnswersSchema, {
        body: true,
        params: true
    }),
    saveAssessmentAnswersHandler
);


/**
 * @route POST /assessment-attempts/:attemptId/submit
 * @description Submits and evaluates an assessment attempt.
 * @access Trainee
 */
router.post(
    "/assessment-attempts/:attemptId/submit",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainee"),
    validateRequest(submitAssessmentAttemptSchema, {
        params: true
    }),
    submitAssessmentAttemptHandler
);


export default router;