import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

/**
 * Represents an authenticated user session.
 *
 * Only a hash of the refresh token is stored. The raw token
 * must never be persisted in the database.
 *
 * Expired sessions are automatically eligible for MongoDB TTL
 * cleanup. Authentication logic must still check expiresAt,
 * isActive and revokedAt explicitly.
 *
 * @name sessionSchema
 */
const sessionSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        refreshTokenHash: {
            type: String,
            required: true,
            unique: true,
            select: false
        },
        userAgent: {
            type: String,
            trim: true,
            maxlength: 1000
        },
        ipAddress: {
            type: String,
            trim: true,
            maxlength: 64
        },
        device: {
            type: String,
            trim: true,
            maxlength: 255
        },
        lastUsedAt: {
            type: Date,
            default: Date.now
        },
        expiresAt: {
            type: Date,
            required: true
        },
        isActive: {
            type: Boolean,
            default: true,
            required: true
        },
        revokedAt: {
            type: Date,
            default: null
        },
        revokedReason: {
            type: String,
            enum: [
                "logout",
                "logout_all",
                "token_rotation",
                "password_changed",
                "account_suspended",
                "admin_action"
            ],
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

/**
 * Creates an index for automatic cleanup of expired sessions.
 *
 * This index is not an authentication safeguard. Services must
 * validate session expiry and revocation before accepting a token.
 */
sessionSchema.index(
    { expiresAt: 1 },
    {
        expireAfterSeconds: 0,
        name: "session_expiry_ttl"
    }
);

/**
 * Supports retrieving active sessions for a user.
 */
sessionSchema.index(
    { user: 1, isActive: 1, expiresAt: 1 },
    { name: "session_user_active_expiry" }
);

const Session = models.Session || model("Session", sessionSchema);

export default Session;