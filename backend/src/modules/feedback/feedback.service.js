import mongoose from "mongoose";

import {
    createFeedback,
    getFeedbackById,
    getFeedbackByCourseAndTrainee,
    getFeedbackRecords,
    updateFeedback
} from "./feedback.repository.js";

import { getCourse } from "../courses/course.service.js";

import Enrollment from "../enrollments/enrollment.model.js";
import OrganizationMembership from "../organizationMemberships/organizationMembership.model.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../core/constants/index.js";

import AppError from "../../core/errors/AppError.js";


/**
 * Creates a feedback-related application error.
 *
 * @param {string} message - Error message.
 * @param {number} statusCode - HTTP status code.
 * @param {string} code - Application error code.
 * @returns {AppError} Application error.
 */
const createFeedbackError = (
    message,
    statusCode,
    code
) => {
    return new AppError(message, statusCode, code);
};


/**
 * Validates a MongoDB ObjectId.
 *
 * @param {string} value - Identifier to validate.
 * @returns {boolean} Whether the identifier is valid.
 */
const isValidObjectId = (value) => {
    return mongoose.Types.ObjectId.isValid(value);
};


/**
 * Ensures the user has an approved trainee membership.
 *
 * @param {Object} params - Membership parameters.
 * @param {string} params.orgId - Organisation identifier.
 * @param {string} params.userId - User identifier.
 * @returns {Promise<Object>} Approved membership.
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
        throw createFeedbackError(
            "An approved trainee membership is required.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.RESOURCE_ACCESS_DENIED
        );
    }

    return membership;
};


/**
 * Submits feedback for a completed course.
 *
 * @param {Object} params - Feedback submission parameters.
 * @param {string} params.orgId - Organisation identifier.
 * @param {string} params.courseId - Course identifier.
 * @param {string} params.userId - Authenticated trainee identifier.
 * @param {number} params.rating - Rating between 1 and 5.
 * @param {string} [params.comment] - Optional feedback comment.
 * @returns {Promise<Object>} Created feedback record.
 */
export const submitCourseFeedback = async ({
    orgId,
    courseId,
    userId,
    rating,
    comment
}) => {
    if (
        !isValidObjectId(orgId) ||
        !isValidObjectId(courseId) ||
        !isValidObjectId(userId)
    ) {
        throw createFeedbackError(
            "Invalid feedback reference.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    await ensureApprovedTraineeMembership({
        orgId,
        userId
    });

    const course = await getCourse({
        orgId,
        courseId,
        userId,
        role: "trainee"
    });

    if (!course) {
        throw createFeedbackError(
            "Course not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    const enrollment = await Enrollment.findOne({
        org: orgId,
        course: courseId,
        trainee: userId,
        status: "completed"
    }).lean();

    if (!enrollment) {
        throw createFeedbackError(
            "Feedback can only be submitted after completing the course.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.RESOURCE_ACCESS_DENIED
        );
    }

    const existingFeedback = await getFeedbackByCourseAndTrainee({
        orgId,
        courseId,
        traineeId: userId
    });

    if (existingFeedback) {
        throw createFeedbackError(
            "Feedback has already been submitted for this course.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    try {
        return await createFeedback({
            org: orgId,
            course: courseId,
            enrollment: enrollment._id,
            trainee: userId,
            trainer: course.trainer,
            category: "course",
            rating,
            comment: comment || null
        });
    } catch (error) {
        if (error?.code === 11000) {
            throw createFeedbackError(
                "Feedback has already been submitted for this course.",
                HTTP_STATUS.CONFLICT,
                ERROR_CODES.RESOURCE_CONFLICT
            );
        }

        throw error;
    }
};


/**
 * Retrieves a feedback record within an organisation.
 *
 * @param {Object} params - Retrieval parameters.
 * @param {string} params.orgId - Organisation identifier.
 * @param {string} params.feedbackId - Feedback identifier.
 * @param {string} params.userId - Authenticated user identifier.
 * @param {string} params.role - Organisation membership role.
 * @returns {Promise<Object>} Feedback record.
 */
export const getCourseFeedback = async ({
    orgId,
    feedbackId,
    userId,
    role
}) => {
    if (
        !isValidObjectId(orgId) ||
        !isValidObjectId(feedbackId) ||
        !isValidObjectId(userId)
    ) {
        throw createFeedbackError(
            "Invalid feedback reference.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    const feedback = await getFeedbackById({
        orgId,
        feedbackId
    });

    if (!feedback) {
        throw createFeedbackError(
            "Feedback not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    if (role === "trainee" && String(feedback.trainee) !== String(userId)) {
        throw createFeedbackError(
            "You are not allowed to access this feedback.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.RESOURCE_ACCESS_DENIED
        );
    }

    if (role === "trainer" && String(feedback.trainer) !== String(userId)) {
        throw createFeedbackError(
            "You are not allowed to access this feedback.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.RESOURCE_ACCESS_DENIED
        );
    }

    return feedback;
};


/**
 * Lists feedback records according to the user's organisation role.
 *
 * @param {Object} params - Listing parameters.
 * @param {string} params.orgId - Organisation identifier.
 * @param {string} params.userId - Authenticated user identifier.
 * @param {string} params.role - Organisation membership role.
 * @param {Object} params.filters - Validated filters.
 * @param {Object} params.pagination - Pagination settings.
 * @param {Object} params.sort - Sorting settings.
 * @returns {Promise<Object>} Feedback records and pagination metadata.
 */
export const listCourseFeedback = async ({
    orgId,
    userId,
    role,
    filters = {},
    pagination = {},
    sort = {}
}) => {
    if (
        !isValidObjectId(orgId) ||
        !isValidObjectId(userId)
    ) {
        throw createFeedbackError(
            "Invalid feedback reference.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    const safeFilters = {
        ...filters
    };

    if (role === "trainee") {
        safeFilters.traineeId = userId;
        safeFilters.status = "submitted";
    }

    if (role === "trainer") {
        safeFilters.trainerId = userId;
        safeFilters.status = "submitted";
    }

    return getFeedbackRecords({
        orgId,
        filters: safeFilters,
        pagination,
        sort
    });
};


/**
 * Updates feedback visibility.
 *
 * Only organisation administrators can hide or restore feedback.
 *
 * @param {Object} params - Update parameters.
 * @param {string} params.orgId - Organisation identifier.
 * @param {string} params.feedbackId - Feedback identifier.
 * @param {string} params.userId - Authenticated administrator identifier.
 * @param {string} params.status - New feedback status.
 * @returns {Promise<Object>} Updated feedback record.
 */
export const updateCourseFeedbackStatus = async ({
    orgId,
    feedbackId,
    userId,
    status
}) => {
    if (
        !isValidObjectId(orgId) ||
        !isValidObjectId(feedbackId) ||
        !isValidObjectId(userId)
    ) {
        throw createFeedbackError(
            "Invalid feedback reference.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    const feedback = await getFeedbackById({
        orgId,
        feedbackId
    });

    if (!feedback) {
        throw createFeedbackError(
            "Feedback not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    return updateFeedback({
        orgId,
        feedbackId,
        updates: {
            status,
            statusUpdatedBy: userId,
            statusUpdatedAt: new Date()
        }
    });
};