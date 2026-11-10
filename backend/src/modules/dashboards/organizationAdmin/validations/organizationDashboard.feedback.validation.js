import { z } from "zod";


/**
 * Validates the feedback reporting period.
 */
export const organizationFeedbackReportQuerySchema = z.object({
    query: z.object({
        periodMonths: z.coerce
            .number()
            .int()
            .min(1)
            .max(24)
            .default(12)
    }).strict()
});