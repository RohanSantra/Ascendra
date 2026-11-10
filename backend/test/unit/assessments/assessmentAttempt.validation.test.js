import test from "node:test";
import assert from "node:assert/strict";

import {
    saveAssessmentAnswersSchema,
    listAssessmentAttemptsQuerySchema,
    submitAssessmentAttemptSchema
} from "../../../src/modules/assessments/assessmentAttempt.validation.js";

const attemptId = "507f1f77bcf86cd799439011";

test("accepts nullable unanswered choices and rejects duplicate answer questions", () => {
    const result = saveAssessmentAnswersSchema.parse({
        params: { attemptId },
        body: {
            answers: [
                { questionId: "question-1", selectedOptionId: null },
                { questionId: "question-2", selectedOptionId: "option-1" }
            ]
        }
    });

    assert.equal(result.body.answers[0].selectedOptionId, null);

    const duplicateAnswers = saveAssessmentAnswersSchema.safeParse({
        params: { attemptId },
        body: {
            answers: [
                { questionId: "question-1", selectedOptionId: "option-1" },
                { questionId: "question-1", selectedOptionId: null }
            ]
        }
    });

    assert.equal(duplicateAnswers.success, false);
});

test("rejects client-supplied scores and malformed answer records", () => {
    const submission = submitAssessmentAttemptSchema.parse({
        params: { attemptId },
        body: { score: 100 }
    });

    assert.deepEqual(submission, {
        params: { attemptId }
    });

    assert.equal(
        saveAssessmentAnswersSchema.safeParse({
            params: { attemptId },
            body: {
                answers: [{
                    questionId: "question-1",
                    selectedOptionId: ""
                }]
            }
        }).success,
        false
    );
});

test("coerces attempt listing parameters and rejects unsupported status", () => {
    const result = listAssessmentAttemptsQuerySchema.parse({
        query: {
            page: "2",
            limit: "10",
            status: "evaluated"
        }
    });

    assert.equal(result.query.page, 2);
    assert.equal(result.query.limit, 10);
    assert.equal(result.query.sortBy, "createdAt");
    assert.equal(result.query.sortOrder, "desc");

    assert.equal(
        listAssessmentAttemptsQuerySchema.safeParse({
            query: { status: "graded" }
        }).success,
        false
    );
});
