import mongoose from "mongoose";

const { Schema, model, models } = mongoose;


/**
 * Tracks an individual trainee's progress through a course material.
 *
 * Each progress record belongs to one organisation, course,
 * enrolment, trainee and course material.
 *
 * Progress records are retained independently so that course
 * completion and learning history can be calculated reliably.
 *
 * @name learningProgressSchema
 */
const learningProgressSchema = new Schema(
    {
        /**
         * Organisation that owns this learning progress record.
         */
        org: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            required: true
        },

        /**
         * Course associated with the learning progress.
         */
        course: {
            type: Schema.Types.ObjectId,
            ref: "Course",
            required: true
        },

        /**
         * Enrolment associated with the trainee's course participation.
         */
        enrollment: {
            type: Schema.Types.ObjectId,
            ref: "Enrollment",
            required: true
        },

        /**
         * Trainee whose learning progress is being tracked.
         */
        trainee: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        /**
         * Course material associated with this progress record.
         */
        material: {
            type: Schema.Types.ObjectId,
            ref: "CourseMaterial",
            required: true
        },

        /**
         * Current learning progress status.
         */
        status: {
            type: String,
            enum: [
                "not_started",
                "in_progress",
                "completed"
            ],
            default: "not_started",
            required: true
        },

        /**
         * Date when the trainee first started this material.
         */
        startedAt: {
            type: Date,
            default: null
        },

        /**
         * Date when the trainee last accessed this material.
         */
        lastAccessedAt: {
            type: Date,
            default: null
        },

        /**
         * Date when the trainee completed this material.
         */
        completedAt: {
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
 * Ensures that a trainee has only one progress record
 * for a particular material within an organisation and course.
 */
learningProgressSchema.index(
    {
        org: 1,
        course: 1,
        trainee: 1,
        material: 1
    },
    {
        unique: true,
        name: "learning_progress_org_course_trainee_material_unique"
    }
);


/**
 * Supports retrieving a trainee's progress within a course.
 */
learningProgressSchema.index({
    org: 1,
    course: 1,
    trainee: 1,
    status: 1
});


/**
 * Supports retrieving progress records associated with an enrolment.
 */
learningProgressSchema.index({
    org: 1,
    enrollment: 1,
    status: 1
});


/**
 * Supports organisation-scoped reporting of material completion.
 */
learningProgressSchema.index({
    org: 1,
    course: 1,
    material: 1,
    status: 1
});


const LearningProgress =
    models.LearningProgress ||
    model("LearningProgress", learningProgressSchema);

export default LearningProgress;