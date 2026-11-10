import { z } from "zod";


const objectIdSchema = z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid identifier.");


/**
 * Validates feedback submission.
 */
export const createFeedbackSchema = z.object({
    params: z.object({
        courseId: objectIdSchema
    }).strict(),

    body: z.object({
        rating: z
            .number()
            .int()
            .min(1)
            .max(5),

        comment: z
            .string()
            .trim()
            .max(2000)
            .optional()
    }).strict()
});


/**
 * Validates feedback identifier parameters.
 */
export const feedbackIdParamsSchema = z.object({
    params: z.object({
        feedbackId: objectIdSchema
    }).strict()
});


/**
 * Validates organisation feedback listing filters.
 */
export const listFeedbackQuerySchema = z.object({
    query: z.object({
        courseId: objectIdSchema.optional(),

        trainerId: objectIdSchema.optional(),

        traineeId: objectIdSchema.optional(),

        status: z
            .enum(["submitted", "hidden"])
            .optional(),

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

        sortBy: z
            .enum(["createdAt", "updatedAt", "rating"])
            .default("createdAt"),

        sortOrder: z
            .enum(["asc", "desc"])
            .default("desc")
    }).strict()
});


/**
 * Validates feedback visibility updates.
 */
export const updateFeedbackStatusSchema = z.object({
    params: z.object({
        feedbackId: objectIdSchema
    }).strict(),

    body: z.object({
        status: z.enum(["submitted", "hidden"])
    }).strict()
});


export { objectIdSchema };