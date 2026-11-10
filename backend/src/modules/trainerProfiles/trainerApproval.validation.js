
import mongoose from "mongoose";
import { z } from "zod";

/**
 * @name trainerProfileIdParamsSchema
 * @description Validates trainer profile route parameters.
 */
export const trainerProfileIdParamsSchema = z.object({
    params: z.object({
        id: z.string().refine(
            (value) => mongoose.isValidObjectId(value),
            "Invalid trainer profile identifier."
        )
    }).strict()
});

/**
 * @name pendingTrainerApprovalQuerySchema
 * @description Validates pagination for pending trainer eligibility requests.
 */
export const pendingTrainerApprovalQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20)
    }).strict()
});

/**
 * @name rejectTrainerApprovalSchema
 * @description Validates a trainer eligibility rejection reason.
 */
export const rejectTrainerApprovalSchema = z.object({
    params: z.object({
        id: z.string().refine(
            (value) => mongoose.isValidObjectId(value),
            "Invalid trainer profile identifier."
        )
    }).strict(),
    body: z.object({
        reason: z.string()
            .trim()
            .min(3, "Reason must contain at least 3 characters.")
            .max(1000, "Reason cannot exceed 1000 characters.")
    }).strict()
});

/**
 * @name suspendTrainerApprovalSchema
 * @description Validates a trainer eligibility suspension reason.
 */
export const suspendTrainerApprovalSchema = z.object({
    params: z.object({
        id: z.string().refine(
            (value) => mongoose.isValidObjectId(value),
            "Invalid trainer profile identifier."
        )
    }).strict(),
    body: z.object({
        reason: z.string()
            .trim()
            .min(3, "Reason must contain at least 3 characters.")
            .max(1000, "Reason cannot exceed 1000 characters.")
    }).strict()
});
