import { z } from "zod";

/**
 * @name updateTrainerProfessionalDetailsSchema
 * @description Validates updates to trainer professional information.
 */
export const updateTrainerProfessionalDetailsSchema = z.object({
    body: z.object({
        headline: z.string()
            .trim()
            .max(200)
            .optional(),

        bio: z.string()
            .trim()
            .max(3000)
            .optional(),

        specialization: z.string()
            .trim()
            .max(200)
            .optional(),

        currentDesignation: z.string()
            .trim()
            .max(150)
            .optional()
    })
        .strict()
        .refine(
            (data) => Object.keys(data).length > 0,
            "At least one professional detail must be provided."
        )
});

/**
 * @name updateTrainerAvailabilitySchema
 * @description Validates trainer availability preferences.
 */
export const updateTrainerAvailabilitySchema = z.object({
    body: z.object({
        status: z.enum([
            "available",
            "limited",
            "unavailable",
            "on_leave"
        ]).optional(),

        maxConcurrentTrainings: z.number()
            .int()
            .min(1)
            .max(50)
            .optional()
    })
        .strict()
        .refine(
            (data) => Object.keys(data).length > 0,
            "At least one availability field must be provided."
        )
});
