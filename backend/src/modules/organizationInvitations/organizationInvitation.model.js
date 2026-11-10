
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

/**
 * Organisation Invitation Model
 *
 * Stores invitations sent by an organisation administrator
 * to users who are invited to join the organisation.
 *
 * Security:
 * - The raw invitation token is never stored.
 * - Only the SHA-256 hash of the token is persisted.
 * - The token hash is excluded from query results by default.
 *
 * Invitation lifecycle:
 * pending -> accepted
 * pending -> revoked
 * pending -> expired
 *
 * Supported invitation roles:
 * - trainer
 * - trainee
 *
 * Platform administrator and organisation administrator
 * roles cannot be assigned through invitations.
 */
const organizationInvitationSchema = new Schema(
    {
        /**
         * Organisation to which the user is being invited.
         */
        org: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            required: true
        },

        /**
         * Email address of the invited user.
         *
         * Normalised to lowercase to prevent duplicate
         * invitations caused by email casing differences.
         */
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            maxlength: 254
        },

        /**
         * Membership role assigned after successful acceptance.
         *
         * Administrative roles are intentionally excluded.
         */
        role: {
            type: String,
            enum: ["trainer", "trainee"],
            required: true
        },

        /**
         * SHA-256 hash of the raw invitation token.
         *
         * The original token is sent to the invited user's email
         * but is never persisted in the database.
         */
        tokenHash: {
            type: String,
            required: true,
            select: false
        },

        /**
         * Current invitation lifecycle status.
         */
        status: {
            type: String,
            enum: [
                "pending",
                "accepted",
                "revoked",
                "expired"
            ],
            default: "pending",
            required: true
        },

        /**
         * Organisation administrator who created the invitation.
         */
        invitedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        /**
         * Date and time after which the invitation is invalid.
         */
        expiresAt: {
            type: Date,
            required: true
        },

        /**
         * User who successfully accepted the invitation.
         */
        acceptedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        /**
         * Date and time when the invitation was accepted.
         */
        acceptedAt: {
            type: Date,
            default: null
        },

        /**
         * Administrator who revoked the invitation.
         */
        revokedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        /**
         * Date and time when the invitation was revoked.
         */
        revokedAt: {
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
 * Index: One pending invitation per organisation and email.
 *
 * The partial unique index allows historical invitations
 * to remain in the database while preventing multiple
 * simultaneously pending invitations for the same email.
 */
organizationInvitationSchema.index(
    { org: 1, email: 1 },
    {
        unique: true,
        partialFilterExpression: {
            status: "pending"
        },
        name: "one_pending_invitation_per_org_email"
    }
);

/**
 * Index: Unique invitation token hash.
 *
 * Ensures that each stored token hash belongs to only
 * one invitation.
 */
organizationInvitationSchema.index(
    { tokenHash: 1 },
    {
        unique: true,
        name: "invitation_token_hash_unique"
    }
);

/**
 * Index: Organisation invitation listing.
 *
 * Supports organisation-scoped invitation queries,
 * status filtering, and newest-first sorting.
 */
organizationInvitationSchema.index(
    { org: 1, status: 1, createdAt: -1 },
    {
        name: "invitation_org_status_created"
    }
);

/**
 * Reuse the existing model during development to prevent
 * Mongoose model recompilation errors.
 */
const OrganizationInvitation =
    models.OrganizationInvitation ||
    model(
        "OrganizationInvitation",
        organizationInvitationSchema
    );

export default OrganizationInvitation;
