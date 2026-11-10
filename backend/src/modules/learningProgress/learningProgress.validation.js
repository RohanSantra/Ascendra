import { z } from "zod";


/**
 * Validates MongoDB ObjectId parameters.
 */
const objectIdSchema = z.string().regex(
    /^[0-9a-fA-F]{24}$/,
    "Invalid identifier."
);


/**
 * Validates course and material identifiers.
 */
const learningProgressParamsSchema = z.object({
    courseId: objectIdSchema,
    materialId: objectIdSchema
}).strict();


/**
 * Validates a learning progress update.
 *
 * Trainees can mark material as in progress or completed.
 * The not_started state is managed by the backend when
 * a progress record is first created.
 */
const updateLearningProgressBodySchema = z.object({
    status: z.enum([
        "in_progress",
        "completed"
    ])
}).strict();


/**
 * Validates parameters and body for updating learning progress.
 */
export const updateLearningProgressSchema = z.object({
    params: learningProgressParamsSchema,
    body: updateLearningProgressBodySchema
});


/**
 * Validates parameters for retrieving material progress.
 */
export const getLearningProgressParamsSchema = z.object({
    courseId: objectIdSchema,
    materialId: objectIdSchema
}).strict();


/**
 * Validates parameters for retrieving course-level progress.
 */
export const getCourseLearningProgressParamsSchema = z.object({
    courseId: objectIdSchema
}).strict();


/**
 * Validates query parameters for listing learning progress records.
 */
export const listLearningProgressQuerySchema = z.object({
    params: z.object({
        courseId: objectIdSchema
    }).strict(),

    query: z.object({
        traineeId: objectIdSchema.optional(),

        status: z.enum([
            "not_started",
            "in_progress",
            "completed"
        ]).optional(),

        page: z.coerce.number()
            .int()
            .min(1)
            .default(1),

        limit: z.coerce.number()
            .int()
            .min(1)
            .max(100)
            .default(20),

        sortBy: z.enum([
            "createdAt",
            "updatedAt",
            "startedAt",
            "lastAccessedAt",
            "completedAt"
        ]).default("updatedAt"),

        sortOrder: z.enum([
            "asc",
            "desc"
        ]).default("desc")
    }).strict()
});


export {
    objectIdSchema,
    learningProgressParamsSchema
};