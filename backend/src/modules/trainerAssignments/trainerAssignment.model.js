
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

/**
 * Represents a trainer assigned to a training requirement.
 *
 * Assignment capacity must be reserved atomically by the assignment
 * service. The active training counter on TrainerProfile must be
 * updated in the same transaction as the assignment creation.
 *
 * @name trainerAssignmentSchema
 */
const trainerAssignmentSchema = new Schema(
    {
        org: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            required: true
        },
        requirement: {
            type: Schema.Types.ObjectId,
            ref: "TrainingRequirement",
            required: true
        },
        matchRun: {
            type: Schema.Types.ObjectId,
            ref: "MatchRun",
            required: true
        },
        trainer: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        trainerProfile: {
            type: Schema.Types.ObjectId,
            ref: "TrainerProfile",
            required: true
        },
        assignedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        status: {
            type: String,
            enum: [
                "assigned",
                "in_progress",
                "completed",
                "cancelled"
            ],
            default: "assigned",
            required: true
        },
        startDate: {
            type: Date,
            required: true
        },
        endDate: {
            type: Date,
            required: true
        },
        assignedAt: {
            type: Date,
            default: Date.now,
            required: true
        },
        cancelledAt: {
            type: Date,
            default: null
        },
        completedAt: {
            type: Date,
            default: null
        },
        cancellationReason: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

/**
 * Ensures the assignment end date is not earlier than its start date.
 */
trainerAssignmentSchema.pre("validate", function validateAssignmentDates() {
    if (
        this.startDate &&
        this.endDate &&
        this.endDate < this.startDate
    ) {
        this.invalidate(
            "endDate",
            "Assignment end date cannot be earlier than its start date."
        );
    }
});

/**
 * Prevents the same trainer profile from being assigned to the same
 * requirement more than once within an organization.
 */
trainerAssignmentSchema.index(
    { org: 1, requirement: 1, trainerProfile: 1 },
    {
        unique: true,
        name: "trainer_assignment_org_requirement_profile_unique"
    }
);

/**
 * Supports listing assignments by organization and status.
 */
trainerAssignmentSchema.index(
    { org: 1, status: 1, startDate: 1 },
    { name: "trainer_assignment_org_status_start" }
);

/**
 * Supports retrieving a trainer's assignments.
 */
trainerAssignmentSchema.index(
    { org: 1, trainerProfile: 1, status: 1 },
    { name: "trainer_assignment_org_profile_status" }
);

const TrainerAssignment =
    models.TrainerAssignment ||
    model("TrainerAssignment", trainerAssignmentSchema);

export default TrainerAssignment;
