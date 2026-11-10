
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

/**
 * Defines the scoring weights used by the matching engine.
 *
 * Weights are non-negative. The matching engine normalizes the
 * applicable weights at runtime after excluding unrequested factors.
 *
 * @name matchingWeightsSchema
 */
const matchingWeightsSchema = new Schema(
    {
        competency: { type: Number, min: 0, default: 0.30 },
        skills: { type: Number, min: 0, default: 0.25 },
        qualification: { type: Number, min: 0, default: 0.15 },
        experience: { type: Number, min: 0, default: 0.15 },
        teaching: { type: Number, min: 0, default: 0.10 },
        certification: { type: Number, min: 0, default: 0.05 }
    },
    { _id: false, versionKey: false }
);

/**
 * Defines the score thresholds used to classify matching results.
 *
 * @name matchingThresholdsSchema
 */
const matchingThresholdsSchema = new Schema(
    {
        strong: { type: Number, min: 0, max: 1, default: 0.80 },
        partial: { type: Number, min: 0, max: 1, default: 0.50 }
    },
    { _id: false, versionKey: false }
);

/**
 * Defines evidence point values, trust factors and decay settings.
 *
 * @name matchingEvidenceRulesSchema
 */
const matchingEvidenceRulesSchema = new Schema(
    {
        qualificationBasePoints: {
            type: Number,
            min: 0,
            default: 2
        },
        certificationBasePoints: {
            type: Number,
            min: 0,
            default: 3
        },
        experiencePointsPerYear: {
            type: Number,
            min: 0,
            default: 0.5
        },
        experiencePointsCap: {
            type: Number,
            min: 0,
            default: 5
        },
        teachingPointsPerYear: {
            type: Number,
            min: 0,
            default: 0.5
        },
        teachingPointsCap: {
            type: Number,
            min: 0,
            default: 3
        },
        assessmentScoreDivisor: {
            type: Number,
            min: 0.000001,
            default: 20
        },
        assessmentPointsCap: {
            type: Number,
            min: 0,
            default: 5
        },
        halfLifeYears: {
            type: Number,
            min: 0.000001,
            default: 3
        },
        diminishingReturnFactor: {
            type: Number,
            min: 0,
            max: 1,
            default: 0.7
        },
        verifiedTrust: {
            type: Number,
            min: 0,
            max: 1,
            default: 1
        },
        selfReportedTrust: {
            type: Number,
            min: 0,
            max: 1,
            default: 0.5
        }
    },
    { _id: false, versionKey: false }
);

/**
 * Defines the point boundaries for competency proficiency levels.
 *
 * The values represent the minimum points required for each level.
 *
 * @name proficiencyLevelsSchema
 */
const proficiencyLevelsSchema = new Schema(
    {
        beginner: { type: Number, min: 0, default: 0 },
        intermediate: { type: Number, min: 0, default: 3 },
        advanced: { type: Number, min: 0, default: 6 },
        expert: { type: Number, min: 0, default: 9 }
    },
    { _id: false, versionKey: false }
);


/**
 * Defines the deterministic tie-breaking order used when trainers
 * have the same rounded matching score.
 *
 * @name matchingTieBreakOrderSchema
 */
const matchingTieBreakOrderSchema = {
    type: [String],
    enum: [
        "verifiedRatio",
        "recency",
        "load",
        "profileCompletedAt"
    ],
    default: [
        "verifiedRatio",
        "recency",
        "load",
        "profileCompletedAt"
    ],
    validate: {
        validator: (values) =>
            values.length === new Set(values).size,
        message: "Tie-break criteria must not contain duplicates."
    }
};


/**
 * Represents a versioned configuration for the trainer-matching engine.
 *
 * Each configuration is retained as a historical version. Only one
 * configuration per organization can be active at a time.
 *
 * @name matchingConfigSchema
 */
const matchingConfigSchema = new Schema(
    {
        org: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            required: true
        },
        version: {
            type: Number,
            min: 1,
            required: true
        },
        isActive: {
            type: Boolean,
            default: false,
            required: true
        },
        weights: {
            type: matchingWeightsSchema,
            default: () => ({})
        },
        thresholds: {
            type: matchingThresholdsSchema,
            default: () => ({})
        },
        evidenceRules: {
            type: matchingEvidenceRulesSchema,
            default: () => ({})
        },
        proficiencyLevels: {
            type: proficiencyLevelsSchema,
            default: () => ({})
        },
        tieBreakOrder: matchingTieBreakOrderSchema,
        defaultResultLimit: {
            type: Number,
            min: 1,
            max: 100,
            default: 20,
            required: true
        },
        algorithmVersion: {
            type: String,
            required: true,
            trim: true,
            default: "1.0.0"
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: "__v",
        optimisticConcurrency: true
    }
);

/**
 * Ensures each configuration version is unique within an organization.
 */
matchingConfigSchema.index(
    { org: 1, version: 1 },
    {
        unique: true,
        name: "matching_config_org_version_unique"
    }
);

/**
 * Ensures only one active matching configuration exists per organization.
 */
matchingConfigSchema.index(
    { org: 1 },
    {
        unique: true,
        partialFilterExpression: { isActive: true },
        name: "matching_config_one_active_per_org"
    }
);

const MatchingConfig =
    models.MatchingConfig ||
    model("MatchingConfig", matchingConfigSchema);

export default MatchingConfig;
