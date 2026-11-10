
import mongoose from "mongoose";
import { z } from "zod";

/**
 * @name objectIdSchema
 * @description Validates MongoDB ObjectId values.
 */
const objectIdSchema = z.string().refine(
    (value) => mongoose.isValidObjectId(value),
    {
        message: "A valid MongoDB ObjectId is required."
    }
);

/**
 * @name createTrainerAssignmentSchema
 * @description Validates trainer assignment creation data.
 *
 * Organization and administrator IDs are obtained
 * from the authenticated request context.
 */
export const createTrainerAssignmentSchema = z.object({
    params: z.object({
        requirementId: objectIdSchema
    }).strict(),

    body: z.object({
        matchRunId: objectIdSchema,
        trainerProfileId: objectIdSchema,
        startDate: z.coerce.date(),
        endDate: z.coerce.date()
    }).strict().refine(
        (data) => data.endDate >= data.startDate,
        {
            message: "Assignment end date cannot be earlier than its start date.",
            path: ["endDate"]
        }
    )
}).strict();

/**
 * @name trainerAssignmentIdParamsSchema
 * @description Validates a trainer assignment ID route parameter.
 */
export const trainerAssignmentIdParamsSchema = z.object({
    params: z.object({
        id: objectIdSchema
    }).strict()
}).strict();

/**
 * @name listTrainerAssignmentsQuerySchema
 * @description Validates assignment listing filters
 * and pagination parameters.
 */
export const listTrainerAssignmentsQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number()
            .int()
            .min(1)
            .default(1),

        limit: z.coerce.number()
            .int()
            .min(1)
            .max(100)
            .default(20),

        status: z.enum([
            "assigned",
            "in_progress",
            "completed",
            "cancelled"
        ]).optional(),

        requirementId: objectIdSchema.optional()
    }).strict()
}).strict();

/**
 * @name cancelTrainerAssignmentSchema
 * @description Validates the reason supplied when cancelling
 * a trainer assignment.
 *
 * An empty reason is allowed.
 */
export const cancelTrainerAssignmentSchema = z.object({
    params: z.object({
        id: objectIdSchema
    }).strict(),

    body: z.object({
        cancellationReason: z.string()
            .trim()
            .max(1000)
            .optional()
            .nullable()
    }).strict()
}).strict();


