import mongoose from "mongoose";
import assessmentQuestionSchema from "./assessmentQuestion.schema.js";

const { Schema, model, models } = mongoose;


/**
 * Represents a versioned MCQ assessment associated with a course.
 *
 * Each independently created assessment receives a unique assessmentKey.
 * All subsequent versions of that assessment retain the same key.
 *
 * Published assessment changes must create a new version. Existing
 * attempts retain the assessment version and snapshot they started with.
 *
 * @name assessmentSchema
 */
const assessmentSchema = new Schema(
    {
        /**
         * Organisation that owns this assessment.
         *
         * @type {ObjectId}
         */
        org: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            required: true
        },

        /**
         * Course associated with this assessment.
         *
         * @type {ObjectId}
         */
        course: {
            type: Schema.Types.ObjectId,
            ref: "Course",
            required: true
        },

        /**
         * Stable identifier shared by every version of one assessment.
         *
         * Different assessments within the same course have different keys.
         *
         * @type {ObjectId}
         */
        assessmentKey: {
            type: Schema.Types.ObjectId,
            default: () => new mongoose.Types.ObjectId(),
            required: true,
            immutable: true
        },

        /**
         * Assessment title.
         *
         * @type {String}
         */
        title: {
            type: String,
            required: true,
            trim: true,
            minlength: 3,
            maxlength: 200
        },

        /**
         * Optional assessment description.
         *
         * @type {String}
         */
        description: {
            type: String,
            trim: true,
            maxlength: 2000,
            default: ""
        },

        /**
         * Questions belonging to this assessment version.
         *
         * @type {Array}
         */
        questions: {
            type: [assessmentQuestionSchema],
            default: []
        },

        /**
         * Total marks calculated from the question marks.
         *
         * @type {Number}
         */
        totalMarks: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },

        /**
         * Minimum percentage required to pass.
         *
         * @type {Number}
         */
        passingPercentage: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
            default: 40
        },

        /**
         * Maximum time allowed for an attempt, in minutes.
         *
         * @type {Number}
         */
        durationMinutes: {
            type: Number,
            required: true,
            min: 1,
            max: 600
        },

        /**
         * Maximum number of attempts permitted per trainee.
         *
         * @type {Number}
         */
        maxAttempts: {
            type: Number,
            required: true,
            min: 1,
            default: 1
        },

        /**
         * Version number within this assessment series.
         *
         * Each new assessment starts at version 1.
         * Subsequent versions increment this number.
         *
         * @type {Number}
         */
        version: {
            type: Number,
            required: true,
            min: 1,
            default: 1
        },

        /**
         * Current lifecycle status of this assessment version.
         *
         * @type {String}
         */
        status: {
            type: String,
            enum: [
                "draft",
                "published",
                "archived"
            ],
            default: "draft",
            required: true
        },

        /**
         * User who created this assessment version.
         *
         * @type {ObjectId}
         */
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        /**
         * Date and time when this version was published.
         *
         * @type {Date}
         */
        publishedAt: {
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
 * Ensures question identifiers are unique within an assessment version.
 *
 * @returns {boolean} Whether all question identifiers are unique.
 */
assessmentSchema.path("questions").validate(
    function (questions) {
        const questionIds = questions.map(
            (question) => question.questionId
        );

        return questionIds.length === new Set(questionIds).size;
    },
    "Question identifiers must be unique within an assessment."
);


/**
 * Calculates total marks from the assessment questions.
 *
 * The stored total is always derived from the question marks.
 */
assessmentSchema.pre("validate", function () {
    this.totalMarks = this.questions.reduce(
        (total, question) => total + question.marks,
        0
    );
});


/**
 * Prevents duplicate version numbers within an assessment series.
 *
 * A separate assessment in the same course can independently have
 * its own version 1.
 */
assessmentSchema.index(
    {
        org: 1,
        course: 1,
        assessmentKey: 1,
        version: 1
    },
    {
        unique: true,
        name: "assessment_org_course_series_version_unique"
    }
);


/**
 * Allows only one published version within an assessment series.
 *
 * A new version must replace the previously published version.
 */
assessmentSchema.index(
    {
        org: 1,
        course: 1,
        assessmentKey: 1
    },
    {
        unique: true,
        partialFilterExpression: {
            status: "published"
        },
        name: "assessment_one_published_version_per_series_unique"
    }
);


/**
 * Supports organisation-scoped assessment listing by course and status.
 */
assessmentSchema.index(
    {
        org: 1,
        course: 1,
        status: 1
    },
    {
        name: "assessment_org_course_status"
    }
);


const Assessment =
    models.Assessment ||
    model("Assessment", assessmentSchema);

export default Assessment;