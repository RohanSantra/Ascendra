import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

/**
 * Represents an organisation-defined competency.
 *
 * Competencies describe broad areas of capability. Trainers demonstrate
 * these competencies through verified or self-reported evidence.
 *
 * @name competencySchema
 */
const competencySchema = new Schema(
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
 * Ensures competency slugs are unique within an organization.
 */
competencySchema.index(
    { org: 1, slug: 1 },
    {
        unique: true,
        name: "competency_org_slug_unique"
    }
);

/**
 * Supports listing active competencies by organization and category.
 */
competencySchema.index(
    { org: 1, status: 1, category: 1, name: 1 },
    { name: "competency_org_status_category" }
);

const Competency =
    models.Competency || model("Competency", competencySchema);

export default Competency;