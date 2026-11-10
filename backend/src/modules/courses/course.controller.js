
import {
    createCourse,
    getCourse,
    listCourses,
    editCourse,
    transitionCourseStatus
} from "./course.service.js";

import ApiResponse from "../../core/responses/ApiResponse.js";

import { asyncHandler } from "../../core/utils/index.js";

/**
 * @name createCourseHandler
 * @description Creates a course from the authenticated trainer's assignment.
 */
export const createCourseHandler = asyncHandler(
    async (req, res) => {
        const course = await createCourse({
            orgId: req.user.orgId,
            trainerAssignmentId: req.validated.body.trainerAssignmentId,
            title: req.validated.body.title,
            description: req.validated.body.description,
            startDate: req.validated.body.startDate,
            endDate: req.validated.body.endDate,
            createdBy: req.user.userId
        });

        return ApiResponse.created(
            res,
            "Course created successfully.",
            course
        );
    }
);

/**
 * @name getCourseHandler
 * @description Retrieves a course by its ID.
 */
export const getCourseHandler = asyncHandler(
    async (req, res) => {
        const course = await getCourse({
            orgId: req.user.orgId,
            courseId: req.validated.params.id,
            userId: req.user.userId,
            role: req.organizationMembership.role
        });

        return ApiResponse.ok(
            res,
            "Course retrieved successfully.",
            course
        );
    }
);

/**
 * @name getCourseListHandler
 * @description Retrieves a paginated list of courses.
 */
export const getCourseListHandler = asyncHandler(
    async (req, res) => {
        const result = await listCourses({
            orgId: req.user.orgId,
            userId: req.user.userId,
            role: req.organizationMembership.role,
            filters: {
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
            "Courses retrieved successfully.",
            result.courses,
            result.pagination
        );
    }
);

/**
 * @name updateCourseHandler
 * @description Updates the information of a draft course.
 */
export const updateCourseHandler = asyncHandler(
    async (req, res) => {
        const course = await editCourse({
            orgId: req.user.orgId,
            courseId: req.validated.params.id,
            userId: req.user.userId,
            role: req.organizationMembership.role,
            updates: req.validated.body
        });

        return ApiResponse.ok(
            res,
            "Course updated successfully.",
            course
        );
    }
);

/**
 * @name transitionCourseStatusHandler
 * @description Changes the lifecycle status of a course.
 */
export const transitionCourseStatusHandler = asyncHandler(
    async (req, res) => {
        const course = await transitionCourseStatus({
            orgId: req.user.orgId,
            courseId: req.validated.params.id,
            userId: req.user.userId,
            role: req.organizationMembership.role,
            status: req.validated.body.status
        });

        return ApiResponse.ok(
            res,
            "Course status updated successfully.",
            course
        );
    }
);
