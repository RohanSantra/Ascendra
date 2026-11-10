
import { z } from "zod";

/**
 * @name objectIdSchema
 * @description Validates MongoDB ObjectId strings.
 */
const objectIdSchema = z
    .string()
    .regex(/^[a-fA-F0-9]{24}$/, "Invalid ID format.");

/**
 * @name evidenceIdParamsSchema
 * @description Validates evidence ID route parameters.
 */
export const evidenceIdParamsSchema = z.object({
    params: z.object({
        id: objectIdSchema
    }).strict()
});

/**
 * @name pendingEvidenceQuerySchema
 * @description Validates filters and pagination for the
 * administrator's pending evidence verification queue.
 */
export const pendingEvidenceQuerySchema = z.object({
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

        type: z.enum([
            "qualification",
            "certification",
            "experience",
            "teaching",
            "assessment"
        ]).optional(),

        search: z.string()
            .trim()
            .min(1, "Search cannot be empty.")
            .max(200)
            .optional()
    }).strict()
});

/**
 * @name rejectEvidenceSchema
 * @description Validates evidence rejection requests.
 *
 * A rejection reason is mandatory so the trainer can
 * understand why the submitted evidence was rejected.
 */
export const rejectEvidenceSchema = z.object({
    params: z.object({
        id: objectIdSchema
    }).strict(),

    body: z.object({
        reason: z.string()
            .trim()
            .min(3, "Rejection reason must contain at least 3 characters.")
            .max(1000, "Rejection reason cannot exceed 1000 characters.")
    }).strict()
});
