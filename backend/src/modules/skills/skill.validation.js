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
 * Validates skill names.
 *
 * @name skillNameSchema
 */
const skillNameSchema = z
    .string()
    .trim()
    .min(2, "Skill name must contain at least 2 characters.")
    .max(120, "Skill name cannot exceed 120 characters.");

/**
 * Validates skill slugs.
 *
 * @name skillSlugSchema
 */
const skillSlugSchema = z
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
 * Validates skill descriptions.
 *
 * @name skillDescriptionSchema
 */
const skillDescriptionSchema = z
    .string()
    .trim()
    .max(1500)
    .optional();

/**
 * Validates skill categories.
 *
 * @name skillCategorySchema
 */
const skillCategorySchema = z
    .string()
    .trim()
    .max(100)
    .optional();

/**
 * Validates competency ID arrays.
 *
 * @name competencyIdsSchema
 */
const competencyIdsSchema = z
    .array(objectIdSchema)
    .max(50, "A maximum of 50 competencies can be associated.")
    .refine(
        (ids) => new Set(ids).size === ids.length,
        "Duplicate competency IDs are not allowed."
    );

/**
 * Validates skill creation requests.
 *
 * @name createSkillSchema
 */
export const createSkillSchema = z.object({
    body: z.object({
        name: skillNameSchema,
        slug: skillSlugSchema.optional(),
        description: skillDescriptionSchema,
        competencies: competencyIdsSchema.optional().default([]),
        category: skillCategorySchema
    }).strict()
});

/**
 * Validates skill update requests.
 *
 * @name updateSkillSchema
 */
export const updateSkillSchema = z.object({
    params: z.object({
        id: objectIdSchema
    }),
    body: z.object({
        name: skillNameSchema.optional(),
        slug: skillSlugSchema.optional(),
        description: skillDescriptionSchema,
        competencies: competencyIdsSchema.optional(),
        category: skillCategorySchema
    })
        .strict()
        .refine(
            (data) => Object.keys(data).length > 0,
            "At least one field must be provided."
        )
});

/**
 * Validates skill ID parameters.
 *
 * @name skillIdParamsSchema
 */
export const skillIdParamsSchema = z.object({
    params: z.object({
        id: objectIdSchema
    })
});

/**
 * Validates skill listing query parameters.
 *
 * @name skillListQuerySchema
 */
export const skillListQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        search: z.string().trim().max(120).optional(),
        category: z.string().trim().max(100).optional(),
        competencyId: objectIdSchema.optional(),
        status: z.enum(["active", "archived", "all"]).default("active")
    }).strict()
});