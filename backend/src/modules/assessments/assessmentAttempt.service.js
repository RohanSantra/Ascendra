import mongoose from "mongoose";

import {
    createAssessmentAttempt,
    getAssessmentAttemptById,
    getInProgressAssessmentAttempt,
    countAssessmentAttempts,
    getAssessmentAttempts,
    saveAssessmentAnswers as saveAssessmentAnswersRecord,
    updateAssessmentAttempt
} from "./assessmentAttempt.repository.js";

import {
    getAssessmentById
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
 * Creates a standard assessment-attempt application error.
 *
 * @param {string} message - Error message.
 * @param {number} statusCode - HTTP status code.
 * @param {string} code - Application error code.
 * @returns {AppError} Application error.
 */
const createAttemptError = (
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
 * Ensures the caller has a supported organisation role.
 *
 * @param {string} role - Organisation membership role.
 * @returns {void}
 */
const ensureSupportedRole = (role) => {
    if (!["admin", "trainer", "trainee"].includes(role)) {
        throw createAttemptError(
            "You are not authorised to access assessment attempts.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.RESOURCE_ACCESS_DENIED
        );
    }
};


/**
 * Retrieves a course after applying existing course access rules.
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
    if (
        !isValidObjectId(orgId) ||
        !isValidObjectId(courseId) ||
        !isValidObjectId(userId)
    ) {
        throw createAttemptError(
            "Invalid organisation, course or user identifier.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    const course = await getCourse({
        orgId,
        courseId,
        userId,
        role
    });

    if (!course) {
        throw createAttemptError(
            "Course not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    return course;
};


/**
 * Removes correct answers from an attempt snapshot.
 *
 * Trainees may see their assessment questions and options,
 * but must never receive the correct option identifiers.
 *
 * @param {Object} attempt - Assessment attempt.
 * @returns {Object} Sanitised attempt.
 */
const sanitiseAttempt = (attempt) => {
    if (!attempt) {
        return attempt;
    }

    const safeAttempt = {
        ...attempt
    };

    if (
        safeAttempt.assessmentSnapshot &&
        Array.isArray(safeAttempt.assessmentSnapshot.questions)
    ) {
        safeAttempt.assessmentSnapshot = {
            ...safeAttempt.assessmentSnapshot,

            questions: safeAttempt.assessmentSnapshot.questions.map(
                (question) => {
                    const safeQuestion = { ...question };
                    delete safeQuestion.correctOptionId;

                    return safeQuestion;
                }
            )
        };
    }

    return safeAttempt;
};


/**
 * Retrieves an attempt snapshot with its answer keys.
 *
 * This helper is intended only for trusted server-side grading
 * and answer validation.
 *
 * @param {Object} params - Attempt lookup parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.attemptId - Attempt ID.
 * @returns {Promise<Object>} Attempt containing its snapshot.
 */
const getAttemptWithSnapshot = async ({
    orgId,
    attemptId
}) => {
    const attempt = await getAssessmentAttemptById(
        {
            orgId,
            attemptId
        },
        {
            includeSnapshot: true
        }
    );

    if (!attempt) {
        throw createAttemptError(
            "Assessment attempt not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    return attempt;
};


/**
 * Validates answer records against an immutable assessment snapshot.
 *
 * @param {Array<Object>} answers - Submitted answer records.
 * @param {Object} snapshot - Assessment snapshot.
 * @returns {void}
 */
const validateAnswersAgainstSnapshot = (
    answers,
    snapshot
) => {
    const questionsById = new Map(
        snapshot.questions.map((question) => [
            question.questionId,
            question
        ])
    );

    for (const answer of answers) {
        const question = questionsById.get(answer.questionId);

        if (!question) {
            throw createAttemptError(
                `Question ${answer.questionId} does not belong to this assessment attempt.`,
                HTTP_STATUS.BAD_REQUEST,
                ERROR_CODES.VALIDATION_ERROR
            );
        }

        if (answer.selectedOptionId !== null) {
            const optionExists = question.options.some(
                (option) =>
                    option.optionId === answer.selectedOptionId
            );

            if (!optionExists) {
                throw createAttemptError(
                    `Selected option does not belong to question ${answer.questionId}.`,
                    HTTP_STATUS.BAD_REQUEST,
                    ERROR_CODES.VALIDATION_ERROR
                );
            }
        }
    }
};


/**
 * Calculates the score for an assessment attempt.
 *
 * Unanswered questions receive zero marks.
 *
 * @param {Object} attempt - Attempt containing snapshot and answers.
 * @returns {Object} Calculated score and percentage.
 */
const evaluateAttempt = (attempt) => {
    const questions = attempt.assessmentSnapshot.questions;

    const answersByQuestionId = new Map(
        attempt.answers.map((answer) => [
            answer.questionId,
            answer.selectedOptionId
        ])
    );

    let score = 0;

    for (const question of questions) {
        const selectedOptionId = answersByQuestionId.get(
            question.questionId
        );

        if (
            selectedOptionId &&
            selectedOptionId === question.correctOptionId
        ) {
            score += question.marks;
        }
    }

    const totalMarks = attempt.assessmentSnapshot.totalMarks;

    const percentage = totalMarks > 0
        ? Number(((score / totalMarks) * 100).toFixed(2))
        : 0;

    return {
        score: Number(score.toFixed(2)),
        totalMarks,
        percentage
    };
};


/**
 * Marks an overdue in-progress attempt as expired.
 *
 * @param {Object} params - Expiry parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.attemptId - Attempt ID.
 * @returns {Promise<Object>} Expired attempt.
 */
const markAttemptExpired = async ({
    orgId,
    attemptId
}) => {
    const expiredAttempt = await updateAssessmentAttempt({
        orgId,
        attemptId,
        expectedStatus: "in_progress",
        updates: {
            status: "expired"
        }
    });

    if (expiredAttempt) {
        return expiredAttempt;
    }

    const latestAttempt = await getAssessmentAttemptById({
        orgId,
        attemptId
    });

    if (latestAttempt?.status === "expired") {
        return latestAttempt;
    }

    throw createAttemptError(
        "The assessment attempt could not be expired because its status has changed.",
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.RESOURCE_CONFLICT
    );
};


/**
 * Starts a new assessment attempt.
 *
 * An existing unexpired attempt is returned instead of creating
 * another one. Expired attempts count towards the attempt limit.
 *
 * Attempt numbering is protected by the unique attempt-number index.
 *
 * @param {Object} params - Attempt creation parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.assessmentId - Assessment ID.
 * @param {string} params.userId - Trainee user ID.
 * @param {string} params.role - Organisation membership role.
 * @returns {Promise<Object>} Created or resumed attempt.
 */
export const startAssessmentAttempt = async ({
    orgId,
    assessmentId,
    userId,
    role
}) => {
    ensureSupportedRole(role);

    if (role !== "trainee") {
        throw createAttemptError(
            "Only trainees can start assessment attempts.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.RESOURCE_ACCESS_DENIED
        );
    }

    if (
        !isValidObjectId(orgId) ||
        !isValidObjectId(assessmentId) ||
        !isValidObjectId(userId)
    ) {
        throw createAttemptError(
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
        throw createAttemptError(
            "Assessment not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    if (assessment.status !== "published") {
        throw createAttemptError(
            "Only published assessments can be attempted.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    await ensureCourseAccess({
        orgId,
        courseId: assessment.course.toString(),
        userId,
        role
    });

    const existingAttempt = await getInProgressAssessmentAttempt({
        orgId,
        assessmentId,
        traineeId: userId
    });

    if (existingAttempt) {
        if (existingAttempt.expiresAt > new Date()) {
            return sanitiseAttempt(
                await getAssessmentAttemptById(
                    {
                        orgId,
                        attemptId: existingAttempt._id.toString()
                    },
                    {
                        includeSnapshot: true
                    }
                )
            );
        }

        await markAttemptExpired({
            orgId,
            attemptId: existingAttempt._id.toString()
        });
    }

    const attemptCount = await countAssessmentAttempts({
        orgId,
        assessmentId,
        traineeId: userId
    });

    if (attemptCount >= assessment.maxAttempts) {
        throw createAttemptError(
            "You have reached the maximum number of attempts for this assessment.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    const now = new Date();

    const expiresAt = new Date(
        now.getTime() +
        assessment.durationMinutes * 60 * 1000
    );

    const snapshot = await getAssessmentById(
        {
            orgId,
            assessmentId
        },
        {
            includeCorrectAnswers: true
        }
    );

    if (!snapshot) {
        throw createAttemptError(
            "Assessment could not be retrieved.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    const attemptData = {
        org: orgId,
        assessment: assessment._id,
        course: assessment.course,
        trainee: userId,
        attemptNumber: attemptCount + 1,
        assessmentVersion: assessment.version,

        assessmentSnapshot: {
            title: snapshot.title,
            description: snapshot.description,
            questions: snapshot.questions,
            totalMarks: snapshot.totalMarks,
            passingPercentage: snapshot.passingPercentage,
            durationMinutes: snapshot.durationMinutes
        },

        answers: [],
        score: null,
        totalMarks: snapshot.totalMarks,
        percentage: null,
        status: "in_progress",
        startedAt: now,
        expiresAt
    };

    try {
        const attempt = await createAssessmentAttempt(attemptData);

        const populatedAttempt = await getAssessmentAttemptById(
            {
                orgId,
                attemptId: attempt._id.toString()
            },
            {
                includeSnapshot: true
            }
        );

        return sanitiseAttempt(populatedAttempt);
    } catch (error) {
        if (error?.code === 11000) {
            throw createAttemptError(
                "An assessment attempt was started concurrently. Retrieve your current attempt and try again.",
                HTTP_STATUS.CONFLICT,
                ERROR_CODES.RESOURCE_CONFLICT
            );
        }

        throw error;
    }
};


/**
 * Retrieves an assessment attempt.
 *
 * Trainees can only retrieve their own attempts.
 * Trainers and administrators must have access to the associated course.
 *
 * @param {Object} params - Attempt retrieval parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.attemptId - Attempt ID.
 * @param {string} params.userId - Requesting user ID.
 * @param {string} params.role - Organisation membership role.
 * @returns {Promise<Object>} Assessment attempt.
 */
export const getAssessmentAttempt = async ({
    orgId,
    attemptId,
    userId,
    role
}) => {
    ensureSupportedRole(role);

    if (
        !isValidObjectId(orgId) ||
        !isValidObjectId(attemptId) ||
        !isValidObjectId(userId)
    ) {
        throw createAttemptError(
            "Invalid organisation, attempt or user identifier.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    const attempt = await getAttemptWithSnapshot({
        orgId,
        attemptId
    });

    if (role === "trainee" && attempt.trainee.toString() !== userId) {
        throw createAttemptError(
            "Assessment attempt not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    await ensureCourseAccess({
        orgId,
        courseId: attempt.course.toString(),
        userId,
        role
    });

    if (
        attempt.status === "in_progress" &&
        attempt.expiresAt <= new Date()
    ) {
        const expiredAttempt = await markAttemptExpired({
            orgId,
            attemptId
        });

        return sanitiseAttempt({
            ...attempt,
            status: expiredAttempt.status
        });
    }

    return sanitiseAttempt(attempt);
};


/**
 * Saves trainee answers for an in-progress assessment attempt.
 *
 * The repository performs the answer merge atomically. Only answers
 * included in the request are changed; other answers are preserved.
 *
 * @param {Object} params - Answer-saving parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.attemptId - Attempt ID.
 * @param {string} params.userId - Trainee user ID.
 * @param {string} params.role - Organisation membership role.
 * @param {Array<Object>} params.answers - Submitted answer records.
 * @returns {Promise<Object>} Updated attempt.
 */
export const saveAssessmentAnswers = async ({
    orgId,
    attemptId,
    userId,
    role,
    answers
}) => {
    ensureSupportedRole(role);

    if (role !== "trainee") {
        throw createAttemptError(
            "Only trainees can save assessment answers.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.RESOURCE_ACCESS_DENIED
        );
    }

    if (
        !isValidObjectId(orgId) ||
        !isValidObjectId(attemptId) ||
        !isValidObjectId(userId)
    ) {
        throw createAttemptError(
            "Invalid organisation, attempt or user identifier.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    const attempt = await getAttemptWithSnapshot({
        orgId,
        attemptId
    });

    if (attempt.trainee.toString() !== userId) {
        throw createAttemptError(
            "Assessment attempt not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    await ensureCourseAccess({
        orgId,
        courseId: attempt.course.toString(),
        userId,
        role
    });

    if (attempt.status !== "in_progress") {
        throw createAttemptError(
            "Answers cannot be changed after an assessment attempt has ended.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    if (attempt.expiresAt <= new Date()) {
        await markAttemptExpired({
            orgId,
            attemptId
        });

        throw createAttemptError(
            "The assessment attempt has expired.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    validateAnswersAgainstSnapshot(
        answers,
        attempt.assessmentSnapshot
    );

    const updatedAttempt = await saveAssessmentAnswersRecord({
        orgId,
        attemptId,
        answers,
        now: new Date()
    });

    if (!updatedAttempt) {
        throw createAttemptError(
            "The assessment attempt expired or ended while saving answers. Retrieve the latest attempt.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    const latestAttempt = await getAssessmentAttemptById(
        {
            orgId,
            attemptId
        },
        {
            includeSnapshot: true
        }
    );

    return sanitiseAttempt(latestAttempt);
};


/**
 * Submits and automatically evaluates an assessment attempt.
 *
 * Submission first changes the attempt status from in_progress
 * to submitted. This atomic transition prevents further answer saves.
 *
 * The server then retrieves the locked attempt and evaluates its
 * immutable snapshot. Client-submitted scores are never accepted.
 *
 * @param {Object} params - Submission parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.attemptId - Attempt ID.
 * @param {string} params.userId - Trainee user ID.
 * @param {string} params.role - Organisation membership role.
 * @returns {Promise<Object>} Evaluated assessment attempt.
 */
export const submitAssessmentAttempt = async ({
    orgId,
    attemptId,
    userId,
    role
}) => {
    ensureSupportedRole(role);

    if (role !== "trainee") {
        throw createAttemptError(
            "Only trainees can submit assessment attempts.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.RESOURCE_ACCESS_DENIED
        );
    }

    if (
        !isValidObjectId(orgId) ||
        !isValidObjectId(attemptId) ||
        !isValidObjectId(userId)
    ) {
        throw createAttemptError(
            "Invalid organisation, attempt or user identifier.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    const attempt = await getAttemptWithSnapshot({
        orgId,
        attemptId
    });

    if (attempt.trainee.toString() !== userId) {
        throw createAttemptError(
            "Assessment attempt not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    await ensureCourseAccess({
        orgId,
        courseId: attempt.course.toString(),
        userId,
        role
    });

    if (attempt.status !== "in_progress") {
        throw createAttemptError(
            "This assessment attempt has already ended.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    if (attempt.expiresAt <= new Date()) {
        await markAttemptExpired({
            orgId,
            attemptId
        });

        throw createAttemptError(
            "The assessment attempt has expired and cannot be submitted.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    // Lock the attempt before retrieving answers for evaluation.
    const lockedAttempt = await updateAssessmentAttempt({
        orgId,
        attemptId,
        expectedStatus: "in_progress",
        requireUnexpired: true,
        updates: {
            status: "submitted",
            submittedAt: new Date()
        }
    });

    if (!lockedAttempt) {
        throw createAttemptError(
            "The assessment attempt expired or was submitted by another request.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    // Retrieve the saved answers only after the submission lock.
    const submittedAttempt = await getAttemptWithSnapshot({
        orgId,
        attemptId
    });

    if (submittedAttempt.status !== "submitted") {
        throw createAttemptError(
            "The assessment attempt could not be retrieved for evaluation.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    const evaluation = evaluateAttempt(submittedAttempt);

    const evaluatedAttempt = await updateAssessmentAttempt({
        orgId,
        attemptId,
        expectedStatus: "submitted",
        updates: {
            ...evaluation,
            status: "evaluated",
            evaluatedAt: new Date()
        }
    });

    if (!evaluatedAttempt) {
        throw createAttemptError(
            "The submitted assessment attempt could not be evaluated.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    return sanitiseAttempt(
        await getAssessmentAttemptById(
            {
                orgId,
                attemptId
            },
            {
                includeSnapshot: true
            }
        )
    );
};


/**
 * Retrieves assessment attempt history.
 *
 * Trainees are restricted to their own attempts and can retrieve
 * their history across all courses in the current organisation.
 *
 * Trainers can retrieve attempts for courses they are authorised
 * to access. When filtering by assessmentId, its course is resolved
 * automatically if courseId is omitted.
 *
 * Administrators can retrieve organisation-wide attempt history.
 *
 * @param {Object} params - Attempt listing parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.userId - Requesting user ID.
 * @param {string} params.role - Organisation membership role.
 * @param {string} [params.assessmentId] - Assessment filter.
 * @param {string} [params.courseId] - Course filter.
 * @param {string} [params.traineeId] - Trainee filter.
 * @param {Object} [params.filters={}] - Attempt filters.
 * @param {Object} [params.pagination={}] - Pagination configuration.
 * @param {Object} [params.sort={}] - Sorting configuration.
 * @returns {Promise<Object>} Attempt records and pagination metadata.
 */
export const listAssessmentAttempts = async ({
    orgId,
    userId,
    role,
    assessmentId,
    courseId,
    traineeId,
    filters = {},
    pagination = {},
    sort = {}
}) => {
    ensureSupportedRole(role);

    if (
        !isValidObjectId(orgId) ||
        !isValidObjectId(userId)
    ) {
        throw createAttemptError(
            "Invalid organisation or user identifier.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    if (assessmentId && !isValidObjectId(assessmentId)) {
        throw createAttemptError(
            "Invalid assessment identifier.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    if (courseId && !isValidObjectId(courseId)) {
        throw createAttemptError(
            "Invalid course identifier.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    if (
        role !== "trainee" &&
        traineeId &&
        !isValidObjectId(traineeId)
    ) {
        throw createAttemptError(
            "Invalid trainee identifier.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    const safeTraineeId = role === "trainee"
        ? userId
        : traineeId;

    let safeCourseId = courseId;

    if (assessmentId) {
        const assessment = await getAssessmentById({
            orgId,
            assessmentId
        });

        if (!assessment) {
            throw createAttemptError(
                "Assessment not found.",
                HTTP_STATUS.NOT_FOUND,
                ERROR_CODES.RESOURCE_NOT_FOUND
            );
        }

        const assessmentCourseId = assessment.course.toString();

        if (
            safeCourseId &&
            assessmentCourseId !== safeCourseId
        ) {
            throw createAttemptError(
                "The assessment does not belong to the specified course.",
                HTTP_STATUS.BAD_REQUEST,
                ERROR_CODES.VALIDATION_ERROR
            );
        }

        safeCourseId = assessmentCourseId;
    }

    if (safeCourseId) {
        await ensureCourseAccess({
            orgId,
            courseId: safeCourseId,
            userId,
            role
        });
    } else if (role === "trainer") {
        throw createAttemptError(
            "A course ID or assessment ID is required to retrieve trainer assessment history.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    return getAssessmentAttempts({
        orgId,
        assessmentId,
        courseId: safeCourseId,
        traineeId: safeTraineeId,
        filters,
        pagination,
        sort
    });
};