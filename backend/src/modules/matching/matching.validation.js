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
 * @name executeTrainerMatchingSchema
 * @description Validates the training requirement ID supplied
 * when executing trainer matching.
 */
export const executeTrainerMatchingSchema = z.object({
    params: z.object({
        requirementId: objectIdSchema
    }).strict()
}).strict();

/**
 * @name matchRunIdParamsSchema
 * @description Validates a matching run ID route parameter.
 */
export const matchRunIdParamsSchema = z.object({
    params: z.object({
        id: objectIdSchema
    }).strict()
}).strict();

/**
 * @name listMatchRunsQuerySchema
 * @description Validates matching run history pagination.
 */
export const listMatchRunsQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number()
            .int()
            .min(1)
            .default(1),

        limit: z.coerce.number()
            .int()
            .min(1)
            .max(100)
            .default(20)
    }).strict()
}).strict();