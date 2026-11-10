import { z } from "zod";


/**
 * Validates Organisation Admin activity report query parameters.
 *
 * @name organizationDashboardReportingQuerySchema
 */
export const organizationDashboardReportingQuerySchema = z.object({
    query: z.object({
        periodMonths: z.coerce
            .number()
            .int()
            .min(1)
            .max(24)
            .default(12)
    }).strict()
});