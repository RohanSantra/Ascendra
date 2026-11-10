import {
    getLearningProgress,
    updateMaterialProgress,
    listLearningProgress,
    getCourseLearningProgressSummary
} from "./learningProgress.service.js";

import ApiResponse from "../../core/responses/ApiResponse.js";
import asyncHandler from "../../core/utils/asyncHandler.js";


/**
 * Retrieves a trainee's progress for a course material.
 *
 * @route GET /courses/:courseId/materials/:materialId/progress
 * @description Retrieves or initializes the trainee's material progress.
 * @access Trainee
 */
export const getLearningProgressController = asyncHandler(
    async (req, res) => {
        const progress = await getLearningProgress({
            orgId: req.user.orgId,
            courseId: req.validated.params.courseId,
            materialId: req.validated.params.materialId,
            userId: req.user.userId,
            role: req.organizationMembership.role
        });

        return ApiResponse.ok(
            res,
            "Learning progress retrieved successfully.",
            progress
        );
    }
);


/**
 * Updates a trainee's progress for a course material.
 *
 * @route PATCH /courses/:courseId/materials/:materialId/progress
 * @description Updates the trainee's material progress status.
 * @access Trainee
 */
export const updateMaterialProgressController = asyncHandler(
    async (req, res) => {
        const progress = await updateMaterialProgress({
            orgId: req.user.orgId,
            courseId: req.validated.params.courseId,
            materialId: req.validated.params.materialId,
            userId: req.user.userId,
            role: req.organizationMembership.role,
            status: req.validated.body.status
        });

        return ApiResponse.ok(
            res,
            "Learning progress updated successfully.",
            progress
        );
    }
);


/**
 * Lists learning progress records for a course.
 *
 * @route GET /courses/:courseId/learning-progress
 * @description Retrieves course learning progress with pagination and filters.
 * @access Trainer, Admin, Trainee
 */
export const listLearningProgressController = asyncHandler(
    async (req, res) => {
        const {
            traineeId,
            status,
            page,
            limit,
            sortBy,
            sortOrder
        } = req.validated.query;

        const result = await listLearningProgress({
            orgId: req.user.orgId,
            courseId: req.validated.params.courseId,
            userId: req.user.userId,
            role: req.organizationMembership.role,

            filters: {
                traineeId,
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
            "Learning progress records retrieved successfully.",
            result.data,
            result.meta
        );
    }
);


/**
 * Retrieves a trainee's course-level learning progress summary.
 *
 * @route GET /courses/:courseId/learning-progress/summary
 * @description Retrieves completed, in-progress and not-started material counts.
 * @access Trainee
 */
export const getCourseLearningProgressSummaryController = asyncHandler(
    async (req, res) => {
        const summary = await getCourseLearningProgressSummary({
            orgId: req.user.orgId,
            courseId: req.validated.params.courseId,
            userId: req.user.userId,
            role: req.organizationMembership.role
        });

        return ApiResponse.ok(
            res,
            "Course learning progress summary retrieved successfully.",
            summary
        );
    }
);