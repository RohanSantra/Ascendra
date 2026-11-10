
import mongoose from "mongoose";
import { z } from "zod";

/**
 * Validates MongoDB ObjectId values.
 *
 * @name objectIdSchema
 */
const objectIdSchema = z.string().refine(
    (value) => mongoose.isValidObjectId(value),
    {
        message: "A valid MongoDB ObjectId is required."
    }
);

/**
 * Validates matching scoring weights.
 *
 * Each weight must be a finite, non-negative number.
 */
const matchingWeightsSchema = z.object({
    competency: z.number().finite().min(0).optional(),
    skills: z.number().finite().min(0).optional(),
    qualification: z.number().finite().min(0).optional(),
    experience: z.number().finite().min(0).optional(),
    teaching: z.number().finite().min(0).optional(),
    certification: z.number().finite().min(0).optional()
}).strict();

/**
 * Validates matching result classification thresholds.
 */
const matchingThresholdsSchema = z.object({
    strong: z.number().finite().min(0).max(1).optional(),
    partial: z.number().finite().min(0).max(1).optional()
}).strict();

/**
 * Validates evidence scoring and trust rules.
 */
const matchingEvidenceRulesSchema = z.object({
    qualificationBasePoints: z.number().finite().min(0).optional(),
    certificationBasePoints: z.number().finite().min(0).optional(),

    experiencePointsPerYear: z.number().finite().min(0).optional(),
    experiencePointsCap: z.number().finite().min(0).optional(),

    teachingPointsPerYear: z.number().finite().min(0).optional(),
    teachingPointsCap: z.number().finite().min(0).optional(),

    assessmentScoreDivisor: z.number().finite().gt(0).optional(),
    assessmentPointsCap: z.number().finite().min(0).optional(),

    halfLifeYears: z.number().finite().gt(0).optional(),
    diminishingReturnFactor: z.number().finite().min(0).max(1).optional(),

    verifiedTrust: z.number().finite().min(0).max(1).optional(),
    selfReportedTrust: z.number().finite().min(0).max(1).optional()
}).strict();

/**
 * Validates competency proficiency point boundaries.
 */
const proficiencyLevelsSchema = z.object({
    beginner: z.number().finite().min(0).optional(),
    intermediate: z.number().finite().min(0).optional(),
    advanced: z.number().finite().min(0).optional(),
    expert: z.number().finite().min(0).optional()
}).strict();

/**
 * Validates deterministic matching tie-break criteria.
 */
const tieBreakOrderSchema = z.array(
    z.enum([
        "verifiedRatio",
        "recency",
        "load",
        "profileCompletedAt"
    ])
).max(4).refine(
    (values) => values.length === new Set(values).size,
    {
        message: "Tie-break criteria must not contain duplicates."
    }
);

/**
 * Validates the configurable matching result limit.
 */
const defaultResultLimitSchema = z.number()
    .int()
    .min(1)
    .max(100);

/**
 * Defines the accepted matching configuration fields.
 *
 * All fields are optional so administrators can submit
 * partial settings when creating a new version.
 *
 * The service inherits unspecified values from the
 * latest configuration version.
 */
const matchingConfigurationFieldsSchema = z.object({
    weights: matchingWeightsSchema.optional(),

    thresholds: matchingThresholdsSchema.optional(),

    evidenceRules: matchingEvidenceRulesSchema.optional(),

    proficiencyLevels: proficiencyLevelsSchema.optional(),

    tieBreakOrder: tieBreakOrderSchema.optional(),

    defaultResultLimit: defaultResultLimitSchema.optional(),

    algorithmVersion: z.string()
        .trim()
        .min(1)
        .max(50)
        .optional()
}).strict();

/**
 * Ensures that at least one configuration setting is supplied.
 *
 * @param {Object} data - Configuration request body.
 * @returns {boolean}
 */
const hasConfigurationChanges = (data) =>
    Object.keys(data).length > 0;

/**
 * Validates the initial matching configuration request.
 *
 * @name createInitialMatchingConfigSchema
 */
export const createInitialMatchingConfigSchema = z.object({
    body: matchingConfigurationFieldsSchema
        .refine(hasConfigurationChanges, {
            message: "Provide at least one matching configuration setting."
        })
}).strict();

/**
 * Validates the creation of a new matching configuration version.
 *
 * The service inherits unspecified settings from the latest version.
 *
 * @name createMatchingConfigVersionSchema
 */
export const createMatchingConfigVersionSchema = z.object({
    body: matchingConfigurationFieldsSchema
        .refine(hasConfigurationChanges, {
            message: "Provide at least one matching configuration change."
        })
}).strict();

/**
 * Validates matching configuration history pagination.
 *
 * @name listMatchingConfigVersionsQuerySchema
 */
export const listMatchingConfigVersionsQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number()
            .int()
            .min(1)
            .default(1),

        limit: z.coerce.number()
            .int()
            .min(1)
            .max(100)
            .default(20)
    }).strict()
}).strict();

/**
 * Validates the matching configuration ID route parameter.
 *
 * @name matchingConfigIdParamsSchema
 */
export const matchingConfigIdParamsSchema = z.object({
    params: z.object({
        id: objectIdSchema
    }).strict()
}).strict();
