import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

/**
 * Represents an organisation-defined skill.
 *
 * A skill is a specific capability that can contribute to one or
 * more broader competencies.
 *
 * @name skillSchema
 */
const skillSchema = new Schema(
    {
        org: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            required: true
        },
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 120
        },
        slug: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
            maxlength: 140
        },
        description: {
            type: String,
            trim: true,
            maxlength: 1500
        },
        competencies: [
            {
                type: Schema.Types.ObjectId,
                ref: "Competency"
            }
        ],
        category: {
            type: String,
            trim: true,
            maxlength: 100
        },
        status: {
            type: String,
            enum: ["active", "archived"],
            default: "active",
            required: true
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
 * Ensures skill slugs are unique within an organization.
 */
skillSchema.index(
    { org: 1, slug: 1 },
    {
        unique: true,
        name: "skill_org_slug_unique"
    }
);

/**
 * Supports listing active skills by organization and category.
 */
skillSchema.index(
    { org: 1, status: 1, category: 1, name: 1 },
    { name: "skill_org_status_category" }
);

/**
 * Supports finding skills associated with a competency.
 */
skillSchema.index(
    { org: 1, competencies: 1 },
    { name: "skill_org_competencies" }
);

const Skill = models.Skill || model("Skill", skillSchema);

export default Skill;