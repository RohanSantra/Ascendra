import mongoose from "mongoose";

const { Schema, model, models } = mongoose;


/**
 * Stores feedback submitted by trainees about their courses.
 *
 * Feedback records are organisation-scoped and linked to the
 * course, enrolment, trainee and assigned trainer.
 *
 * The initial implementation supports a simple rating and
 * optional comment. The lifecycle and category fields allow
 * future feedback enhancements without requiring a redesign.
 *
 * @name Feedback
 */
const feedbackSchema = new Schema(
    {
        /**
         * Organisation that owns this feedback record.
         */
        org: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
            immutable: true
        },

        /**
         * Course for which feedback is submitted.
         */
        course: {
            type: Schema.Types.ObjectId,
            ref: "Course",
            required: true,
            immutable: true
        },

        /**
         * Enrolment associated with the feedback.
         */
        enrollment: {
            type: Schema.Types.ObjectId,
            ref: "Enrollment",
            required: true,
            immutable: true
        },

        /**
         * Trainee who submitted the feedback.
         */
        trainee: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            immutable: true
        },

        /**
         * Trainer associated with the course.
         *
         * Stored explicitly to support trainer-level reporting
         * without requiring repeated course lookups.
         */
        trainer: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            immutable: true
        },

        /**
         * Feedback category.
         *
         * The initial implementation uses course feedback.
         * Additional categories can be introduced later.
         */
        category: {
            type: String,
            enum: [
                "course",
                "trainer",
                "material",
                "general"
            ],
            default: "course",
            required: true
        },

        /**
         * Overall feedback rating.
         */
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },

        /**
         * Optional written feedback.
         */
        comment: {
            type: String,
            trim: true,
            maxlength: 2000,
            default: null
        },

        /**
         * Feedback lifecycle status.
         *
         * Hidden feedback is retained for administrative
         * purposes rather than permanently deleted.
         */
        status: {
            type: String,
            enum: [
                "submitted",
                "hidden"
            ],
            default: "submitted",
            required: true
        },

        /**
         * User who changed the feedback visibility.
         */
        statusUpdatedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        /**
         * Date when the feedback status was last changed.
         */
        statusUpdatedAt: {
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
 * Prevents a trainee from submitting multiple feedback records
 * for the same course within an organisation.
 */
feedbackSchema.index(
    {
        org: 1,
        course: 1,
        trainee: 1
    },
    {
        unique: true,
        name: "feedback_org_course_trainee_unique"
    }
);


/**
 * Supports organisation-level feedback reporting.
 */
feedbackSchema.index({
    org: 1,
    status: 1,
    createdAt: -1
});


/**
 * Supports trainer-level feedback reporting.
 */
feedbackSchema.index({
    org: 1,
    trainer: 1,
    status: 1,
    createdAt: -1
});


/**
 * Supports retrieving feedback submitted by a trainee.
 */
feedbackSchema.index({
    org: 1,
    trainee: 1,
    createdAt: -1
});


const Feedback =
    models.Feedback || model("Feedback", feedbackSchema);


export default Feedback;