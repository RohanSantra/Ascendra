import test from "node:test";
import assert from "node:assert/strict";

import {
    createAssessmentSchema,
    updateAssessmentSchema,
    listAssessmentsQuerySchema
} from "../../../src/modules/assessments/assessment.validation.js";

const validQuestion = {
    questionId: "question-1",
    questionText: "Which option is correct?",
    options: [
        { optionId: "option-1", text: "First" },
        { optionId: "option-2", text: "Second" }
    ],
    correctOptionId: "option-2"
};

const validCreatePayload = () => ({
    params: {
        courseId: "507f1f77bcf86cd799439011"
    },
    body: {
        title: "Course assessment",
        questions: [validQuestion],
        durationMinutes: 30
    }
});

test("applies assessment creation defaults and trims question fields", () => {
    const result = createAssessmentSchema.parse(validCreatePayload());

    assert.equal(result.body.title, "Course assessment");
    assert.equal(result.body.description, "");
    assert.equal(result.body.passingPercentage, 40);
    assert.equal(result.body.maxAttempts, 1);
    assert.equal(result.body.questions[0].marks, 1);
    assert.equal(result.body.questions[0].explanation, "");
    assert.equal(result.body.questions[0].options[0].text, "First");
});

test("rejects duplicate question and option IDs and an unreferenced correct option", () => {
    const duplicateQuestions = validCreatePayload();
    duplicateQuestions.body.questions = [
        validQuestion,
        { ...validQuestion }
    ];

    assert.equal(
        createAssessmentSchema.safeParse(duplicateQuestions).success,
        false
    );

    const duplicateOptions = validCreatePayload();
    duplicateOptions.body.questions[0].options[1].optionId = "option-1";

    assert.equal(
        createAssessmentSchema.safeParse(duplicateOptions).success,
        false
    );

    const missingAnswer = validCreatePayload();
    missingAnswer.body.questions[0].correctOptionId = "not-an-option";

    assert.equal(
        createAssessmentSchema.safeParse(missingAnswer).success,
        false
    );
});

test("requires at least one update field and rejects unknown assessment fields", () => {
    const params = {
        assessmentId: "507f1f77bcf86cd799439011"
    };

    assert.equal(
        updateAssessmentSchema.safeParse({
            params,
            body: {}
        }).success,
        false
    );

    assert.equal(
        updateAssessmentSchema.safeParse({
            params,
            body: { status: "published" }
        }).success,
        false
    );
});

test("coerces and defaults listing pagination and sorting", () => {
    const result = listAssessmentsQuerySchema.parse({
        params: {
            courseId: "507f1f77bcf86cd799439011"
        },
        query: {
            page: "3",
            limit: "15"
        }
    });

    assert.deepEqual(result.query, {
        page: 3,
        limit: 15,
        sortBy: "createdAt",
        sortOrder: "desc"
    });
});
