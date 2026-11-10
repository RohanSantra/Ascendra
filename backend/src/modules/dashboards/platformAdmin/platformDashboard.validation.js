import { z } from "zod";


/**
 * Validates Platform Administrator dashboard query parameters.
 *
 * @name platformDashboardQuerySchema
 */
export const platformDashboardQuerySchema = z.object({
    query: z.object({
        periodMonths: z.coerce
            .number()
            .int()
            .min(1)
            .max(24)
            .default(12)
    }).strict()
});