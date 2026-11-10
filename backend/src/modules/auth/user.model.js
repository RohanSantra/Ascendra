import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

/**
 * Stores metadata for a user's uploaded profile image.
 *
 * The actual file is stored outside MongoDB. This subdocument
 * stores only the information required to locate and validate it.
 *
 * @name profileImageSchema
 */
const profileImageSchema = new Schema(
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
 * Represents a registered Ascendra user.
 *
 * A user is a global identity and can belong to multiple
 * organisations through OrganizationMembership records.
 *
 * The platformRole field is reserved for platform-level
 * permissions. Organisation-specific roles and approval
 * statuses are managed through OrganizationMembership.
 *
 * @name userSchema
 */
const userSchema = new Schema(
    {
        firstName: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 60
        },

        lastName: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 60
        },

        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            maxlength: 254
        },

        passwordHash: {
            type: String,
            select: false
        },

        phone: {
            type: String,
            trim: true,
            maxlength: 20
        },

        profileImage: {
            type: profileImageSchema,
            default: null
        },

        /**
         * Global platform-level role.
         *
         * Organisation-level roles must never be stored here.
         */
        platformRole: {
            type: String,
            enum: ["user", "platform_admin"],
            default: "user",
            required: true
        },

        status: {
            type: String,
            enum: ["active", "suspended", "deactivated"],
            default: "active",
            required: true
        },

        lastLoginAt: {
            type: Date,
            default: null
        },

        passwordChangedAt: {
            type: Date,
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
 * Ensures email uniqueness after normalization.
 *
 * Email is globally unique because one person must have
 * one account even when they belong to multiple organisations.
 */
userSchema.index(
    { email: 1 },
    {
        unique: true,
        name: "user_email_unique"
    }
);

const User = models.User || model("User", userSchema);

export default User;