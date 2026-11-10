import mongoose from "mongoose";

import {
    createAssessment as insertAssessment,
    getAssessmentById,
    getAssessments,
    getLatestAssessmentVersion,
    updateAssessment,
    publishAssessment as publishAssessmentRecord,
    archiveAssessment as archiveAssessmentRecord
} from "./assessment.repository.js";

import {
    getCourse
} from "../courses/course.service.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../core/constants/index.js";

import AppError from "../../core/errors/AppError.js";


/**
 * Creates a standard assessment-related application error.
 *
 * @param {string} message - Error message.
 * @param {number} statusCode - HTTP status code.
 * @param {string} code - Application error code.
 * @returns {AppError} Application error.
 */
const createAssessmentError = (
    message,
    statusCode,
    code
) => {
    return new AppError(
        message,
        statusCode,
        code
    );
};


/**
 * Checks whether a value is a valid MongoDB ObjectId.
 *
 * @param {string} value - Identifier to validate.
 * @returns {boolean} Whether the identifier is valid.
 */
const isValidObjectId = (value) => {
    return mongoose.Types.ObjectId.isValid(value);
};


/**
 * Ensures the supplied role is supported by the assessment module.
 *
 * @param {string} role - Organisation membership role.
 * @returns {void}
 */
const ensureSupportedRole = (role) => {
    const supportedRoles = [
        "admin",
        "trainer",
        "trainee"
    ];

    if (!supportedRoles.includes(role)) {
        throw createAssessmentError(
            "You are not authorized to access assessments.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.RESOURCE_ACCESS_DENIED
        );
    }
};


/**
 * Ensures the user can manage assessment content.
 *
 * @param {string} role - Organisation membership role.
 * @returns {void}
 */
const ensureAssessmentManagementAccess = (role) => {
    if (!["admin", "trainer"].includes(role)) {
        throw createAssessmentError(
            "Only trainers and organisation administrators can manage assessments.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.RESOURCE_ACCESS_DENIED
        );
    }
};


/**
 * Verifies access to a course through the course service.
 *
 * @param {Object} params - Course access parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.courseId - Course ID.
 * @param {string} params.userId - User ID.
 * @param {string} params.role - Organisation membership role.
 * @returns {Promise<Object>} Accessible course.
 */
const ensureCourseAccess = async ({
    orgId,
    courseId,
    userId,
    role
}) => {
    if (
        !isValidObjectId(orgId) ||
        !isValidObjectId(courseId) ||
        !isValidObjectId(userId)
    ) {
        throw createAssessmentError(
            "Invalid organisation, course or user identifier.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    return getCourse({
        orgId,
        courseId,
        userId,
        role
    });
};


/**
 * Calculates the total marks for an assessment.
 *
 * @param {Array<Object>} questions - Assessment questions.
 * @returns {number} Total marks.
 */
const calculateTotalMarks = (questions) => {
    return questions.reduce(
        (total, question) => total + question.marks,
        0
    );
};


/**
 * Removes correct answers before returning assessment data to trainees.
 *
 * @param {Object} assessment - Assessment document.
 * @returns {Object} Sanitised assessment.
 */
const removeCorrectAnswers = (assessment) => {
    if (!assessment) {
        return assessment;
    }

    const sanitisedAssessment = {
        ...assessment
    };

    if (Array.isArray(sanitisedAssessment.questions)) {
        sanitisedAssessment.questions =
            sanitisedAssessment.questions.map((question) => {
                const sanitisedQuestion = {
                    ...question
                };

                delete sanitisedQuestion.correctOptionId;

                return sanitisedQuestion;
            });
    }

    return sanitisedAssessment;
};


/**
 * Creates a new independent draft assessment for a course.
 *
 * Each newly created assessment receives its own assessmentKey.
 * Subsequent versions retain that key.
 *
 * @param {Object} params - Assessment creation parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.courseId - Course ID.
 * @param {string} params.userId - Creating user ID.
 * @param {string} params.role - Organisation membership role.
 * @param {Object} params.assessmentData - Assessment content.
 * @returns {Promise<Object>} Created assessment.
 */
export const createAssessment = async ({
    orgId,
    courseId,
    userId,
    role,
    assessmentData
}) => {
    ensureSupportedRole(role);
    ensureAssessmentManagementAccess(role);

    const course = await ensureCourseAccess({
        orgId,
        courseId,
        userId,
        role
    });

    if (["cancelled", "archived"].includes(course.status)) {
        throw createAssessmentError(
            "Assessments cannot be created for a cancelled or archived course.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    const totalMarks = calculateTotalMarks(
        assessmentData.questions
    );

    try {
        return await insertAssessment({
            org: orgId,
            course: courseId,

            // A new independent assessment starts a new version series.
            assessmentKey: new mongoose.Types.ObjectId(),

            title: assessmentData.title,
            description: assessmentData.description,
            questions: assessmentData.questions,
            totalMarks,
            passingPercentage: assessmentData.passingPercentage,
            durationMinutes: assessmentData.durationMinutes,
            maxAttempts: assessmentData.maxAttempts,
            version: 1,
            status: "draft",
            createdBy: userId
        });
    } catch (error) {
        if (error?.code === 11000) {
            throw createAssessmentError(
                "An assessment version already exists for this assessment series.",
                HTTP_STATUS.CONFLICT,
                ERROR_CODES.RESOURCE_CONFLICT
            );
        }

        throw error;
    }
};


/**
 * Retrieves an assessment within an organisation.
 *
 * Trainers and administrators can retrieve correct answers.
 * Trainees never receive correct answers.
 *
 * @param {Object} params - Assessment retrieval parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.assessmentId - Assessment ID.
 * @param {string} params.userId - Requesting user ID.
 * @param {string} params.role - Organisation membership role.
 * @returns {Promise<Object>} Assessment.
 */
export const getAssessment = async ({
    orgId,
    assessmentId,
    userId,
    role
}) => {
    ensureSupportedRole(role);

    if (
        !isValidObjectId(orgId) ||
        !isValidObjectId(assessmentId) ||
        !isValidObjectId(userId)
    ) {
        throw createAssessmentError(
            "Invalid organisation, assessment or user identifier.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    const assessment = await getAssessmentById(
        {
            orgId,
            assessmentId
        },
        {
            includeCorrectAnswers: role !== "trainee"
        }
    );

    if (!assessment) {
        throw createAssessmentError(
            "Assessment not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    await ensureCourseAccess({
        orgId,
        courseId: assessment.course.toString(),
        userId,
        role
    });

    if (
        role === "trainee" &&
        assessment.status !== "published"
    ) {
        throw createAssessmentError(
            "This assessment is not available.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    return role === "trainee"
        ? removeCorrectAnswers(assessment)
        : assessment;
};


/**
 * Lists assessments within a course.
 *
 * Trainees can only retrieve published assessments.
 *
 * @param {Object} params - Assessment listing parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.courseId - Course ID.
 * @param {string} params.userId - Requesting user ID.
 * @param {string} params.role - Organisation membership role.
 * @param {Object} [params.filters={}] - Assessment filters.
 * @param {Object} [params.pagination={}] - Pagination configuration.
 * @param {Object} [params.sort={}] - Sorting configuration.
 * @returns {Promise<Object>} Assessment listing.
 */
export const listAssessments = async ({
    orgId,
    courseId,
    userId,
    role,
    filters = {},
    pagination = {},
    sort = {}
}) => {
    ensureSupportedRole(role);

    if (!courseId || !isValidObjectId(courseId)) {
        throw createAssessmentError(
            "A valid course identifier is required.",
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
        safeFilters.status = "published";
    }

    return getAssessments({
        orgId,
        courseId,
        filters: safeFilters,
        pagination,
        sort
    });
};


/**
 * Updates an existing draft assessment.
 *
 * Optimistic concurrency prevents updates based on stale versions.
 *
 * @param {Object} params - Assessment update parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.assessmentId - Assessment ID.
 * @param {string} params.userId - Requesting user ID.
 * @param {string} params.role - Organisation membership role.
 * @param {Object} params.updates - Fields to update.
 * @returns {Promise<Object>} Updated assessment.
 */
export const editAssessment = async ({
    orgId,
    assessmentId,
    userId,
    role,
    updates
}) => {
    ensureSupportedRole(role);
    ensureAssessmentManagementAccess(role);

    if (
        !isValidObjectId(orgId) ||
        !isValidObjectId(assessmentId) ||
        !isValidObjectId(userId)
    ) {
        throw createAssessmentError(
            "Invalid organisation, assessment or user identifier.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    const assessment = await getAssessmentById({
        orgId,
        assessmentId
    });

    if (!assessment) {
        throw createAssessmentError(
            "Assessment not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    await ensureCourseAccess({
        orgId,
        courseId: assessment.course.toString(),
        userId,
        role
    });

    if (assessment.status !== "draft") {
        throw createAssessmentError(
            "Only draft assessments can be edited.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    const safeUpdates = {};

    const allowedFields = [
        "title",
        "description",
        "passingPercentage",
        "durationMinutes",
        "maxAttempts",
        "questions"
    ];

    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            safeUpdates[field] = updates[field];
        }
    }

    if (safeUpdates.questions) {
        safeUpdates.totalMarks = calculateTotalMarks(
            safeUpdates.questions
        );
    }

    const updatedAssessment = await updateAssessment({
        orgId,
        assessmentId,
        expectedVersionKey: assessment.__v,
        updates: safeUpdates
    });

    if (!updatedAssessment) {
        throw createAssessmentError(
            "The assessment was modified by another request or is no longer editable. Reload and try again.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    return updatedAssessment;
};


/**
 * Publishes a draft assessment.
 *
 * The repository archives the previous published version in the same
 * assessment series within the publication transaction.
 *
 * @param {Object} params - Assessment publication parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.assessmentId - Assessment ID.
 * @param {string} params.userId - Requesting user ID.
 * @param {string} params.role - Organisation membership role.
 * @returns {Promise<Object>} Published assessment.
 */
export const publishAssessment = async ({
    orgId,
    assessmentId,
    userId,
    role
}) => {
    ensureSupportedRole(role);
    ensureAssessmentManagementAccess(role);

    if (
        !isValidObjectId(orgId) ||
        !isValidObjectId(assessmentId) ||
        !isValidObjectId(userId)
    ) {
        throw createAssessmentError(
            "Invalid organisation, assessment or user identifier.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    const assessment = await getAssessmentById({
        orgId,
        assessmentId
    });

    if (!assessment) {
        throw createAssessmentError(
            "Assessment not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    await ensureCourseAccess({
        orgId,
        courseId: assessment.course.toString(),
        userId,
        role
    });

    if (assessment.status !== "draft") {
        throw createAssessmentError(
            "Only draft assessments can be published.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    if (
        !Array.isArray(assessment.questions) ||
        assessment.questions.length === 0 ||
        assessment.totalMarks <= 0
    ) {
        throw createAssessmentError(
            "An assessment must contain valid questions and marks before publication.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    const publishedAssessment = await publishAssessmentRecord({
        orgId,
        assessmentId,
        expectedVersionKey: assessment.__v
    });

    if (!publishedAssessment) {
        throw createAssessmentError(
            "The assessment was modified by another request or is no longer publishable.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    return publishedAssessment;
};


/**
 * Creates a new draft version from the latest published assessment
 * in the same assessment series.
 *
 * The assessmentKey is preserved across all versions.
 *
 * @param {Object} params - Assessment version creation parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.assessmentId - Source assessment ID.
 * @param {string} params.userId - Requesting user ID.
 * @param {string} params.role - Organisation membership role.
 * @returns {Promise<Object>} Newly created draft assessment version.
 */
export const createAssessmentVersion = async ({
    orgId,
    assessmentId,
    userId,
    role
}) => {
    ensureSupportedRole(role);
    ensureAssessmentManagementAccess(role);

    if (
        !isValidObjectId(orgId) ||
        !isValidObjectId(assessmentId) ||
        !isValidObjectId(userId)
    ) {
        throw createAssessmentError(
            "Invalid organisation, assessment or user identifier.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    const currentAssessment = await getAssessmentById(
        {
            orgId,
            assessmentId
        },
        {
            includeCorrectAnswers: true
        }
    );

    if (!currentAssessment) {
        throw createAssessmentError(
            "Assessment not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    await ensureCourseAccess({
        orgId,
        courseId: currentAssessment.course.toString(),
        userId,
        role
    });

    if (currentAssessment.status !== "published") {
        throw createAssessmentError(
            "A new version can only be created from a published assessment.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    const latestAssessment = await getLatestAssessmentVersion({
        orgId,
        courseId: currentAssessment.course.toString(),
        assessmentKey: currentAssessment.assessmentKey
    });

    if (!latestAssessment) {
        throw createAssessmentError(
            "The assessment version history could not be found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    if (
        latestAssessment._id.toString() !==
        currentAssessment._id.toString()
    ) {
        throw createAssessmentError(
            "A new version must be created from the latest version in the assessment series.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    if (latestAssessment.status !== "published") {
        throw createAssessmentError(
            "The latest assessment version must be published before another version can be created.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    try {
        return await insertAssessment({
            org: currentAssessment.org,
            course: currentAssessment.course,
            assessmentKey: currentAssessment.assessmentKey,
            title: currentAssessment.title,
            description: currentAssessment.description,
            questions: currentAssessment.questions,
            totalMarks: currentAssessment.totalMarks,
            passingPercentage: currentAssessment.passingPercentage,
            durationMinutes: currentAssessment.durationMinutes,
            maxAttempts: currentAssessment.maxAttempts,
            version: latestAssessment.version + 1,
            status: "draft",
            createdBy: userId
        });
    } catch (error) {
        if (error?.code === 11000) {
            throw createAssessmentError(
                "A new version already exists for this assessment series.",
                HTTP_STATUS.CONFLICT,
                ERROR_CODES.RESOURCE_CONFLICT
            );
        }

        throw error;
    }
};


/**
 * Archives a published assessment.
 *
 * @param {Object} params - Assessment archive parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.assessmentId - Assessment ID.
 * @param {string} params.userId - Requesting user ID.
 * @param {string} params.role - Organisation membership role.
 * @returns {Promise<Object>} Archived assessment.
 */
export const archiveAssessment = async ({
    orgId,
    assessmentId,
    userId,
    role
}) => {
    ensureSupportedRole(role);
    ensureAssessmentManagementAccess(role);

    if (
        !isValidObjectId(orgId) ||
        !isValidObjectId(assessmentId) ||
        !isValidObjectId(userId)
    ) {
        throw createAssessmentError(
            "Invalid organisation, assessment or user identifier.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    const assessment = await getAssessmentById({
        orgId,
        assessmentId
    });

    if (!assessment) {
        throw createAssessmentError(
            "Assessment not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    await ensureCourseAccess({
        orgId,
        courseId: assessment.course.toString(),
        userId,
        role
    });

    if (assessment.status !== "published") {
        throw createAssessmentError(
            "Only published assessments can be archived.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    const archivedAssessment = await archiveAssessmentRecord({
        orgId,
        assessmentId,
        expectedVersionKey: assessment.__v
    });

    if (!archivedAssessment) {
        throw createAssessmentError(
            "The assessment was modified by another request or is no longer archivable.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    return archivedAssessment;
};