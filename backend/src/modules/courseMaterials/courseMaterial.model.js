import mongoose from "mongoose";

const { Schema, model, models } = mongoose;


/**
 * Stores metadata for an uploaded course material file.
 *
 * The actual file is stored outside MongoDB.
 * Cloudinary is the current storage provider.
 *
 * The storage key identifies the resource without exposing
 * Cloudinary credentials or requiring a public URL.
 *
 * @name courseMaterialFileSchema
 */
const courseMaterialFileSchema = new Schema(
    {
        /**
         * Original filename supplied by the uploader.
         */
        originalName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 255
        },

        /**
         * External storage provider.
         */
        storageProvider: {
            type: String,
            enum: ["local", "cloudinary", "s3"],
            required: true
        },

        /**
         * Storage resource identifier.
         *
         * For Cloudinary:
         * resourceType:publicId
         */
        storageKey: {
            type: String,
            required: true,
            trim: true
        },

        /**
         * Cloudinary asset identifier.
         *
         * This is useful for resource management and auditing.
         */
        assetId: {
            type: String,
            trim: true,
            default: null
        },

        /**
         * Cloudinary resource type.
         *
         * raw: PDFs, documents and presentations.
         * video: video files.
         */
        resourceType: {
            type: String,
            enum: ["raw", "video", null],
            default: null
        },

        /**
         * MIME type reported and verified during upload.
         */
        mimeType: {
            type: String,
            required: true,
            trim: true,
            maxlength: 150
        },

        /**
         * Actual file size in bytes.
         */
        size: {
            type: Number,
            required: true,
            min: 1
        },

        /**
         * Optional SHA-256 checksum.
         *
         * Cloudinary verification currently does not calculate
         * a checksum for every uploaded file.
         */
        checksum: {
            type: String,
            trim: true,
            default: null
        },

        /**
         * File format, for example:
         * pdf, docx, pptx, mp4.
         */
        format: {
            type: String,
            trim: true,
            lowercase: true,
            default: null
        },

        /**
         * Date when the upload was confirmed.
         */
        uploadedAt: {
            type: Date,
            default: Date.now,
            required: true
        }
    },
    {
        _id: false,
        versionKey: false
    }
);


/**
 * Represents an organisation's uploaded course material.
 *
 * Every material belongs to exactly one organisation and course.
 * The file itself is stored externally.
 *
 * @name courseMaterialSchema
 */
const courseMaterialSchema = new Schema(
    {
        /**
         * Organisation that owns this material.
         */
        org: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
            index: true
        },

        /**
         * Course associated with this material.
         */
        course: {
            type: Schema.Types.ObjectId,
            ref: "Course",
            required: true,
            index: true
        },

        /**
         * Display title.
         */
        title: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 200
        },

        /**
         * Optional material description.
         */
        description: {
            type: String,
            trim: true,
            maxlength: 1500,
            default: ""
        },

        /**
         * Material classification.
         */
        materialType: {
            type: String,
            enum: [
                "pdf",
                "document",
                "presentation",
                "video",
                "other"
            ],
            required: true
        },

        /**
         * External file metadata.
         */
        file: {
            type: courseMaterialFileSchema,
            required: true
        },

        /**
         * User who uploaded the material.
         */
        uploadedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        /**
         * Controls ordering in the course material list.
         */
        displayOrder: {
            type: Number,
            min: 0,
            default: 0,
            required: true
        },

        /**
         * Material lifecycle status.
         */
        status: {
            type: String,
            enum: ["active", "archived"],
            default: "active",
            required: true
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);


/**
 * Efficient organisation-scoped course material listing.
 */
courseMaterialSchema.index(
    {
        org: 1,
        course: 1,
        status: 1,
        displayOrder: 1
    },
    {
        name: "course_material_org_course_order"
    }
);


/**
 * Prevents accidental duplicate Cloudinary asset registration.
 */
courseMaterialSchema.index(
    {
        "file.storageProvider": 1,
        "file.assetId": 1
    },
    {
        unique: true,
        partialFilterExpression: {
            "file.storageProvider": "cloudinary",
            "file.assetId": {
                $type: "string"
            }
        },
        name: "course_material_cloudinary_asset_unique"
    }
);


const CourseMaterial =
    models.CourseMaterial ||
    model("CourseMaterial", courseMaterialSchema);


export default CourseMaterial;