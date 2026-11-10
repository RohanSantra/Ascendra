import { z } from "zod";


/**
 * Validates MongoDB ObjectId values.
 */
const objectIdSchema = z
    .string()
    .regex(/^[a-f\d]{24}$/i, "Invalid MongoDB ObjectId.");


/**
 * Validates an individual MCQ option.
 */
const assessmentOptionSchema = z.object({
    optionId: z
        .string()
        .trim()
        .min(1)
        .max(64),

    text: z
        .string()
        .trim()
        .min(1)
        .max(1000)
}).strict();


/**
 * Validates an individual assessment question.
 *
 * The correct option must reference one of the supplied options.
 */
const assessmentQuestionSchema = z.object({
    questionId: z
        .string()
        .trim()
        .min(1)
        .max(64),

    questionText: z
        .string()
        .trim()
        .min(1)
        .max(3000),

    options: z
        .array(assessmentOptionSchema)
        .min(2)
        .max(10)
        .refine(
            (options) =>
                new Set(
                    options.map((option) => option.optionId)
                ).size === options.length,
            {
                message: "Option IDs must be unique within a question."
            }
        ),

    correctOptionId: z
        .string()
        .trim()
        .min(1)
        .max(64),

    marks: z
        .number()
        .finite()
        .min(0.01)
        .default(1),

    explanation: z
        .string()
        .trim()
        .max(2000)
        .optional()
        .default("")
}).strict().superRefine((question, context) => {
    const correctOptionExists = question.options.some(
        (option) => option.optionId === question.correctOptionId
    );

    if (!correctOptionExists) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["correctOptionId"],
            message: "Correct option ID must reference one of the question's options."
        });
    }
});


/**
 * Validates assessment question collections.
 */
const assessmentQuestionsSchema = z
    .array(assessmentQuestionSchema)
    .min(1)
    .max(200)
    .refine(
        (questions) =>
            new Set(
                questions.map((question) => question.questionId)
            ).size === questions.length,
        {
            message: "Question IDs must be unique within an assessment."
        }
    );


/**
 * Validates assessment creation requests.
 */
export const createAssessmentSchema = z.object({
    params: z.object({
        courseId: objectIdSchema
    }).strict(),

    body: z.object({
        title: z
            .string()
            .trim()
            .min(3)
            .max(200),

        description: z
            .string()
            .trim()
            .max(2000)
            .optional()
            .default(""),

        questions: assessmentQuestionsSchema,

        passingPercentage: z
            .number()
            .finite()
            .min(0)
            .max(100)
            .optional()
            .default(40),

        durationMinutes: z
            .number()
            .int()
            .min(1)
            .max(600),

        maxAttempts: z
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .default(1)
    }).strict()
});


/**
 * Validates assessment identifier parameters.
 */
export const assessmentIdParamsSchema = z.object({
    params: z.object({
        assessmentId: objectIdSchema
    }).strict()
});


/**
 * Validates assessment update requests.
 *
 * Only draft assessments may be edited by the service.
 */
export const updateAssessmentSchema = z.object({
    params: z.object({
        assessmentId: objectIdSchema
    }).strict(),

    body: z.object({
        title: z
            .string()
            .trim()
            .min(3)
            .max(200)
            .optional(),

        description: z
            .string()
            .trim()
            .max(2000)
            .optional(),

        questions: assessmentQuestionsSchema.optional(),

        passingPercentage: z
            .number()
            .finite()
            .min(0)
            .max(100)
            .optional(),

        durationMinutes: z
            .number()
            .int()
            .min(1)
            .max(600)
            .optional(),

        maxAttempts: z
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
    }).strict().refine(
        (data) => Object.keys(data).length > 0,
        {
            message: "At least one assessment field must be provided."
        }
    )
});


/**
 * Validates assessment listing filters and pagination.
 */
export const listAssessmentsQuerySchema = z.object({
    params: z.object({
        courseId: objectIdSchema
    }).strict(),

    query: z.object({
        status: z.enum([
            "draft",
            "published",
            "archived"
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
            "title",
            "createdAt",
            "updatedAt",
            "publishedAt",
            "version"
        ]).default("createdAt"),

        sortOrder: z.enum([
            "asc",
            "desc"
        ]).default("desc")
    }).strict()
});


/**
 * Validates assessment publication requests.
 */
export const publishAssessmentSchema = assessmentIdParamsSchema;


/**
 * Validates assessment archival requests.
 */
export const archiveAssessmentSchema = assessmentIdParamsSchema;


/**
 * Validates requests to create a new assessment version.
 */
export const createAssessmentVersionSchema = assessmentIdParamsSchema;