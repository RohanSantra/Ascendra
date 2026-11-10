import mongoose from "mongoose";

const { Schema, model, models } = mongoose;


/**
 * Represents a trainee's enrollment in a course.
 *
 * Every enrollment belongs to one organisation, one course
 * and one trainee.
 *
 * Enrollment status tracks the trainee's participation
 * and progress through the course.
 *
 * A trainee can have only one enrollment record for a
 * particular course within an organisation.
 *
 * @name enrollmentSchema
 */
const enrollmentSchema = new Schema(
    {
        org: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            required: true
        },

        course: {
            type: Schema.Types.ObjectId,
            ref: "Course",
            required: true
        },

        trainee: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        status: {
            type: String,
            enum: [
                "enrolled",
                "in_progress",
                "completed",
                "withdrawn",
                "cancelled"
            ],
            default: "enrolled",
            required: true
        },

        enrolledAt: {
            type: Date,
            default: Date.now,
            required: true
        },

        startedAt: {
            type: Date,
            default: null
        },

        completedAt: {
            type: Date,
            default: null
        },

        withdrawnAt: {
            type: Date,
            default: null
        },

        cancelledAt: {
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
 * Prevents duplicate enrollment records for the same
 * trainee and course within an organisation.
 *
 * The unique constraint also preserves enrollment history
 * when a trainee withdraws or an enrollment is cancelled.
 */
enrollmentSchema.index(
    { org: 1, course: 1, trainee: 1 },
    {
        unique: true,
        name: "enrollment_org_course_trainee_unique"
    }
);


/**
 * Supports listing course participants by enrollment status
 * and enrollment date.
 */
enrollmentSchema.index(
    { org: 1, course: 1, status: 1, enrolledAt: -1 },
    {
        name: "enrollment_org_course_status"
    }
);


/**
 * Supports retrieving a trainee's course enrollments
 * filtered by enrollment status.
 */
enrollmentSchema.index(
    { org: 1, trainee: 1, status: 1 },
    {
        name: "enrollment_org_trainee_status"
    }
);


const Enrollment =
    models.Enrollment || model("Enrollment", enrollmentSchema);

export default Enrollment;