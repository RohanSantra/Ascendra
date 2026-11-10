
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

/**
 * Represents a training course created from an approved trainer assignment.
 *
 * Every course must be associated with exactly one trainer assignment.
 * The trainer, trainer profile and requirement references are retained
 * to support course ownership and reporting.
 *
 * @name courseSchema
 */
const courseSchema = new Schema(
    {
        org: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            required: true
        },
        title: {
            type: String,
            required: true,
            trim: true,
            minlength: 3,
            maxlength: 200
        },
        description: {
            type: String,
            trim: true,
            maxlength: 3000
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
        trainerAssignment: {
            type: Schema.Types.ObjectId,
            ref: "TrainerAssignment",
            required: true
        },
        requirement: {
            type: Schema.Types.ObjectId,
            ref: "TrainingRequirement",
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
        status: {
            type: String,
            enum: [
                "draft",
                "published",
                "ongoing",
                "completed",
                "cancelled",
                "archived"
            ],
            default: "draft",
            required: true
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

/**
 * Ensures a course end date is not earlier than its start date.
 */
courseSchema.pre("validate", function validateCourseDates() {
    if (
        this.startDate &&
        this.endDate &&
        this.endDate < this.startDate
    ) {
        this.invalidate(
            "endDate",
            "Course end date cannot be earlier than its start date."
        );
    }
});

/**
 * Ensures a trainer assignment is linked to at most one course.
 */
courseSchema.index(
    { trainerAssignment: 1 },
    {
        unique: true,
        name: "course_trainer_assignment_unique"
    }
);

/**
 * Supports listing courses by organization and status.
 */
courseSchema.index(
    { org: 1, status: 1, startDate: 1 },
    { name: "course_org_status_start" }
);

/**
 * Supports retrieving courses assigned to a trainer.
 */
courseSchema.index(
    { org: 1, trainer: 1, status: 1 },
    { name: "course_org_trainer_status" }
);

const Course = models.Course || model("Course", courseSchema);

export default Course;
