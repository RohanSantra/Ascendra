import {
    startAssessmentAttempt,
    getAssessmentAttempt,
    saveAssessmentAnswers,
    submitAssessmentAttempt,
    listAssessmentAttempts
} from "./assessmentAttempt.service.js";

import ApiResponse from "../../core/responses/ApiResponse.js";
import asyncHandler from "../../core/utils/asyncHandler.js";


/**
 * Starts a new assessment attempt or resumes an existing one.
 *
 * @route POST /assessments/:assessmentId/attempts
 * @access Trainee
 */
export const startAssessmentAttemptHandler = asyncHandler(
    async (req, res) => {
        const attempt = await startAssessmentAttempt({
            orgId: req.user.orgId,
            assessmentId: req.validated.params.assessmentId,
            userId: req.user.userId,
            role: req.organizationMembership.role
        });

        return ApiResponse.created(
            res,
            "Assessment attempt started successfully.",
            attempt
        );
    }
);


/**
 * Retrieves an assessment attempt.
 *
 * @route GET /assessment-attempts/:attemptId
 * @access Trainee, Trainer, Organisation Admin
 */
export const getAssessmentAttemptHandler = asyncHandler(
    async (req, res) => {
        const attempt = await getAssessmentAttempt({
            orgId: req.user.orgId,
            attemptId: req.validated.params.attemptId,
            userId: req.user.userId,
            role: req.organizationMembership.role
        });

        return ApiResponse.ok(
            res,
            "Assessment attempt retrieved successfully.",
            attempt
        );
    }
);


/**
 * Saves or updates trainee answers.
 *
 * @route PATCH /assessment-attempts/:attemptId/answers
 * @access Trainee
 */
export const saveAssessmentAnswersHandler = asyncHandler(
    async (req, res) => {
        const attempt = await saveAssessmentAnswers({
            orgId: req.user.orgId,
            attemptId: req.validated.params.attemptId,
            userId: req.user.userId,
            role: req.organizationMembership.role,
            answers: req.validated.body.answers
        });

        return ApiResponse.ok(
            res,
            "Assessment answers saved successfully.",
            attempt
        );
    }
);


/**
 * Submits and evaluates an assessment attempt.
 *
 * @route POST /assessment-attempts/:attemptId/submit
 * @access Trainee
 */
export const submitAssessmentAttemptHandler = asyncHandler(
    async (req, res) => {
        const attempt = await submitAssessmentAttempt({
            orgId: req.user.orgId,
            attemptId: req.validated.params.attemptId,
            userId: req.user.userId,
            role: req.organizationMembership.role
        });

        return ApiResponse.ok(
            res,
            "Assessment submitted and evaluated successfully.",
            attempt
        );
    }
);


/**
 * Retrieves assessment attempt history.
 *
 * @route GET /assessment-attempts
 * @access Trainee, Trainer, Organisation Admin
 */
export const listAssessmentAttemptsHandler = asyncHandler(
    async (req, res) => {
        const {
            assessmentId,
            courseId,
            traineeId,
            status,
            page,
            limit,
            sortBy,
            sortOrder
        } = req.validated.query;

        const result = await listAssessmentAttempts({
            orgId: req.user.orgId,
            userId: req.user.userId,
            role: req.organizationMembership.role,
            assessmentId,
            courseId,
            traineeId,
            filters: {
                status
            },
            pagination: {
                page,
                limit
            },
            sort: {
                sortBy,
                sortOrder
            }
        });

        return ApiResponse.ok(
            res,
            "Assessment attempts retrieved successfully.",
            result.data,
            result.meta
        );
    }
);