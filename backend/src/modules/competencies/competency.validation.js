import { z } from "zod";

/**
 * Validates MongoDB ObjectId values.
 *
 * @name objectIdSchema
 */
const objectIdSchema = z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid ID format.");

/**
 * Validates competency names.
 *
 * @name competencyNameSchema
 */
const competencyNameSchema = z
    .string()
    .trim()
    .min(2, "Competency name must contain at least 2 characters.")
    .max(120, "Competency name cannot exceed 120 characters.");

/**
 * Validates competency slugs.
 *
 * @name competencySlugSchema
 */
const competencySlugSchema = z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(140)
    .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug must contain lowercase letters, numbers and single hyphens."
    );

/**
 * Validates competency descriptions.
 *
 * @name competencyDescriptionSchema
 */
const competencyDescriptionSchema = z
    .string()
    .trim()
    .max(1500)
    .optional();

/**
 * Validates competency categories.
 *
 * @name competencyCategorySchema
 */
const competencyCategorySchema = z
    .string()
    .trim()
    .max(100)
    .optional();

/**
 * Validates competency creation requests.
 *
 * @name createCompetencySchema
 */
export const createCompetencySchema = z.object({
    body: z.object({
        name: competencyNameSchema,
        slug: competencySlugSchema.optional(),
        description: competencyDescriptionSchema,
        category: competencyCategorySchema
    }).strict()
});

/**
 * Validates competency update requests.
 *
 * @name updateCompetencySchema
 */
export const updateCompetencySchema = z.object({
    params: z.object({
        id: objectIdSchema
    }),
    body: z.object({
        name: competencyNameSchema.optional(),
        slug: competencySlugSchema.optional(),
        description: competencyDescriptionSchema,
        category: competencyCategorySchema
    })
        .strict()
        .refine(
            (data) => Object.keys(data).length > 0,
            "At least one field must be provided."
        )
});

/**
 * Validates competency ID parameters.
 *
 * @name competencyIdParamsSchema
 */
export const competencyIdParamsSchema = z.object({
    params: z.object({
        id: objectIdSchema
    })
});

/**
 * Validates competency listing query parameters.
 *
 * @name competencyListQuerySchema
 */
export const competencyListQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        search: z.string().trim().max(120).optional(),
        category: z.string().trim().max(100).optional(),
        status: z.enum(["active", "archived", "all"]).default("active")
    }).strict()
});