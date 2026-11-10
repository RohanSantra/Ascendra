import mongoose from "mongoose";

import assessmentQuestionSchema from "./assessmentQuestion.schema.js";

const { Schema, model, models } = mongoose;


/**
 * Stores a trainee's selected option for one assessment question.
 *
 * Correct answers are not stored in the trainee's answer record.
 *
 * @name assessmentAnswerSchema
 */
const assessmentAnswerSchema = new Schema(
    {
        questionId: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 64
        },

        selectedOptionId: {
            type: String,
            trim: true,
            minlength: 1,
            maxlength: 64,
            default: null
        }
    },
    {
        _id: false,
        versionKey: false
    }
);


/**
 * Stores the immutable assessment content used when an attempt starts.
 *
 * This snapshot includes the correct answers for server-side evaluation.
 * It must never be returned through trainee-facing API responses.
 *
 * The snapshot preserves the assessment rules that applied when
 * the trainee started the attempt.
 *
 * @name assessmentAttemptSnapshotSchema
 */
const assessmentAttemptSnapshotSchema = new Schema(
    {
        title: {
            type: String,
            required: true
        },

        description: {
            type: String,
            default: null
        },

        questions: {
            type: [assessmentQuestionSchema],
            required: true
        },

        totalMarks: {
            type: Number,
            required: true,
            min: 0
        },

        passingPercentage: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },

        durationMinutes: {
            type: Number,
            required: true,
            min: 1
        }
    },
    {
        _id: false,
        versionKey: false
    }
);


/**
 * Represents one trainee's attempt at a specific assessment version.
 *
 * The attempt retains its original assessment snapshot so that
 * later assessment edits do not change its evaluation criteria.
 *
 * The server enforces expiresAt and changes overdue in-progress
 * attempts to expired.
 *
 * Scores and percentages are calculated by the assessment service.
 *
 * @name assessmentAttemptSchema
 */
const assessmentAttemptSchema = new Schema(
    {
        org: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            required: true
        },

        assessment: {
            type: Schema.Types.ObjectId,
            ref: "Assessment",
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

        attemptNumber: {
            type: Number,
            min: 1,
            required: true
        },

        assessmentVersion: {
            type: Number,
            min: 1,
            required: true
        },

        assessmentSnapshot: {
            type: assessmentAttemptSnapshotSchema,
            required: true,
            select: false
        },

        answers: {
            type: [assessmentAnswerSchema],
            default: [],
            validate: {
                validator: (answers) =>
                    new Set(
                        answers.map((answer) => answer.questionId)
                    ).size === answers.length,
                message: "A question can only have one answer record per attempt."
            }
        },

        score: {
            type: Number,
            min: 0,
            default: null
        },

        totalMarks: {
            type: Number,
            min: 0,
            required: true
        },

        percentage: {
            type: Number,
            min: 0,
            max: 100,
            default: null
        },

        status: {
            type: String,
            enum: [
                "in_progress",
                "submitted",
                "evaluated",
                "expired"
            ],
            default: "in_progress",
            required: true
        },

        startedAt: {
            type: Date,
            default: Date.now,
            required: true
        },

        expiresAt: {
            type: Date,
            required: true
        },

        submittedAt: {
            type: Date,
            default: null
        },

        evaluatedAt: {
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
 * Validates attempt scoring consistency.
 *
 * A score cannot exceed the total marks.
 * A percentage cannot be recorded without a valid score.
 */
assessmentAttemptSchema.pre("validate", function () {
    if (
        this.score !== null &&
        this.score !== undefined &&
        this.score > this.totalMarks
    ) {
        this.invalidate(
            "score",
            "The assessment score cannot exceed the total marks."
        );
    }

    if (
        this.percentage !== null &&
        this.percentage !== undefined &&
        (
            this.score === null ||
            this.score === undefined ||
            this.totalMarks <= 0
        )
    ) {
        this.invalidate(
            "percentage",
            "A percentage requires a valid score and positive total marks."
        );
    }
});


/**
 * Prevents duplicate attempt numbers for a trainee and assessment.
 */
assessmentAttemptSchema.index(
    {
        org: 1,
        assessment: 1,
        trainee: 1,
        attemptNumber: 1
    },
    {
        unique: true,
        name: "assessment_attempt_org_assessment_trainee_number_unique"
    }
);


/**
 * Supports retrieving a trainee's attempts for an assessment.
 */
assessmentAttemptSchema.index(
    {
        org: 1,
        assessment: 1,
        trainee: 1,
        status: 1
    },
    {
        name: "assessment_attempt_org_assessment_trainee_status"
    }
);


/**
 * Supports finding attempts that have passed their deadlines.
 */
assessmentAttemptSchema.index(
    {
        org: 1,
        status: 1,
        expiresAt: 1
    },
    {
        name: "assessment_attempt_org_status_expiry"
    }
);


/**
 * Supports retrieving assessment attempts associated with a course.
 */
assessmentAttemptSchema.index(
    {
        org: 1,
        course: 1,
        trainee: 1,
        createdAt: -1
    },
    {
        name: "assessment_attempt_org_course_trainee"
    }
);


const AssessmentAttempt =
    models.AssessmentAttempt ||
    model("AssessmentAttempt", assessmentAttemptSchema);

export default AssessmentAttempt;