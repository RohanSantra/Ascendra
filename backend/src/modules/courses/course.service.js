import mongoose from "mongoose";

import {
    createCourse as insertCourse,
    getCourseById,
    getCourseByTrainerAssignment,
    getCourses,
    updateCourse,
    updateCourseStatus
} from "./course.repository.js";

import {
    getTrainerAssignmentById
} from "../trainerAssignments/trainerAssignment.repository.js";

import Enrollment from "../enrollments/enrollment.model.js";

import OrganizationMembership from "../organizationMemberships/organizationMembership.model.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../core/constants/index.js";

import AppError from "../../core/errors/AppError.js";


/**
 * Creates a standardized course error.
 *
 * @param {string} message - Error message.
 * @param {number} statusCode - HTTP status code.
 * @param {string} code - Application error code.
 * @returns {AppError} Standardized application error.
 */
const createCourseError = (message, statusCode, code) => {
    return new AppError(message, statusCode, code);
};


/**
 * Converts an ObjectId or populated document into a string ID.
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
 * Validates a MongoDB ObjectId.
 *
 * @param {string} value - Identifier to validate.
 * @param {string} fieldName - Name of the identifier.
 * @returns {string} Validated identifier.
 * @throws {AppError} When the identifier is invalid.
 */
const validateObjectId = (value, fieldName) => {
    if (!mongoose.isValidObjectId(value)) {
        throw createCourseError(
            `Invalid ${fieldName}.`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    return String(value);
};


/**
 * Checks whether a user is allowed to manage a course.
 *
 * Trainers may manage only their own courses.
 * Organisation administrators may manage all courses
 * belonging to their organisation.
 *
 * Trainees cannot manage course information or lifecycle status.
 *
 * @param {Object} params - Authorization parameters.
 * @param {Object} params.course - Course document.
 * @param {string} params.userId - Requesting user ID.
 * @param {string} params.role - Organisation membership role.
 * @throws {AppError} When the user cannot manage the course.
 */
const ensureCourseOwnership = ({
    course,
    userId,
    role
}) => {
    if (role === "admin") {
        return;
    }

    if (
        role !== "trainer" ||
        getReferenceId(course.trainer) !== String(userId)
    ) {
        throw createCourseError(
            "You are not authorized to manage this course.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.FORBIDDEN
        );
    }
};


/**
 * Verifies that a trainee has an approved membership
 * in the requested organisation.
 *
 * @param {Object} params - Membership lookup parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.userId - Trainee user ID.
 * @returns {Promise<Object>} Approved membership.
 * @throws {AppError} When the trainee membership is unavailable.
 */
const ensureApprovedTraineeMembership = async ({
    orgId,
    userId
}) => {
    const membership = await OrganizationMembership.findOne({
        org: orgId,
        user: userId,
        role: "trainee",
        status: "approved"
    }).lean();

    if (!membership) {
        throw createCourseError(
            "An approved trainee membership is required to access this course.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.FORBIDDEN
        );
    }

    return membership;
};


/**
 * Verifies that a trainee has an eligible enrollment
 * for the requested course.
 *
 * Enrolled, in-progress and completed enrollments retain
 * course access.
 *
 * Withdrawn and cancelled enrollments do not grant access.
 *
 * @param {Object} params - Enrollment lookup parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.courseId - Course ID.
 * @param {string} params.userId - Trainee user ID.
 * @returns {Promise<Object>} Eligible enrollment.
 * @throws {AppError} When the trainee has no eligible enrollment.
 */
const ensureTraineeEnrollment = async ({
    orgId,
    courseId,
    userId
}) => {
    const enrollment = await Enrollment.findOne({
        org: orgId,
        course: courseId,
        trainee: userId,
        status: {
            $in: [
                "enrolled",
                "in_progress",
                "completed"
            ]
        }
    }).lean();

    if (!enrollment) {
        throw createCourseError(
            "An active course enrollment is required to access this course.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.FORBIDDEN
        );
    }

    return enrollment;
};


/**
 * Checks whether a trainee is allowed to access a course.
 *
 * Trainees must have an approved organisation membership,
 * an eligible enrollment and a course that is available
 * for learning.
 *
 * @param {Object} params - Course access parameters.
 * @param {Object} params.course - Course document.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.userId - Trainee user ID.
 * @returns {Promise<void>}
 * @throws {AppError} When trainee access is not permitted.
 */
const ensureTraineeCourseAccess = async ({
    course,
    orgId,
    userId
}) => {
    await ensureApprovedTraineeMembership({
        orgId,
        userId
    });

    await ensureTraineeEnrollment({
        orgId,
        courseId: course._id,
        userId
    });

    if (
        ![
            "published",
            "ongoing",
            "completed"
        ].includes(course.status)
    ) {
        throw createCourseError(
            "This course is not currently available for learning.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.FORBIDDEN
        );
    }
};


/**
 * Retrieves a trainer assignment and verifies its organisation.
 *
 * @param {Object} params - Assignment lookup parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.assignmentId - Trainer assignment ID.
 * @returns {Promise<Object>} Verified trainer assignment.
 * @throws {AppError} When the assignment does not exist.
 */
const getVerifiedTrainerAssignment = async ({
    orgId,
    assignmentId
}) => {
    if (!mongoose.isValidObjectId(assignmentId)) {
        throw createCourseError(
            "Invalid trainer assignment ID.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    const assignment = await getTrainerAssignmentById({
        orgId,
        assignmentId
    });

    if (!assignment) {
        throw createCourseError(
            "Trainer assignment not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    return assignment;
};


/**
 * Creates a course from an existing trainer assignment.
 *
 * The trainer, trainer profile and requirement references
 * are derived from the verified assignment.
 *
 * A trainer can create a course only from their own
 * active assignment.
 *
 * @param {Object} params - Course creation parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.trainerAssignmentId - Assignment ID.
 * @param {string} params.title - Course title.
 * @param {string} [params.description] - Course description.
 * @param {Date|string} params.startDate - Course start date.
 * @param {Date|string} params.endDate - Course end date.
 * @param {string} params.createdBy - Creator user ID.
 * @returns {Promise<Object>} Created course.
 */
export const createCourse = async ({
    orgId,
    trainerAssignmentId,
    title,
    description,
    startDate,
    endDate,
    createdBy
}) => {
    const assignment = await getVerifiedTrainerAssignment({
        orgId,
        assignmentId: trainerAssignmentId
    });

    if (
        !["assigned", "in_progress"].includes(assignment.status)
    ) {
        throw createCourseError(
            "A course can only be created from an active trainer assignment.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    if (String(assignment.trainer) !== String(createdBy)) {
        throw createCourseError(
            "You can only create courses from your own trainer assignments.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.FORBIDDEN
        );
    }

    const existingCourse = await getCourseByTrainerAssignment({
        orgId,
        trainerAssignmentId
    });

    if (existingCourse) {
        throw createCourseError(
            "A course already exists for this trainer assignment.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);

    if (
        Number.isNaN(parsedStartDate.getTime()) ||
        Number.isNaN(parsedEndDate.getTime()) ||
        parsedEndDate < parsedStartDate
    ) {
        throw createCourseError(
            "Course end date cannot be earlier than its start date.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    try {
        return await insertCourse({
            org: orgId,
            title,
            description,
            trainer: assignment.trainer,
            trainerProfile: assignment.trainerProfile,
            trainerAssignment: assignment._id,
            requirement: assignment.requirement,
            startDate: parsedStartDate,
            endDate: parsedEndDate,
            status: "draft",
            createdBy
        });
    } catch (error) {
        if (error?.code === 11000) {
            throw createCourseError(
                "A course already exists for this trainer assignment.",
                HTTP_STATUS.CONFLICT,
                ERROR_CODES.RESOURCE_CONFLICT
            );
        }

        throw error;
    }
};


/**
 * Retrieves a course by ID.
 *
 * Administrators can access all courses in their organisation.
 * Trainers can access only their own courses.
 * Trainees must have an approved membership and eligible enrollment.
 *
 * @param {Object} params - Course lookup parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.courseId - Course ID.
 * @param {string} params.userId - Requesting user ID.
 * @param {string} params.role - Organisation membership role.
 * @returns {Promise<Object>} Course document.
 * @throws {AppError} When the course is unavailable or inaccessible.
 */
export const getCourse = async ({
    orgId,
    courseId,
    userId,
    role
}) => {
    orgId = validateObjectId(orgId, "organisation ID");
    courseId = validateObjectId(courseId, "course ID");
    userId = validateObjectId(userId, "user ID");

    const course = await getCourseById({
        orgId,
        courseId
    });

    if (!course) {
        throw createCourseError(
            "Course not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    if (role === "trainee") {
        await ensureTraineeCourseAccess({
            course,
            orgId,
            userId
        });

        return course;
    }

    ensureCourseOwnership({
        course,
        userId,
        role
    });

    return course;
};


/**
 * Retrieves courses with pagination and filters.
 *
 * Trainer queries are automatically restricted to the
 * authenticated trainer's own courses.
 *
 * Trainee queries are restricted to published courses
 * within their approved organisation.
 *
 * Administrators can list courses within their organisation.
 *
 * @param {Object} params - Course listing parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.userId - Requesting user ID.
 * @param {string} params.role - Organisation membership role.
 * @param {Object} [params.filters] - Course filters.
 * @param {Object} [params.pagination] - Pagination settings.
 * @param {Object} [params.sort] - Sorting settings.
 * @returns {Promise<Object>} Course records and pagination metadata.
 */
export const listCourses = async ({
    orgId,
    userId,
    role,
    filters = {},
    pagination = {},
    sort = {}
}) => {
    orgId = validateObjectId(orgId, "organisation ID");
    userId = validateObjectId(userId, "user ID");

    const safeFilters = {
        status: filters.status
    };

    if (role === "trainer") {
        safeFilters.trainerId = userId;
    } else if (role === "trainee") {
        await ensureApprovedTraineeMembership({
            orgId,
            userId
        });

        safeFilters.status = "published";
    } else if (role !== "admin") {
        throw createCourseError(
            "You are not authorized to list courses.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.FORBIDDEN
        );
    }

    return getCourses({
        orgId,
        filters: safeFilters,
        pagination,
        sort
    });
};


/**
 * Updates course information.
 *
 * Only the owning trainer or an organisation administrator
 * can update a course.
 *
 * General course information can only be changed while
 * the course is in draft status.
 *
 * @param {Object} params - Course update parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.courseId - Course ID.
 * @param {string} params.userId - Requesting user ID.
 * @param {string} params.role - Organisation membership role.
 * @param {Object} params.updates - Fields to update.
 * @returns {Promise<Object>} Updated course.
 */
export const editCourse = async ({
    orgId,
    courseId,
    userId,
    role,
    updates
}) => {
    const course = await getCourseById({
        orgId,
        courseId
    });

    if (!course) {
        throw createCourseError(
            "Course not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    ensureCourseOwnership({
        course,
        userId,
        role
    });

    if (course.status !== "draft") {
        throw createCourseError(
            "Only draft courses can be edited.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    const nextStartDate = updates.startDate
        ? new Date(updates.startDate)
        : new Date(course.startDate);

    const nextEndDate = updates.endDate
        ? new Date(updates.endDate)
        : new Date(course.endDate);

    if (
        Number.isNaN(nextStartDate.getTime()) ||
        Number.isNaN(nextEndDate.getTime()) ||
        nextEndDate < nextStartDate
    ) {
        throw createCourseError(
            "Course end date cannot be earlier than its start date.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    const safeUpdates = {
        ...(updates.title !== undefined && {
            title: updates.title
        }),
        ...(updates.description !== undefined && {
            description: updates.description
        }),
        ...(updates.startDate !== undefined && {
            startDate: nextStartDate
        }),
        ...(updates.endDate !== undefined && {
            endDate: nextEndDate
        })
    };

    const updatedCourse = await updateCourse({
        orgId,
        courseId,
        updates: safeUpdates
    });

    if (!updatedCourse) {
        throw createCourseError(
            "Course could not be updated.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    return updatedCourse;
};


/**
 * Defines permitted course lifecycle transitions.
 *
 * draft      -> published, cancelled
 * published  -> ongoing, cancelled
 * ongoing    -> completed, cancelled
 * completed  -> archived
 * cancelled  -> archived
 *
 * @name COURSE_TRANSITIONS
 */
const COURSE_TRANSITIONS = {
    draft: ["published", "cancelled"],
    published: ["ongoing", "cancelled"],
    ongoing: ["completed", "cancelled"],
    completed: ["archived"],
    cancelled: ["archived"],
    archived: []
};


/**
 * Changes a course lifecycle status.
 *
 * Only the owning trainer or an organisation administrator
 * can perform a lifecycle transition.
 *
 * @param {Object} params - Course status parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.courseId - Course ID.
 * @param {string} params.userId - Requesting user ID.
 * @param {string} params.role - Organisation membership role.
 * @param {string} params.status - Requested status.
 * @returns {Promise<Object>} Updated course.
 */
export const transitionCourseStatus = async ({
    orgId,
    courseId,
    userId,
    role,
    status
}) => {
    const course = await getCourseById({
        orgId,
        courseId
    });

    if (!course) {
        throw createCourseError(
            "Course not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    ensureCourseOwnership({
        course,
        userId,
        role
    });

    const allowedTransitions =
        COURSE_TRANSITIONS[course.status] || [];

    if (!allowedTransitions.includes(status)) {
        throw createCourseError(
            `Cannot change course status from '${course.status}' to '${status}'.`,
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    const updatedCourse = await updateCourseStatus({
        orgId,
        courseId,
        status
    });

    if (!updatedCourse) {
        throw createCourseError(
            "Course status could not be updated.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    return updatedCourse;
};