import {
    submitCourseFeedback,
    getCourseFeedback,
    listCourseFeedback,
    updateCourseFeedbackStatus
} from "./feedback.service.js";

import ApiResponse from "../../core/responses/ApiResponse.js";
import asyncHandler from "../../core/utils/asyncHandler.js";


/**
 * Submits feedback for a completed course.
 *
 * @route POST /courses/:courseId/feedback
 * @description Allows a trainee to submit course feedback.
 * @access Trainee
 */
export const submitCourseFeedbackController = asyncHandler(
    async (req, res) => {
        const feedback = await submitCourseFeedback({
            orgId: req.user.orgId,
            courseId: req.validated.params.courseId,
            userId: req.user.userId,
            ...req.validated.body
        });

        return ApiResponse.created(
            res,
            "Course feedback submitted successfully.",
            feedback
        );
    }
);


/**
 * Retrieves a feedback record.
 *
 * @route GET /feedback/:feedbackId
 * @description Retrieves feedback according to the user's organisation role.
 * @access Organisation Admin, Trainer, Trainee
 */
export const getCourseFeedbackController = asyncHandler(
    async (req, res) => {
        const feedback = await getCourseFeedback({
            orgId: req.user.orgId,
            feedbackId: req.validated.params.feedbackId,
            userId: req.user.userId,
            role: req.organizationMembership.role
        });

        return ApiResponse.ok(
            res,
            "Feedback retrieved successfully.",
            feedback
        );
    }
);


/**
 * Lists feedback records.
 *
 * @route GET /feedback
 * @description Retrieves organisation-scoped feedback records.
 * @access Organisation Admin, Trainer, Trainee
 */
export const listCourseFeedbackController = asyncHandler(
    async (req, res) => {
        const result = await listCourseFeedback({
            orgId: req.user.orgId,
            userId: req.user.userId,
            role: req.organizationMembership.role,
            filters: {
                courseId: req.validated.query.courseId,
                trainerId: req.validated.query.trainerId,
                traineeId: req.validated.query.traineeId,
                status: req.validated.query.status
            },
            pagination: {
                page: req.validated.query.page,
                limit: req.validated.query.limit
            },
            sort: {
                sortBy: req.validated.query.sortBy,
                sortOrder: req.validated.query.sortOrder
            }
        });

        return ApiResponse.ok(
            res,
            "Feedback records retrieved successfully.",
            result.data,
            result.meta
        );
    }
);


/**
 * Updates feedback visibility.
 *
 * @route PATCH /feedback/:feedbackId/status
 * @description Allows an organisation administrator to hide or restore feedback.
 * @access Organisation Admin
 */
export const updateCourseFeedbackStatusController = asyncHandler(
    async (req, res) => {
        const feedback = await updateCourseFeedbackStatus({
            orgId: req.user.orgId,
            feedbackId: req.validated.params.feedbackId,
            userId: req.user.userId,
            status: req.validated.body.status
        });

        return ApiResponse.ok(
            res,
            "Feedback status updated successfully.",
            feedback
        );
    }
);