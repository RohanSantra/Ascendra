
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

/**
 * Stores the execution statistics for a matching run.
 *
 * @name matchRunStatsSchema
 */
const matchRunStatsSchema = new Schema(
    {
        candidatesEvaluated: {
            type: Number,
            min: 0,
            default: 0,
            required: true
        },
        queryMs: {
            type: Number,
            min: 0,
            default: 0,
            required: true
        },
        scoringMs: {
            type: Number,
            min: 0,
            default: 0,
            required: true
        },
        totalMs: {
            type: Number,
            min: 0,
            default: 0,
            required: true
        }
    },
    { _id: false, versionKey: false }
);

/**
 * Stores the individual scoring factors for a trainer.
 *
 * Values are normalized scores between zero and one.
 *
 * @name matchScoreBreakdownSchema
 */
const matchScoreBreakdownSchema = new Schema(
    {
        competency: { type: Number, min: 0, max: 1, default: null },
        skills: { type: Number, min: 0, max: 1, default: null },
        qualification: { type: Number, min: 0, max: 1, default: null },
        experience: { type: Number, min: 0, max: 1, default: null },
        teaching: { type: Number, min: 0, max: 1, default: null },
        certification: { type: Number, min: 0, max: 1, default: null }
    },
    { _id: false, versionKey: false }
);

/**
 * Describes a missing or insufficient requirement for a trainer.
 *
 * @name matchGapSchema
 */
const matchGapSchema = new Schema(
    {
        category: {
            type: String,
            enum: [
                "competency",
                "skill",
                "qualification",
                "certification",
                "experience",
                "teaching"
            ],
            required: true
        },
        label: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200
        },
        have: {
            type: String,
            default: null,
            maxlength: 200
        },
        need: {
            type: String,
            default: null,
            maxlength: 200
        },
        mustHave: {
            type: Boolean,
            default: false,
            required: true
        },
        suggestion: {
            type: String,
            trim: true,
            maxlength: 500
        }
    },
    { _id: false, versionKey: false }
);

/**
 * Stores one trainer's result within a matching run.
 *
 * @name matchResultSchema
 */
const matchResultSchema = new Schema(
    {
        trainer: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        trainerProfile: {
            type: Schema.Types.ObjectId,
            ref: "TrainerProfile",
            required: true
        },
        rank: {
            type: Number,
            min: 1,
            required: true
        },
        score: {
            type: Number,
            min: 0,
            max: 1,
            required: true
        },
        tier: {
            type: String,
            enum: ["strong", "partial", "none"],
            required: true
        },
        provisional: {
            type: Boolean,
            default: false,
            required: true
        },
        atCapacity: {
            type: Boolean,
            default: false,
            required: true
        },
        failedMustHave: {
            type: [String],
            default: []
        },
        breakdown: {
            type: matchScoreBreakdownSchema,
            default: () => ({})
        },
        gaps: {
            type: [matchGapSchema],
            default: []
        },
        explanation: {
            type: [String],
            default: []
        }
    },
    { _id: false, versionKey: false }
);

/**
 * Represents one completed execution of the trainer-matching engine.
 *
 * Requirement and configuration snapshots preserve the exact inputs
 * used during execution. Results are retained as historical records.
 *
 * Existing documents cannot be saved again, updated or deleted.
 *
 * @name matchRunSchema
 */
const matchRunSchema = new Schema(
    {
        org: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            required: true
        },
        requirement: {
            type: Schema.Types.ObjectId,
            ref: "TrainingRequirement",
            required: true
        },
        requirementSnapshot: {
            type: Schema.Types.Mixed,
            required: true
        },
        configSnapshot: {
            type: Schema.Types.Mixed,
            required: true
        },
        algorithmVersion: {
            type: String,
            required: true,
            trim: true
        },
        stats: {
            type: matchRunStatsSchema,
            default: () => ({})
        },
        outcome: {
            type: String,
            enum: [
                "strong_found",
                "partial_only",
                "none_suitable"
            ],
            required: true
        },
        results: {
            type: [matchResultSchema],
            default: []
        },
        executedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
        versionKey: false
    }
);

/**
 * Prevents an existing MatchRun document from being saved again.
 *
 * New documents can be created normally. Existing documents are
 * append-only and must never be modified through document.save().
 */
matchRunSchema.pre("save", function rejectExistingMatchRunSave() {
    if (!this.isNew) {
        throw new Error("MatchRun records are immutable.");
    }
});

/**
 * Blocks query operations that could modify or remove MatchRun records.
 *
 * Mongoose's findByIdAndUpdate() uses findOneAndUpdate middleware,
 * so it is covered by this protection.
 *
 * @name rejectMatchRunMutation
 * @returns {void}
 */
const rejectMatchRunMutation = function () {
    throw new Error("MatchRun records are immutable.");
};

[
    "updateOne",
    "updateMany",
    "findOneAndUpdate",
    "replaceOne",
    "findOneAndReplace",
    "deleteOne",
    "deleteMany",
    "findOneAndDelete"
].forEach((operation) => {
    matchRunSchema.pre(operation, rejectMatchRunMutation);
});

/**
 * Supports retrieving matching history for a requirement.
 */
matchRunSchema.index(
    { org: 1, requirement: 1, createdAt: -1 },
    { name: "match_run_org_requirement_created" }
);

/**
 * Supports retrieving recent matching runs within an organization.
 */
matchRunSchema.index(
    { org: 1, createdAt: -1 },
    { name: "match_run_org_created" }
);

const MatchRun = models.MatchRun || model("MatchRun", matchRunSchema);

export default MatchRun;
