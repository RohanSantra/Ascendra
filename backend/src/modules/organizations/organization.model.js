
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;


/**
 * Stores metadata for an organisation's uploaded logo.
 *
 * The actual file is stored outside MongoDB.
 */
const organizationLogoSchema = new Schema(
    {
        originalName: {
            type: String,
            trim: true,
            maxlength: 255
        },

        storageProvider: {
            type: String,
            enum: ["local", "cloudinary", "s3"]
        },

        storageKey: {
            type: String,
            trim: true
        },

        mimeType: {
            type: String,
            trim: true
        },

        size: {
            type: Number,
            min: 1
        },

        checksum: {
            type: String,
            trim: true
        },

        uploadedAt: {
            type: Date
        }
    },
    {
        _id: false,
        versionKey: false
    }
);


/**
 * Defines organisation-level application settings.
 */
const organizationSettingsSchema = new Schema(
    {
        timezone: {
            type: String,
            default: "Asia/Kolkata",
            trim: true
        },

        defaultMatchingConfig: {
            type: Schema.Types.ObjectId,
            ref: "MatchingConfig",
            default: null
        },

        maximumUploadSize: {
            type: Number,
            default: 10485760,
            min: 1
        },

        allowedMimeTypes: {
            type: [String],
            default: [
                "application/pdf",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.ms-powerpoint",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                "video/mp4"
            ]
        }
    },
    {
        _id: false,
        versionKey: false
    }
);


/**
 * Represents an organisation registered on Ascendra.
 *
 * Multiple organisations can independently use the platform.
 * Organisation-owned records must reference this organisation,
 * and organisation-specific queries must be scoped by its ID.
 *
 * Organisation lifecycle changes are managed by the
 * Platform Administrator.
 */
const organizationSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 150
        },

        slug: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
            maxlength: 160
        },

        description: {
            type: String,
            trim: true,
            maxlength: 2000
        },

        logo: {
            type: organizationLogoSchema,
            default: null
        },

        contactEmail: {
            type: String,
            lowercase: true,
            trim: true,
            maxlength: 254
        },

        contactPhone: {
            type: String,
            trim: true,
            maxlength: 20
        },

        address: {
            type: String,
            trim: true,
            maxlength: 1000
        },

        status: {
            type: String,
            enum: [
                "pending",
                "active",
                "rejected",
                "suspended",
                "deactivated"
            ],
            default: "pending",
            required: true
        },

        /**
         * Records the most recent organisation lifecycle change.
         */
        statusChangedAt: {
            type: Date,
            default: null
        },

        statusChangedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        statusChangeReason: {
            type: String,
            trim: true,
            maxlength: 500,
            default: null
        },

        settings: {
            type: organizationSettingsSchema,
            default: () => ({})
        },

        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true,
        versionKey: "__v",
        optimisticConcurrency: true
    }
);


/**
 * Ensures organisation slugs are globally unique.
 */
organizationSchema.index(
    { slug: 1 },
    {
        unique: true,
        name: "organization_slug_unique"
    }
);


/**
 * Supports organisation lifecycle queries and pending
 * application listing in chronological order.
 */
organizationSchema.index(
    { status: 1, createdAt: 1, _id: 1 },
    {
        name: "organization_status_created_at"
    }
);


const Organization =
    models.Organization || model("Organization", organizationSchema);

export default Organization;
