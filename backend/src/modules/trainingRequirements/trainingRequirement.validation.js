
import mongoose from "mongoose";
import { z } from "zod";

/**
 * Validates MongoDB ObjectId values.
 *
 * This prevents invalid resource identifiers from reaching
 * database queries.
 */
const objectIdSchema = z.string().refine(
    (value) => mongoose.isValidObjectId(value),
    "Invalid resource identifier."
);

/**
 * Defines the supported training requirement lifecycle states.
 *
 * Some transitions are controlled by matching and assignment
 * workflows rather than ordinary administrator updates.
 *
 * @name requirementStatusSchema
 */
const requirementStatusSchema = z.enum([
    "draft",
    "ready",
    "matched",
    "assigned",
    "cancelled",
    "archived"
]);

/**
 * Validates an individual competency requirement.
 *
 * Each competency can specify a minimum proficiency level,
 * scoring weight and whether it is mandatory.
 *
 * @name requiredCompetencySchema
 */
const requiredCompetencySchema = z.object({
    competency: objectIdSchema,

    minLevel: z.number()
        .int()
        .min(1)
        .max(4)
        .optional(),

    weight: z.number()
        .min(0)
        .optional(),

    mustHave: z.boolean().optional()
}).strict();

/**
 * Validates an individual skill requirement.
 *
 * The skill must belong to the same organization as the
 * training requirement. This is checked by the service.
 *
 * @name requiredSkillSchema
 */
const requiredSkillSchema = z.object({
    skill: objectIdSchema,
    mustHave: z.boolean().optional()
}).strict();

/**
 * Validates an individual certification requirement.
 *
 * Certification names must contain between 2 and 200 characters.
 *
 * @name requiredCertificationSchema
 */
const requiredCertificationSchema = z.object({
    name: z.string()
        .trim()
        .min(2)
        .max(200),

    mustHave: z.boolean().optional()
}).strict();

/**
 * Defines the reusable fields of a training requirement.
 *
 * These fields are shared between creation and update operations.
 *
 * Unknown properties are rejected to prevent clients from
 * submitting fields that are not part of the requirement schema.
 *
 * @name requirementFieldsSchema
 */
const requirementFieldsSchema = z.object({
    title: z.string()
        .trim()
        .min(3)
        .max(200)
        .optional(),

    description: z.string()
        .trim()
        .max(3000)
        .optional(),

    competencies: z.array(requiredCompetencySchema)
        .max(100)
        .optional(),

    requiredSkills: z.array(requiredSkillSchema)
        .max(100)
        .optional(),

    qualificationKeywords: z.array(
        z.string()
            .trim()
            .min(2)
            .max(200)
    )
        .max(50)
        .optional(),

    qualificationMustHave: z.boolean().optional(),

    requiredCertifications: z.array(requiredCertificationSchema)
        .max(50)
        .optional(),

    minimumExperienceYears: z.number()
        .min(0)
        .max(70)
        .optional(),

    minimumTeachingYears: z.number()
        .min(0)
        .max(70)
        .optional(),

    status: requirementStatusSchema.optional()
}).strict();

/**
 * Validates the creation of a training requirement.
 *
 * A title is mandatory, and at least one trainer requirement
 * must be specified.
 *
 * Organization ownership and creator information are assigned
 * by the service, not accepted from the client.
 *
 * @name createTrainingRequirementSchema
 */
export const createTrainingRequirementSchema = z.object({
    body: requirementFieldsSchema.extend({
        title: z.string()
            .trim()
            .min(3)
            .max(200)
    })
        .refine(
            (data) =>
                (data.competencies?.length ?? 0) > 0 ||
                (data.requiredSkills?.length ?? 0) > 0 ||
                (data.qualificationKeywords?.length ?? 0) > 0 ||
                (data.requiredCertifications?.length ?? 0) > 0 ||
                (data.minimumExperienceYears ?? 0) > 0 ||
                (data.minimumTeachingYears ?? 0) > 0,
            "At least one trainer requirement must be provided."
        )
}).strict();

/**
 * Validates updates to an existing training requirement.
 *
 * The requirement identifier must be a valid ObjectId.
 * At least one update field must be supplied.
 *
 * The service enforces lifecycle restrictions and validates
 * organization ownership of competency and skill references.
 *
 * @name updateTrainingRequirementSchema
 */
export const updateTrainingRequirementSchema = z.object({
    params: z.object({
        id: objectIdSchema
    }).strict(),

    body: requirementFieldsSchema
        .refine(
            (data) => Object.keys(data).length > 0,
            "At least one field must be provided."
        )
}).strict();

/**
 * Validates route parameters containing a training requirement ID.
 *
 * Used by operations that only need to identify a requirement,
 * such as retrieving or archiving it.
 *
 * @name trainingRequirementIdParamsSchema
 */
export const trainingRequirementIdParamsSchema = z.object({
    params: z.object({
        id: objectIdSchema
    }).strict()
}).strict();

/**
 * Validates query parameters when listing training requirements.
 *
 * Supports pagination, optional lifecycle status filtering
 * and text search.
 *
 * Default pagination:
 * - page: 1
 * - limit: 20
 *
 * @name listTrainingRequirementsQuerySchema
 */
export const listTrainingRequirementsQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number()
            .int()
            .min(1)
            .default(1),

        limit: z.coerce.number()
            .int()
            .min(1)
            .max(100)
            .default(20),

        status: requirementStatusSchema.optional(),

        search: z.string()
            .trim()
            .min(1)
            .max(200)
            .optional()
    }).strict()
}).strict();
