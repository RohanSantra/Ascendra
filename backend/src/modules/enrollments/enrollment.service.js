import mongoose from "mongoose";

import {
    createEnrollment as insertEnrollment,
    getEnrollmentById,
    getEnrollmentByCourseAndTrainee,
    getEnrollments,
    updateEnrollment
} from "./enrollment.repository.js";

import { getCourseById } from "../courses/course.repository.js";

import OrganizationMembership from "../organizationMemberships/organizationMembership.model.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../core/constants/index.js";

import AppError from "../../core/errors/AppError.js";


/**
 * Creates a standardized enrollment error.
 *
 * @param {string} message - Error message.
 * @param {number} statusCode - HTTP status code.
 * @param {string} errorCode - Application error code.
 * @returns {AppError} Standardized application error.
 */
const createEnrollmentError = (
    message,
    statusCode,
    errorCode
) => new AppError(message, statusCode, errorCode);


/**
 * Validates and normalizes a MongoDB ObjectId.
 *
 * @param {string} value - ObjectId value.
 * @param {string} fieldName - Name of the identifier.
 * @returns {string} Normalized ObjectId.
 * @throws {AppError} When the identifier is invalid.
 */
const validateObjectId = (value, fieldName) => {
    if (!mongoose.isValidObjectId(value)) {
        throw createEnrollmentError(
            `Invalid ${fieldName}.`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    return String(value);
};


/**
 * Normalizes an ObjectId or populated document reference.
 *
 * @param {Object|string} value - Reference value.
 * @returns {string|null} Normalized identifier.
 */
const getReferenceId = (value) => {
    if (!value) {
        return null;
    }

    return String(value._id || value);
};


/**
 * Verifies that a user has an approved membership
 * with the specified role in the requested organisation.
 *
 * @param {Object} params - Membership lookup parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.userId - User ID.
 * @param {string} params.role - Required membership role.
 * @returns {Promise<Object>} Approved organisation membership.
 * @throws {AppError} When the membership is not approved.
 */
const ensureApprovedMembership = async ({
    orgId,
    userId,
    role
}) => {
    const membership = await OrganizationMembership.findOne({
        org: orgId,
        user: userId,
        role,
        status: "approved"
    }).lean();

    if (!membership) {
        throw createEnrollmentError(
            `An approved ${role} membership is required in this organisation.`,
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.FORBIDDEN
        );
    }

    return membership;
};


/**
 * Verifies that a user has an approved trainee membership
 * in the requested organisation.
 *
 * @param {Object} params - Membership lookup parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.traineeId - Trainee user ID.
 * @returns {Promise<Object>} Approved trainee membership.
 * @throws {AppError} When the user is not an eligible trainee.
 */
const getApprovedTraineeMembership = async ({
    orgId,
    traineeId
}) => {
    return ensureApprovedMembership({
        orgId,
        userId: traineeId,
        role: "trainee"
    });
};


/**
 * Retrieves a course and verifies that it belongs to
 * the requested organisation.
 *
 * Only published courses accept new enrollments.
 *
 * @param {Object} params - Course lookup parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.courseId - Course ID.
 * @returns {Promise<Object>} Verified course document.
 * @throws {AppError} When the course does not exist or is unavailable.
 */
const getAvailableCourse = async ({
    orgId,
    courseId
}) => {
    const course = await getCourseById({
        orgId,
        courseId
    });

    if (!course) {
        throw createEnrollmentError(
            "Course not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    if (course.status !== "published") {
        throw createEnrollmentError(
            "Enrollments are only available for published courses.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    return course;
};


/**
 * Verifies whether the requesting user can manage
 * enrollments for a particular course.
 *
 * Organisation administrators can manage all courses
 * within their organisation.
 *
 * Trainers can manage enrollments only for their own courses.
 *
 * @param {Object} params - Authorization parameters.
 * @param {Object} params.course - Course document.
 * @param {string} params.userId - Requesting user ID.
 * @param {string} params.role - Organisation membership role.
 * @throws {AppError} When the requester cannot manage enrollments.
 */
const ensureEnrollmentManagementAccess = ({
    course,
    userId,
    role
}) => {
    if (role === "admin") {
        return;
    }

    const courseTrainerId = getReferenceId(course.trainer);

    if (
        role === "trainer" &&
        courseTrainerId === String(userId)
    ) {
        return;
    }

    throw createEnrollmentError(
        "You are not authorized to manage enrollments for this course.",
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.FORBIDDEN
    );
};


/**
 * Validates an organisation membership role.
 *
 * @param {string} role - Membership role.
 * @returns {void}
 * @throws {AppError} When the role is unsupported.
 */
const ensureSupportedEnrollmentRole = (role) => {
    if (!["admin", "trainer", "trainee"].includes(role)) {
        throw createEnrollmentError(
            "You are not authorized to access enrollments.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.FORBIDDEN
        );
    }
};


/**
 * Creates a course enrollment.
 *
 * Trainees may enroll themselves in published courses.
 * Organisation administrators may enroll eligible trainees
 * on their behalf.
 *
 * Existing enrollment records are retained after withdrawal
 * or cancellation. A second record cannot be created for
 * the same trainee and course.
 *
 * @param {Object} params - Enrollment creation parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.courseId - Course ID.
 * @param {string} params.traineeId - Trainee user ID.
 * @param {string} params.requestedBy - Requesting user ID.
 * @param {string} params.role - Requester's organisation role.
 * @returns {Promise<Object>} Created enrollment.
 */
export const createCourseEnrollment = async ({
    orgId,
    courseId,
    traineeId,
    requestedBy,
    role
}) => {
    orgId = validateObjectId(orgId, "organisation ID");
    courseId = validateObjectId(courseId, "course ID");
    traineeId = validateObjectId(traineeId, "trainee ID");
    requestedBy = validateObjectId(
        requestedBy,
        "requesting user ID"
    );

    ensureSupportedEnrollmentRole(role);

    const isSelfEnrollment =
        role === "trainee" &&
        String(requestedBy) === String(traineeId);

    const isAdminEnrollment = role === "admin";

    if (!isSelfEnrollment && !isAdminEnrollment) {
        throw createEnrollmentError(
            "Only trainees can enroll themselves, and organisation administrators can enroll trainees on their behalf.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.FORBIDDEN
        );
    }

    /**
     * Verify the requesting administrator when enrollment
     * is being created on behalf of a trainee.
     */
    if (isAdminEnrollment) {
        await ensureApprovedMembership({
            orgId,
            userId: requestedBy,
            role: "admin"
        });
    }

    const course = await getAvailableCourse({
        orgId,
        courseId
    });

    await getApprovedTraineeMembership({
        orgId,
        traineeId
    });

    const existingEnrollment = await getEnrollmentByCourseAndTrainee({
        orgId,
        courseId,
        traineeId
    });

    if (existingEnrollment) {
        throw createEnrollmentError(
            "This trainee already has an enrollment record for the course.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    try {
        return await insertEnrollment({
            org: orgId,
            course: course._id,
            trainee: traineeId,
            status: "enrolled",
            enrolledAt: new Date()
        });
    } catch (error) {
        if (error?.code === 11000) {
            throw createEnrollmentError(
                "This trainee already has an enrollment record for the course.",
                HTTP_STATUS.CONFLICT,
                ERROR_CODES.RESOURCE_CONFLICT
            );
        }

        throw error;
    }
};


/**
 * Retrieves an enrollment by ID.
 *
 * The enrollment must belong to the active organisation.
 *
 * Trainees can retrieve only their own enrollments.
 * Trainers can retrieve enrollments for their own courses.
 * Administrators can retrieve any organisation enrollment.
 *
 * @param {Object} params - Enrollment lookup parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.enrollmentId - Enrollment ID.
 * @param {string} params.userId - Requesting user ID.
 * @param {string} params.role - Requester's organisation role.
 * @returns {Promise<Object>} Enrollment document.
 */
export const getCourseEnrollment = async ({
    orgId,
    enrollmentId,
    userId,
    role
}) => {
    orgId = validateObjectId(orgId, "organisation ID");
    enrollmentId = validateObjectId(enrollmentId, "enrollment ID");
    userId = validateObjectId(userId, "requesting user ID");

    ensureSupportedEnrollmentRole(role);

    await ensureApprovedMembership({
        orgId,
        userId,
        role
    });

    const enrollment = await getEnrollmentById({
        orgId,
        enrollmentId
    });

    if (!enrollment) {
        throw createEnrollmentError(
            "Enrollment not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    if (
        role === "trainee" &&
        getReferenceId(enrollment.trainee) !== userId
    ) {
        throw createEnrollmentError(
            "You are not authorized to access this enrollment.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.FORBIDDEN
        );
    }

    if (role === "trainer") {
        const course = await getCourseById({
            orgId,
            courseId: getReferenceId(enrollment.course)
        });

        if (
            !course ||
            getReferenceId(course.trainer) !== userId
        ) {
            throw createEnrollmentError(
                "You are not authorized to access this enrollment.",
                HTTP_STATUS.FORBIDDEN,
                ERROR_CODES.FORBIDDEN
            );
        }
    }

    return enrollment;
};


/**
 * Lists enrollments within an organisation.
 *
 * Administrators can list all organisation enrollments.
 * Trainers can list enrollments for their own courses.
 * Trainees can retrieve only their own enrollments.
 *
 * @param {Object} params - Enrollment listing parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} [params.courseId] - Optional course ID.
 * @param {string} [params.traineeId] - Optional trainee ID.
 * @param {string} params.userId - Requesting user ID.
 * @param {string} params.role - Requester's organisation role.
 * @param {Object} [params.filters={}] - Enrollment filters.
 * @param {Object} [params.pagination={}] - Pagination settings.
 * @param {Object} [params.sort={}] - Sorting settings.
 * @returns {Promise<Object>} Enrollment records and pagination metadata.
 */
export const listCourseEnrollments = async ({
    orgId,
    courseId,
    traineeId,
    userId,
    role,
    filters = {},
    pagination = {},
    sort = {}
}) => {
    orgId = validateObjectId(orgId, "organisation ID");
    userId = validateObjectId(userId, "requesting user ID");

    ensureSupportedEnrollmentRole(role);

    await ensureApprovedMembership({
        orgId,
        userId,
        role
    });

    const query = {
        orgId,
        filters,
        pagination,
        sort
    };

    if (courseId) {
        courseId = validateObjectId(courseId, "course ID");

        const course = await getCourseById({
            orgId,
            courseId
        });

        if (!course) {
            throw createEnrollmentError(
                "Course not found.",
                HTTP_STATUS.NOT_FOUND,
                ERROR_CODES.RESOURCE_NOT_FOUND
            );
        }

        if (role === "trainer" || role === "admin") {
            ensureEnrollmentManagementAccess({
                course,
                userId,
                role
            });
        }
    }

    if (role === "trainee") {
        /**
         * Trainees cannot use the query parameter to retrieve
         * another user's enrollment records.
         */
        query.traineeId = userId;
    } else if (traineeId) {
        query.traineeId = validateObjectId(
            traineeId,
            "trainee ID"
        );
    }

    if (role === "trainer" && !courseId) {
        throw createEnrollmentError(
            "Trainers must specify a course when listing enrollments.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    return getEnrollments({
        ...query,
        courseId
    });
};


/**
 * Updates an enrollment's lifecycle status.
 *
 * Permitted transitions:
 *
 * enrolled -> in_progress
 * enrolled -> withdrawn
 * enrolled -> cancelled
 * in_progress -> completed
 * in_progress -> withdrawn
 * in_progress -> cancelled
 *
 * Trainees can start or withdraw from their own enrollments.
 * Course trainers and organisation administrators can complete
 * or cancel enrollments.
 *
 * The final update is conditional on the original status,
 * preventing concurrent requests from overwriting transitions.
 *
 * @param {Object} params - Enrollment update parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.enrollmentId - Enrollment ID.
 * @param {string} params.status - Requested target status.
 * @param {string} params.userId - Requesting user ID.
 * @param {string} params.role - Requester's organisation role.
 * @returns {Promise<Object>} Updated enrollment.
 */
export const updateCourseEnrollmentStatus = async ({
    orgId,
    enrollmentId,
    status,
    userId,
    role
}) => {
    orgId = validateObjectId(orgId, "organisation ID");
    enrollmentId = validateObjectId(enrollmentId, "enrollment ID");
    userId = validateObjectId(userId, "requesting user ID");

    ensureSupportedEnrollmentRole(role);

    await ensureApprovedMembership({
        orgId,
        userId,
        role
    });

    const enrollment = await getEnrollmentById({
        orgId,
        enrollmentId
    });

    if (!enrollment) {
        throw createEnrollmentError(
            "Enrollment not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    const isTraineeOwner =
        role === "trainee" &&
        getReferenceId(enrollment.trainee) === userId;

    if (role === "trainee" && !isTraineeOwner) {
        throw createEnrollmentError(
            "You are not authorized to update this enrollment.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.FORBIDDEN
        );
    }

    const course = await getCourseById({
        orgId,
        courseId: getReferenceId(enrollment.course)
    });

    if (!course) {
        throw createEnrollmentError(
            "The associated course could not be found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    const isCourseTrainer =
        role === "trainer" &&
        getReferenceId(course.trainer) === userId;

    const isAdmin = role === "admin";

    const allowedTransitions = {
        enrolled: [
            "in_progress",
            "withdrawn",
            "cancelled"
        ],
        in_progress: [
            "completed",
            "withdrawn",
            "cancelled"
        ],
        completed: [],
        withdrawn: [],
        cancelled: []
    };

    if (!allowedTransitions[enrollment.status]?.includes(status)) {
        throw createEnrollmentError(
            `Cannot change enrollment status from '${enrollment.status}' to '${status}'.`,
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    if (status === "in_progress" || status === "withdrawn") {
        if (!isTraineeOwner) {
            throw createEnrollmentError(
                "Only the enrolled trainee can start or withdraw from this enrollment.",
                HTTP_STATUS.FORBIDDEN,
                ERROR_CODES.FORBIDDEN
            );
        }
    }

    if (status === "completed" || status === "cancelled") {
        if (!isAdmin && !isCourseTrainer) {
            throw createEnrollmentError(
                "Only the course trainer or organisation administrator can complete or cancel this enrollment.",
                HTTP_STATUS.FORBIDDEN,
                ERROR_CODES.FORBIDDEN
            );
        }

        if (role === "trainer" && !isCourseTrainer) {
            throw createEnrollmentError(
                "You can only update enrollments for your own courses.",
                HTTP_STATUS.FORBIDDEN,
                ERROR_CODES.FORBIDDEN
            );
        }
    }

    const updates = {
        status
    };

    const transitionTime = new Date();

    if (status === "in_progress") {
        updates.startedAt = transitionTime;
    }

    if (status === "completed") {
        updates.completedAt = transitionTime;
    }

    if (status === "withdrawn") {
        updates.withdrawnAt = transitionTime;
    }

    if (status === "cancelled") {
        updates.cancelledAt = transitionTime;
    }

    const updatedEnrollment = await updateEnrollment({
        orgId,
        enrollmentId,
        expectedStatus: enrollment.status,
        updates
    });

    if (!updatedEnrollment) {
        throw createEnrollmentError(
            "The enrollment was modified by another request. Please refresh and try again.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    return updatedEnrollment;
};