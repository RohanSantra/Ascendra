import mongoose from "mongoose";

const { Schema, model, models } = mongoose;


/**
 * Tracks a short-lived authorization to upload one course material.
 *
 * An upload intent is created before the browser uploads directly
 * to Cloudinary. Confirmation must match this record exactly.
 *
 * Expired intents are automatically removed by MongoDB's TTL index.
 */
const courseMaterialUploadIntentSchema = new Schema(
    {
        org: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
            index: true
        },

        course: {
            type: Schema.Types.ObjectId,
            ref: "Course",
            required: true,
            index: true
        },

        uploadedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        publicId: {
            type: String,
            required: true,
            trim: true,
            unique: true
        },

        resourceType: {
            type: String,
            enum: ["raw", "video"],
            required: true
        },

        originalName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 255
        },

        mimeType: {
            type: String,
            required: true,
            trim: true,
            maxlength: 150
        },

        size: {
            type: Number,
            required: true,
            min: 1
        },

        status: {
            type: String,
            enum: ["pending", "consumed"],
            default: "pending",
            required: true
        },

        expiresAt: {
            type: Date,
            required: true
        },

        consumedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);


/**
 * Supports finding pending upload intents for a course and user.
 */
courseMaterialUploadIntentSchema.index(
    {
        org: 1,
        course: 1,
        uploadedBy: 1,
        status: 1
    },
    {
        name: "course_material_upload_intent_lookup"
    }
);


/**
 * Automatically removes expired upload intents.
 *
 * MongoDB TTL deletion is asynchronous, so application logic
 * must still explicitly check expiresAt before confirmation.
 */
courseMaterialUploadIntentSchema.index(
    {
        expiresAt: 1
    },
    {
        expireAfterSeconds: 0,
        name: "course_material_upload_intent_expiry"
    }
);


const CourseMaterialUploadIntent =
    models.CourseMaterialUploadIntent ||
    model(
        "CourseMaterialUploadIntent",
        courseMaterialUploadIntentSchema
    );


export default CourseMaterialUploadIntent;