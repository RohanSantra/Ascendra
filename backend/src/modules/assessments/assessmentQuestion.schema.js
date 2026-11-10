import mongoose from "mongoose";

const { Schema } = mongoose;


/**
 * Represents one option within an MCQ question.
 *
 * @name assessmentOptionSchema
 */
const assessmentOptionSchema = new Schema(
    {
        optionId: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 64
        },

        text: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 1000
        }
    },
    {
        _id: false,
        versionKey: false
    }
);


/**
 * Represents one MCQ question and its answer key.
 *
 * The correct option is stored for server-side evaluation only.
 * It must never be exposed through trainee-facing API responses.
 *
 * Each question must contain between two and ten options.
 * Option IDs must be unique, and the correct option must reference
 * one of the configured options.
 *
 * @name assessmentQuestionSchema
 */
const assessmentQuestionSchema = new Schema(
    {
        questionId: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 64
        },

        questionText: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 3000
        },

        options: {
            type: [assessmentOptionSchema],
            required: true,
            validate: [
                {
                    validator: (options) =>
                        options.length >= 2 &&
                        options.length <= 10,
                    message: "A question must have between 2 and 10 options."
                },
                {
                    validator: (options) =>
                        new Set(
                            options.map((option) => option.optionId)
                        ).size === options.length,
                    message: "Option IDs must be unique within a question."
                }
            ]
        },

        correctOptionId: {
            type: String,
            required: true,
            select: false,
            trim: true,
            minlength: 1,
            maxlength: 64
        },

        marks: {
            type: Number,
            required: true,
            min: 0.01,
            default: 1
        },

        explanation: {
            type: String,
            trim: true,
            maxlength: 2000
        }
    },
    {
        _id: false,
        versionKey: false
    }
);


/**
 * Ensures that the correct answer references an existing option.
 */
assessmentQuestionSchema.pre("validate", function () {
    if (
        this.correctOptionId &&
        Array.isArray(this.options) &&
        !this.options.some(
            (option) => option.optionId === this.correctOptionId
        )
    ) {
        this.invalidate(
            "correctOptionId",
            "The correct option ID must reference one of the question's options."
        );
    }
});


export default assessmentQuestionSchema;