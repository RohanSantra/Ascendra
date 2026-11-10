import mongoose from "mongoose";
import { z } from "zod";

/**
 * Reusable MongoDB ObjectId validator.
 */
const objectIdSchema = z.string().refine(
    (value) => mongoose.isValidObjectId(value),
    {
        message: "Invalid resource identifier."
    }
);

/**
 * Create Organisation Invitation
 *
 * Validates the details required to invite a trainer or trainee.
 */
export const createOrganizationInvitationSchema = z.object({
    body: z.object({
        email: z.string()
            .trim()
            .email("Please provide a valid email address.")
            .max(254, "Email address cannot exceed 254 characters.")
            .transform((value) => value.toLowerCase()),

        role: z.enum(["trainer", "trainee"], {
            message: "Invitation role must be trainer or trainee."
        }),

        expiresInDays: z.coerce.number()
            .int("Invitation expiry must be a whole number of days.")
            .min(1, "Invitation must remain valid for at least 1 day.")
            .max(30, "Invitation cannot remain valid for more than 30 days.")
            .default(7)
    }).strict()
});

/**
 * Accept Organisation Invitation
 *
 * Validates the raw invitation token.
 */
export const acceptOrganizationInvitationSchema = z.object({
    body: z.object({
        token: z.string().regex(
            /^[a-f0-9]{64}$/i,
            "Invalid invitation token."
        )
    }).strict()
});

/**
 * Revoke Organisation Invitation
 *
 * Validates the invitation identifier.
 */
export const revokeOrganizationInvitationSchema = z.object({
    params: z.object({
        id: objectIdSchema
    }).strict()
});

/**
 * List Organisation Invitations
 *
 * Supports filtering by invitation lifecycle status
 * and retrieving paginated results.
 */
export const listOrganizationInvitationsQuerySchema = z.object({
    query: z.object({
        status: z.enum([
            "pending",
            "accepted",
            "revoked",
            "expired"
        ]).optional(),

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
});