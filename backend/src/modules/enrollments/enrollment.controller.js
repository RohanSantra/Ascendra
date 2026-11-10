import {
    createCourseEnrollment,
    getCourseEnrollment,
    listCourseEnrollments,
    updateCourseEnrollmentStatus
} from "./enrollment.service.js";

import ApiResponse from "../../core/responses/ApiResponse.js";

import asyncHandler from "../../core/utils/asyncHandler.js";


/**
 * Retrieves the authenticated organisation context.
 *
 * @param {Object} req - Express request object.
 * @returns {{orgId: string, userId: string, role: string}} Organisation context.
 */
const getEnrollmentRequestContext = (req) => {
    const orgId = req.user?.orgId;
    const userId = req.user?.userId;
    const role = req.organizationMembership?.role;

    if (!orgId || !userId || !role) {
        throw new Error(
            "Authenticated organisation context is missing."
        );
    }

    return {
        orgId,
        userId,
        role
    };
};


/**
 * Creates a course enrollment.
 *
 * Trainees enroll themselves.
 * Organisation administrators enroll eligible trainees
 * by supplying their trainee ID.
 *
 * @route POST /courses/:courseId/enrollments
 * @description Creates an enrollment for a published course.
 * @access Trainee, Organisation Admin
 */
export const createEnrollmentHandler = asyncHandler(
    async (req, res) => {
        const {
            orgId,
            userId,
            role
        } = getEnrollmentRequestContext(req);

        const traineeId = role === "trainee"
            ? userId
            : req.validated.body.traineeId;

        const enrollment = await createCourseEnrollment({
            orgId,
            courseId: req.validated.params.courseId,
            traineeId,
            requestedBy: userId,
            role
        });

        return ApiResponse.created(
            res,
            "Course enrollment created successfully.",
            enrollment
        );
    }
);


/**
 * Retrieves an enrollment by its ID.
 *
 * @route GET /enrollments/:enrollmentId
 * @description Retrieves an organisation-scoped enrollment.
 * @access Trainee, Trainer, Organisation Admin
 */
export const getEnrollmentHandler = asyncHandler(
    async (req, res) => {
        const {
            orgId,
            userId,
            role
        } = getEnrollmentRequestContext(req);

        const enrollment = await getCourseEnrollment({
            orgId,
            enrollmentId: req.validated.params.enrollmentId,
            userId,
            role
        });

        return ApiResponse.ok(
            res,
            "Enrollment retrieved successfully.",
            enrollment
        );
    }
);


/**
 * Lists enrollments within the active organisation.
 *
 * Supports course-specific listing, trainee-specific listing,
 * filtering, sorting and pagination.
 *
 * @route GET /enrollments
 * @description Retrieves organisation-scoped enrollment records.
 * @access Trainee, Trainer, Organisation Admin
 */
export const getEnrollmentListHandler = asyncHandler(
    async (req, res) => {
        const {
            orgId,
            userId,
            role
        } = getEnrollmentRequestContext(req);

        const enrollments = await listCourseEnrollments({
            orgId,
            userId,
            role,
            courseId: req.validated.query.courseId,
            traineeId: req.validated.query.traineeId,
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
            "Enrollments retrieved successfully.",
            enrollments.data,
            enrollments.meta
        );
    }
);


/**
 * Updates an enrollment's lifecycle status.
 *
 * The service enforces permitted transitions and verifies
 * whether the requester can perform the requested transition.
 *
 * @route PATCH /enrollments/:enrollmentId/status
 * @description Updates an enrollment lifecycle status.
 * @access Trainee, Trainer, Organisation Admin
 */
export const updateEnrollmentStatusHandler = asyncHandler(
    async (req, res) => {
        const {
            orgId,
            userId,
            role
        } = getEnrollmentRequestContext(req);

        const enrollment = await updateCourseEnrollmentStatus({
            orgId,
            enrollmentId: req.validated.params.enrollmentId,
            status: req.validated.body.status,
            userId,
            role
        });

        return ApiResponse.ok(
            res,
            "Enrollment status updated successfully.",
            enrollment
        );
    }
);