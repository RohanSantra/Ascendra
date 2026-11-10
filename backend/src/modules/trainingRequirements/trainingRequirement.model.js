
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

/**
 * Defines a competency requirement for a training programme.
 *
 * Each competency can specify a minimum proficiency level, scoring
 * weight and whether it is mandatory.
 *
 * @name requiredCompetencySchema
 */
const requiredCompetencySchema = new Schema(
    {
        competency: {
            type: Schema.Types.ObjectId,
            ref: "Competency",
            required: true
        },
        minLevel: {
            type: Number,
            enum: [1, 2, 3, 4],
            default: 1,
            required: true
        },
        weight: {
            type: Number,
            min: 0,
            default: 1,
            required: true
        },
        mustHave: {
            type: Boolean,
            default: false,
            required: true
        }
    },
    { _id: false, versionKey: false }
);

/**
 * Defines a skill requirement for a training programme.
 *
 * @name requiredSkillSchema
 */
const requiredSkillSchema = new Schema(
    {
        skill: {
            type: Schema.Types.ObjectId,
            ref: "Skill",
            required: true
        },
        mustHave: {
            type: Boolean,
            default: false,
            required: true
        }
    },
    { _id: false, versionKey: false }
);

/**
 * Defines a certification requirement for a training programme.
 *
 * @name requiredCertificationSchema
 */
const requiredCertificationSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 200
        },
        mustHave: {
            type: Boolean,
            default: false,
            required: true
        }
    },
    { _id: false, versionKey: false }
);

/**
 * Represents the trainer requirements for a training programme.
 *
 * Requirements are stored independently of matching runs so they
 * can be edited and matched again. Each MatchRun stores a snapshot
 * of the requirement as it existed at execution time.
 *
 * @name trainingRequirementSchema
 */
const trainingRequirementSchema = new Schema(
    {
        org: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            required: true
        },
        title: {
            type: String,
            required: true,
            trim: true,
            minlength: 3,
            maxlength: 200
        },
        description: {
            type: String,
            trim: true,
            maxlength: 3000
        },
        competencies: {
            type: [requiredCompetencySchema],
            default: []
        },
        requiredSkills: {
            type: [requiredSkillSchema],
            default: []
        },
        qualificationKeywords: {
            type: [String],
            default: [],
            validate: {
                validator: (values) =>
                    values.every(
                        (value) =>
                            typeof value === "string" &&
                            value.trim().length >= 2 &&
                            value.trim().length <= 200
                    ),
                message: "Qualification keywords must contain 2 to 200 characters."
            }
        },
        qualificationMustHave: {
            type: Boolean,
            default: false,
            required: true
        },
        requiredCertifications: {
            type: [requiredCertificationSchema],
            default: []
        },
        minimumExperienceYears: {
            type: Number,
            min: 0,
            default: 0,
            required: true
        },
        minimumTeachingYears: {
            type: Number,
            min: 0,
            default: 0,
            required: true
        },
        status: {
            type: String,
            enum: [
                "draft",
                "ready",
                "matched",
                "assigned",
                "cancelled",
                "archived"
            ],
            default: "draft",
            required: true
        },
        latestMatchRun: {
            type: Schema.Types.ObjectId,
            ref: "MatchRun",
            default: null
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
        versionKey: false
    }
);

/**
 * Supports listing requirements by organization and workflow status.
 */
trainingRequirementSchema.index(
    { org: 1, status: 1, updatedAt: -1 },
    { name: "requirement_org_status_updated" }
);

/**
 * Supports retrieving requirements created by an administrator.
 */
trainingRequirementSchema.index(
    { org: 1, createdBy: 1, createdAt: -1 },
    { name: "requirement_org_creator_created" }
);

const TrainingRequirement =
    models.TrainingRequirement ||
    model("TrainingRequirement", trainingRequirementSchema);

export default TrainingRequirement;
