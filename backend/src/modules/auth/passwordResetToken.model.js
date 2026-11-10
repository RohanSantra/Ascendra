import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

/**
 * Stores only a hash of a single-use password-reset token.
 *
 * Expired records are removed by MongoDB TTL cleanup; reset
 * operations must still enforce expiresAt when consuming a token.
 */
const passwordResetTokenSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true
        },
        tokenHash: {
            type: String,
            required: true,
            unique: true,
            select: false
        },
        expiresAt: {
            type: Date,
            required: true
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

passwordResetTokenSchema.index(
    { expiresAt: 1 },
    {
        expireAfterSeconds: 0,
        name: "password_reset_token_expiry"
    }
);

const PasswordResetToken =
    models.PasswordResetToken ||
    model("PasswordResetToken", passwordResetTokenSchema);

export default PasswordResetToken;
