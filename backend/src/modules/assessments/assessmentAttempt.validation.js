import { z } from "zod";


/**
 * Validates MongoDB ObjectId values.
 */
const objectIdSchema = z
    .string()
    .regex(/^[a-f\d]{24}$/i, "Invalid MongoDB ObjectId.");


/**
 * Validates an individual answer submitted by a trainee.
 *
 * A null selectedOptionId represents an unanswered question.
 */
const assessmentAnswerSchema = z.object({
    questionId: z
        .string()
        .trim()
        .min(1)
        .max(64),

    selectedOptionId: z
        .string()
        .trim()
        .min(1)
        .max(64)
        .nullable()
}).strict();


/**
 * Validates a collection of answers.
 *
 * Each question can have only one answer record per request.
 */
const assessmentAnswersSchema = z
    .array(assessmentAnswerSchema)
    .min(1)
    .max(200)
    .refine(
        (answers) =>
            new Set(
                answers.map((answer) => answer.questionId)
            ).size === answers.length,
        {
            message: "Duplicate question IDs are not allowed."
        }
    );


/**
 * Validates the parameters required to start an assessment attempt.
 */
export const startAssessmentAttemptSchema = z.object({
    params: z.object({
        assessmentId: objectIdSchema
    }).strict()
});


/**
 * Validates assessment attempt route parameters.
 */
export const assessmentAttemptIdParamsSchema = z.object({
    params: z.object({
        attemptId: objectIdSchema
    }).strict()
});


/**
 * Validates answer-saving requests.
 *
 * The service verifies that every question and selected option
 * belongs to the immutable assessment snapshot.
 */
export const saveAssessmentAnswersSchema = z.object({
    params: z.object({
        attemptId: objectIdSchema
    }).strict(),

    body: z.object({
        answers: assessmentAnswersSchema
    }).strict()
});


/**
 * Validates assessment attempt submission.
 *
 * Submission does not accept a score or percentage from the client.
 * The server evaluates the attempt using its stored snapshot.
 */
export const submitAssessmentAttemptSchema = z.object({
    params: z.object({
        attemptId: objectIdSchema
    }).strict()
});


/**
 * Validates assessment attempt listing filters and pagination.
 */
export const listAssessmentAttemptsQuerySchema = z.object({
    query: z.object({
        assessmentId: objectIdSchema.optional(),

        courseId: objectIdSchema.optional(),

        traineeId: objectIdSchema.optional(),

        status: z.enum([
            "in_progress",
            "submitted",
            "evaluated",
            "expired"
        ]).optional(),

        page: z.coerce
            .number()
            .int()
            .min(1)
            .default(1),

        limit: z.coerce
            .number()
            .int()
            .min(1)
            .max(100)
            .default(20),

        sortBy: z.enum([
            "createdAt",
            "updatedAt",
            "startedAt",
            "submittedAt",
            "evaluatedAt",
            "attemptNumber",
            "percentage",
            "score"
        ]).default("createdAt"),

        sortOrder: z.enum([
            "asc",
            "desc"
        ]).default("desc")
    }).strict()
});