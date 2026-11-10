import { z } from "zod";


const objectIdSchema = z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid identifier.");


/**
 * Validates notification identifier parameters.
 */
export const notificationIdParamsSchema = z.object({
    params: z.object({
        notificationId: objectIdSchema
    }).strict()
});


/**
 * Validates notification listing filters.
 */
export const listNotificationsQuerySchema = z.object({
    query: z.object({
        status: z
            .enum(["unread", "read", "archived"])
            .optional(),

        type: z
            .enum([
                "announcement_published",
                "course_assigned",
                "enrollment_updated",
                "assessment_available",
                "assessment_evaluated",
                "general"
            ])
            .optional(),

        page: z.coerce
            .number()
            .int()
            .min(1)
            .default(1),

        limit: z.coerce
            .number()
            .int()
            .min(1)
            .max(100)
            .default(20),

        sortOrder: z
            .enum(["asc", "desc"])
            .default("desc")
    }).strict()
});


export { objectIdSchema };