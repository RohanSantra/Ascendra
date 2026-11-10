import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import Assessment from "../../../src/modules/assessments/assessment.model.js";

const createAssessment = (overrides = {}) => new Assessment({
    org: new mongoose.Types.ObjectId(),
    course: new mongoose.Types.ObjectId(),
    title: "Assessment title",
    durationMinutes: 30,
    createdBy: new mongoose.Types.ObjectId(),
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
    totalMarks: 999,
    ...overrides
});

test("calculates total marks from question values during validation", async () => {
    const assessment = createAssessment({
        questions: [
            {
                questionId: "question-1",
                questionText: "First question",
                options: [
                    { optionId: "yes", text: "Yes" },
                    { optionId: "no", text: "No" }
                ],
                correctOptionId: "yes",
                marks: 2.5
            },
            {
                questionId: "question-2",
                questionText: "Second question",
                options: [
                    { optionId: "a", text: "A" },
                    { optionId: "b", text: "B" }
                ],
                correctOptionId: "b",
                marks: 1.5
            }
        ]
    });

    await assessment.validate();

    assert.equal(assessment.totalMarks, 4);
});

test("rejects duplicate question IDs and answer keys that do not identify an option", async () => {
    const duplicateQuestion = createAssessment({
        questions: [
            {
                questionId: "duplicate",
                questionText: "First",
                options: [
                    { optionId: "a", text: "A" },
                    { optionId: "b", text: "B" }
                ],
                correctOptionId: "a"
            },
            {
                questionId: "duplicate",
                questionText: "Second",
                options: [
                    { optionId: "c", text: "C" },
                    { optionId: "d", text: "D" }
                ],
                correctOptionId: "c"
            }
        ]
    });

    await assert.rejects(duplicateQuestion.validate(), (error) => {
        assert.ok(error.errors.questions);
        return true;
    });

    const incorrectAnswerKey = createAssessment({
        questions: [{
            questionId: "question-1",
            questionText: "Pick the correct option.",
            options: [
                { optionId: "option-1", text: "First" },
                { optionId: "option-2", text: "Second" }
            ],
            correctOptionId: "missing"
        }]
    });

    await assert.rejects(incorrectAnswerKey.validate(), (error) => {
        assert.ok(error.errors["questions.0.correctOptionId"]);
        return true;
    });
});

test("keeps the correct option excluded from default projections", () => {
    assert.equal(
        Assessment.schema.path("questions").schema
            .path("correctOptionId").options.select,
        false
    );
});
