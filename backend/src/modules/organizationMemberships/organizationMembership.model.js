import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

/**
 * Represents a user's membership and role within an organization.
 *
 * Membership approval is separate from trainer eligibility approval.
 * A trainer can have an approved membership while their TrainerProfile
 * is still pending review.
 *
 * @name organizationMembershipSchema
 */
const organizationMembershipSchema = new Schema(
    {
        org: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            required: true
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        role: {
            type: String,
            enum: ["admin", "trainer", "trainee"],
            required: true
        },
        status: {
            type: String,
            enum: [
                "pending",
                "approved",
                "rejected",
                "suspended"
            ],
            default: "pending",
            required: true
        },
        joinedAt: {
            type: Date,
            default: null
        },
        approvedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        approvedAt: {
            type: Date,
            default: null
        },
        rejectedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        rejectedAt: {
            type: Date,
            default: null
        },
        rejectionReason: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: null
        },
        suspendedAt: {
            type: Date,
            default: null
        },
        suspendedBy: {
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
 * Prevents a user from having duplicate membership records
 * within the same organization.
 */
organizationMembershipSchema.index(
    { org: 1, user: 1 },
    {
        unique: true,
        name: "membership_org_user_unique"
    }
);

/**
 * Supports organization membership lists filtered by role and status.
 */
organizationMembershipSchema.index(
    { org: 1, role: 1, status: 1 },
    { name: "membership_org_role_status" }
);

/**
 * Supports retrieving a user's memberships and approval states.
 */
organizationMembershipSchema.index(
    { user: 1, status: 1 },
    { name: "membership_user_status" }
);

const OrganizationMembership =
    models.OrganizationMembership ||
    model("OrganizationMembership", organizationMembershipSchema);

export default OrganizationMembership;