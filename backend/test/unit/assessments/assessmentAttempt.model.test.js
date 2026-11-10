import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import AssessmentAttempt from "../../../src/modules/assessments/assessmentAttempt.model.js";

const createAttempt = (overrides = {}) => new AssessmentAttempt({
    org: new mongoose.Types.ObjectId(),
    assessment: new mongoose.Types.ObjectId(),
    course: new mongoose.Types.ObjectId(),
    trainee: new mongoose.Types.ObjectId(),
    attemptNumber: 1,
    assessmentVersion: 1,
    assessmentSnapshot: {
        title: "Assessment title",
        questions: [{
            questionId: "question-1",
            questionText: "Pick the correct option.",
            options: [
                { optionId: "option-1", text: "First" },
                { optionId: "option-2", text: "Second" }
            ],
            correctOptionId: "option-2",
            marks: 2
        }],
        totalMarks: 2,
        passingPercentage: 50,
        durationMinutes: 30
    },
    totalMarks: 2,
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides
});

test("accepts an unanswered response and enforces unique answers per question", async () => {
    const attempt = createAttempt({
        answers: [{
            questionId: "question-1",
            selectedOptionId: null
        }]
    });

    await attempt.validate();
    assert.equal(attempt.answers[0].selectedOptionId, null);

    const duplicateAnswer = createAttempt({
        answers: [
            { questionId: "question-1", selectedOptionId: "option-1" },
            { questionId: "question-1", selectedOptionId: "option-2" }
        ]
    });

    await assert.rejects(duplicateAnswer.validate(), (error) => {
        assert.ok(error.errors.answers);
        return true;
    });
});

test("rejects scores above the maximum and percentages without a valid score", async () => {
    const overScored = createAttempt({
        score: 3
    });

    await assert.rejects(overScored.validate(), (error) => {
        assert.ok(error.errors.score);
        return true;
    });

    const percentageWithoutScore = createAttempt({
        percentage: 50
    });

    await assert.rejects(percentageWithoutScore.validate(), (error) => {
        assert.ok(error.errors.percentage);
        return true;
    });
});

test("keeps the assessment snapshot excluded from default projections", () => {
    assert.equal(
        AssessmentAttempt.schema.path("assessmentSnapshot").options.select,
        false
    );
    assert.equal(
        AssessmentAttempt.schema.path("assessmentSnapshot").schema
            .path("questions").schema.path("correctOptionId").options.select,
        false
    );
});
