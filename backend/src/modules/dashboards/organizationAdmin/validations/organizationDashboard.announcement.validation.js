import { z } from "zod";


/**
 * Validates the announcement reporting period.
 */
export const organizationAnnouncementReportQuerySchema = z.object({
    query: z.object({
        periodMonths: z.coerce
            .number()
            .int()
            .min(1)
            .max(24)
            .default(12)
    }).strict()
});