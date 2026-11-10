import mongoose from "mongoose";

import {
    getOrCreateLearningProgress,
    getLearningProgressByMaterial,
    getLearningProgressRecords,
    getLearningProgressSummary,
    updateLearningProgress
} from "./learningProgress.repository.js";

import {
    getCourseMaterialById
} from "../courseMaterials/courseMaterial.repository.js";

import {
    getCourse
} from "../courses/course.service.js";

import {
    getEnrollmentByCourseAndTrainee
} from "../enrollments/enrollment.repository.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../core/constants/index.js";

import AppError from "../../core/errors/AppError.js";


/**
 * Creates a standard learning progress application error.
 *
 * @param {string} message - Error message.
 * @param {number} statusCode - HTTP status code.
 * @param {string} code - Application error code.
 * @returns {AppError} Application error.
 */
const createProgressError = (
    message,
    statusCode,
    code
) => new AppError(message, statusCode, code);


/**
 * Validates a MongoDB ObjectId.
 *
 * @param {string} id - ObjectId value.
 * @returns {boolean} Whether the value is valid.
 */
const isValidObjectId = (id) =>
    mongoose.Types.ObjectId.isValid(id);


/**
 * Ensures that the requesting role is supported.
 *
 * @param {string} role - Organisation membership role.
 * @returns {void}
 */
const ensureSupportedRole = (role) => {
    if (!["admin", "trainer", "trainee"].includes(role)) {
        throw createProgressError(
            "You are not authorised to access learning progress.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.RESOURCE_ACCESS_DENIED
        );
    }
};


/**
 * Ensures that a course is accessible to the requesting user.
 *
 * @param {Object} params - Course access parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.courseId - Course ID.
 * @param {string} params.userId - Requesting user ID.
 * @param {string} params.role - Organisation membership role.
 * @returns {Promise<Object>} Accessible course.
 */
const ensureCourseAccess = async ({
    orgId,
    courseId,
    userId,
    role
}) => {
    const course = await getCourse({
        orgId,
        courseId,
        userId,
        role
    });

    if (!course) {
        throw createProgressError(
            "Course not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    return course;
};


/**
 * Ensures that the trainee has an eligible enrolment.
 *
 * @param {Object} params - Enrolment lookup parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.courseId - Course ID.
 * @param {string} params.traineeId - Trainee user ID.
 * @returns {Promise<Object>} Verified enrolment.
 */
const ensureEligibleEnrollment = async ({
    orgId,
    courseId,
    traineeId
}) => {
    const enrollment = await getEnrollmentByCourseAndTrainee({
        orgId,
        courseId,
        traineeId
    });

    if (
        !enrollment ||
        !["enrolled", "in_progress", "completed"].includes(
            enrollment.status
        )
    ) {
        throw createProgressError(
            "An active course enrolment is required to access learning progress.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.RESOURCE_ACCESS_DENIED
        );
    }

    return enrollment;
};


/**
 * Retrieves and verifies an active course material.
 *
 * @param {Object} params - Material lookup parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.courseId - Course ID.
 * @param {string} params.materialId - Material ID.
 * @returns {Promise<Object>} Verified course material.
 */
const ensureActiveMaterial = async ({
    orgId,
    courseId,
    materialId
}) => {
    const material = await getCourseMaterialById({
        orgId,
        courseId,
        materialId
    });

    if (!material || material.status !== "active") {
        throw createProgressError(
            "Course material not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    return material;
};


/**
 * Ensures that a trainee can access learning progress.
 *
 * @param {Object} params - Access parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.courseId - Course ID.
 * @param {string} params.materialId - Material ID.
 * @param {string} params.userId - Requesting user ID.
 * @param {string} params.role - Organisation membership role.
 * @returns {Promise<Object>} Verified course, material and enrolment.
 */
const ensureTraineeProgressAccess = async ({
    orgId,
    courseId,
    materialId,
    userId,
    role
}) => {
    const course = await ensureCourseAccess({
        orgId,
        courseId,
        userId,
        role
    });

    const material = await ensureActiveMaterial({
        orgId,
        courseId,
        materialId
    });

    const enrollment = await ensureEligibleEnrollment({
        orgId,
        courseId,
        traineeId: userId
    });

    return {
        course,
        material,
        enrollment
    };
};


/**
 * Retrieves learning progress for a specific material.
 *
 * A progress record is created automatically when a trainee
 * first accesses the material.
 *
 * @param {Object} params - Progress retrieval parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.courseId - Course ID.
 * @param {string} params.materialId - Material ID.
 * @param {string} params.userId - Requesting user ID.
 * @param {string} params.role - Organisation membership role.
 * @returns {Promise<Object>} Learning progress record.
 */
export const getLearningProgress = async ({
    orgId,
    courseId,
    materialId,
    userId,
    role
}) => {
    ensureSupportedRole(role);

    if (role !== "trainee") {
        throw createProgressError(
            "Individual learning progress can only be retrieved by the enrolled trainee.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.RESOURCE_ACCESS_DENIED
        );
    }

    if (
        !isValidObjectId(orgId) ||
        !isValidObjectId(courseId) ||
        !isValidObjectId(materialId) ||
        !isValidObjectId(userId)
    ) {
        throw createProgressError(
            "Invalid organisation, course, material or user identifier.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    const {
        enrollment
    } = await ensureTraineeProgressAccess({
        orgId,
        courseId,
        materialId,
        userId,
        role
    });

    const now = new Date();

    const progress = await getOrCreateLearningProgress({
        progressData: {
            org: orgId,
            course: courseId,
            enrollment: enrollment._id,
            trainee: userId,
            material: materialId,
            status: "not_started",
            startedAt: null,
            lastAccessedAt: now,
            completedAt: null
        }
    });

    return progress;
};


/**
 * Updates a trainee's learning progress for a material.
 *
 * The first transition to in_progress records startedAt.
 * Completing a material records completedAt.
 * Completed progress cannot be downgraded.
 *
 * @param {Object} params - Progress update parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.courseId - Course ID.
 * @param {string} params.materialId - Material ID.
 * @param {string} params.userId - Requesting user ID.
 * @param {string} params.role - Organisation membership role.
 * @param {string} params.status - Requested progress status.
 * @returns {Promise<Object>} Updated learning progress.
 */
export const updateMaterialProgress = async ({
    orgId,
    courseId,
    materialId,
    userId,
    role,
    status
}) => {
    ensureSupportedRole(role);

    if (role !== "trainee") {
        throw createProgressError(
            "Only trainees can update their own learning progress.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.RESOURCE_ACCESS_DENIED
        );
    }

    if (
        !isValidObjectId(orgId) ||
        !isValidObjectId(courseId) ||
        !isValidObjectId(materialId) ||
        !isValidObjectId(userId)
    ) {
        throw createProgressError(
            "Invalid organisation, course, material or user identifier.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    if (!["in_progress", "completed"].includes(status)) {
        throw createProgressError(
            "Invalid learning progress status.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    const {
        enrollment
    } = await ensureTraineeProgressAccess({
        orgId,
        courseId,
        materialId,
        userId,
        role
    });

    const now = new Date();

    const existingProgress = await getLearningProgressByMaterial({
        orgId,
        courseId,
        traineeId: userId,
        materialId
    });

    if (existingProgress?.status === "completed") {
        return existingProgress;
    }

    const progressData = {
        org: orgId,
        course: courseId,
        enrollment: enrollment._id,
        trainee: userId,
        material: materialId,
        status: "not_started",
        startedAt: null,
        lastAccessedAt: now,
        completedAt: null
    };

    await getOrCreateLearningProgress({
        progressData
    });

    const updates = {
        status,
        lastAccessedAt: now
    };

    if (status === "in_progress" && !existingProgress?.startedAt) {
        updates.startedAt = now;
    }

    if (status === "completed") {
        updates.startedAt = existingProgress?.startedAt || now;
        updates.completedAt = now;
    }

    const updatedProgress = await updateLearningProgress({
        orgId,
        courseId,
        traineeId: userId,
        materialId,
        updates
    });

    if (!updatedProgress) {
        const latestProgress = await getLearningProgressByMaterial({
            orgId,
            courseId,
            traineeId: userId,
            materialId
        });

        if (latestProgress?.status === "completed") {
            return latestProgress;
        }

        throw createProgressError(
            "Learning progress could not be updated.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    return updatedProgress;
};


/**
 * Lists learning progress records for a course.
 *
 * Trainees can only view their own progress.
 * Trainers and administrators can view progress for their
 * authorised courses.
 *
 * @param {Object} params - Progress listing parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.courseId - Course ID.
 * @param {string} params.userId - Requesting user ID.
 * @param {string} params.role - Organisation membership role.
 * @param {Object} [params.filters={}] - Progress filters.
 * @param {Object} [params.pagination={}] - Pagination configuration.
 * @param {Object} [params.sort={}] - Sorting configuration.
 * @returns {Promise<Object>} Progress records and pagination metadata.
 */
export const listLearningProgress = async ({
    orgId,
    courseId,
    userId,
    role,
    filters = {},
    pagination = {},
    sort = {}
}) => {
    ensureSupportedRole(role);

    if (
        !isValidObjectId(orgId) ||
        !isValidObjectId(courseId) ||
        !isValidObjectId(userId)
    ) {
        throw createProgressError(
            "Invalid organisation, course or user identifier.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    await ensureCourseAccess({
        orgId,
        courseId,
        userId,
        role
    });

    const safeFilters = {
        ...filters
    };

    if (role === "trainee") {
        safeFilters.traineeId = userId;
    } else if (
        safeFilters.traineeId &&
        !isValidObjectId(safeFilters.traineeId)
    ) {
        throw createProgressError(
            "Invalid trainee identifier.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    return getLearningProgressRecords({
        orgId,
        courseId,
        filters: safeFilters,
        pagination,
        sort
    });
};


/**
 * Retrieves a trainee's course-level learning progress summary.
 *
 * The summary includes active course materials only.
 * Materials without a progress record are counted as not started.
 *
 * @param {Object} params - Progress summary parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.courseId - Course ID.
 * @param {string} params.userId - Requesting trainee ID.
 * @param {string} params.role - Organisation membership role.
 * @returns {Promise<Object>} Course-level progress summary.
 */
export const getCourseLearningProgressSummary = async ({
    orgId,
    courseId,
    userId,
    role
}) => {
    ensureSupportedRole(role);

    if (role !== "trainee") {
        throw createProgressError(
            "Individual course progress summaries are only available to enrolled trainees.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.RESOURCE_ACCESS_DENIED
        );
    }

    if (
        !isValidObjectId(orgId) ||
        !isValidObjectId(courseId) ||
        !isValidObjectId(userId)
    ) {
        throw createProgressError(
            "Invalid organisation, course or user identifier.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    // Verify course access and the trainee's enrolment.
    await ensureCourseAccess({
        orgId,
        courseId,
        userId,
        role
    });

    await ensureEligibleEnrollment({
        orgId,
        courseId,
        traineeId: userId
    });

    return getLearningProgressSummary({
        orgId,
        courseId,
        traineeId: userId
    });
};