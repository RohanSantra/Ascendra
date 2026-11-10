import { z } from "zod";


const objectIdSchema = z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid identifier.");


const titleSchema = z
    .string()
    .trim()
    .min(3)
    .max(200);


const messageSchema = z
    .string()
    .trim()
    .min(1)
    .max(5000);


/**
 * Validates announcement creation.
 */
export const createAnnouncementSchema = z.object({
    body: z.object({
        title: titleSchema,

        message: messageSchema,

        audience: z
            .enum(["everyone", "trainers", "trainees"])
            .default("everyone")
    }).strict()
});


/**
 * Validates announcement editing.
 */
export const updateAnnouncementSchema = z.object({
    params: z.object({
        announcementId: objectIdSchema
    }).strict(),

    body: z.object({
        title: titleSchema.optional(),

        message: messageSchema.optional(),

        audience: z
            .enum(["everyone", "trainers", "trainees"])
            .optional()
    })
        .strict()
        .refine(
            (data) => Object.keys(data).length > 0,
            "At least one field must be provided."
        )
});


/**
 * Validates announcement identifier parameters.
 */
export const announcementIdParamsSchema = z.object({
    params: z.object({
        announcementId: objectIdSchema
    }).strict()
});


/**
 * Validates announcement listing filters.
 */
export const listAnnouncementsQuerySchema = z.object({
    query: z.object({
        status: z
            .enum(["draft", "published", "archived"])
            .optional(),

        audience: z
            .enum(["everyone", "trainers", "trainees"])
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

        sortBy: z
            .enum(["createdAt", "updatedAt", "publishedAt", "title"])
            .default("createdAt"),

        sortOrder: z
            .enum(["asc", "desc"])
            .default("desc")
    }).strict()
});


export { objectIdSchema };