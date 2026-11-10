
import mongoose from "mongoose";
import { z } from "zod";

/**
 * @name objectIdSchema
 * @description Validates MongoDB ObjectId route parameters.
 */
const objectIdSchema = z.string().refine(
    (value) => mongoose.isValidObjectId(value),
    "Invalid resource identifier."
);


/**
 * @name createMembershipRequestSchema
 * @description Validates a user's request to join an organization.
 */
export const createMembershipRequestSchema = z.object({
    body: z.object({
        orgId: objectIdSchema,
        role: z.enum(["trainer", "trainee"])
    }).strict()
});


/**
 * @name membershipIdParamsSchema
 * @description Validates membership route parameters.
 */
export const membershipIdParamsSchema = z.object({
    params: z.object({
        id: objectIdSchema
    }).strict()
});

/**
 * @name pendingMembershipQuerySchema
 * @description Validates pagination for pending membership requests.
 */
export const pendingMembershipQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20)
    }).strict()
});

/**
 * @name rejectMembershipSchema
 * @description Validates the reason for rejecting a membership request.
 */
export const rejectMembershipSchema = z.object({
    params: z.object({
        id: objectIdSchema
    }).strict(),
    body: z.object({
        reason: z.string().trim().min(3).max(1000)
    }).strict()
});
