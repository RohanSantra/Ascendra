import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
    getAssessmentById
} from "../../../src/modules/assessments/assessment.repository.js";

import {
    getAssessmentAttemptById
} from "../../../src/modules/assessments/assessmentAttempt.repository.js";

import Assessment from "../../../src/modules/assessments/assessment.model.js";
import AssessmentAttempt from "../../../src/modules/assessments/assessmentAttempt.model.js";

const createQuery = (result) => ({
    selectedFields: null,
    sessionValue: null,
    select(fields) {
        this.selectedFields = fields;
        return this;
    },
    session(value) {
        this.sessionValue = value;
        return this;
    },
    lean() {
        return Promise.resolve(result);
    }
});

test("assessment lookup is organisation-scoped and includes answer keys only on request", async (t) => {
    const orgId = new mongoose.Types.ObjectId();
    const assessmentId = new mongoose.Types.ObjectId();
    const session = {};
    const assessment = { _id: assessmentId };
    let capturedFilter;
    let capturedQuery;

    t.mock.method(Assessment, "findOne", (filter) => {
        capturedFilter = filter;
        capturedQuery = createQuery(assessment);
        return capturedQuery;
    });

    const result = await getAssessmentById(
        { orgId, assessmentId },
        { includeCorrectAnswers: true, session }
    );

    assert.deepEqual(capturedFilter, {
        _id: assessmentId,
        org: orgId
    });
    assert.equal(
        capturedQuery.selectedFields,
        "+questions.correctOptionId"
    );
    assert.equal(capturedQuery.sessionValue, session);
    assert.equal(result, assessment);
});

test("assessment lookup leaves answer keys excluded by default", async (t) => {
    let capturedQuery;

    t.mock.method(Assessment, "findOne", () => {
        capturedQuery = createQuery(null);
        return capturedQuery;
    });

    const result = await getAssessmentById({
        orgId: new mongoose.Types.ObjectId(),
        assessmentId: new mongoose.Types.ObjectId()
    });

    assert.equal(capturedQuery.selectedFields, null);
    assert.equal(result, null);
});

test("attempt lookup explicitly selects the immutable grading snapshot when requested", async (t) => {
    const orgId = new mongoose.Types.ObjectId();
    const attemptId = new mongoose.Types.ObjectId();
    const session = {};
    const attempt = { _id: attemptId };
    let capturedFilter;
    let capturedQuery;

    t.mock.method(AssessmentAttempt, "findOne", (filter) => {
        capturedFilter = filter;
        capturedQuery = createQuery(attempt);
        return capturedQuery;
    });

    const result = await getAssessmentAttemptById(
        { orgId, attemptId },
        { includeSnapshot: true, session }
    );

    assert.deepEqual(capturedFilter, {
        _id: attemptId,
        org: orgId
    });
    assert.equal(
        capturedQuery.selectedFields,
        "+assessmentSnapshot +assessmentSnapshot.questions.correctOptionId"
    );
    assert.equal(capturedQuery.sessionValue, session);
    assert.equal(result, attempt);
});

test("attempt lookup does not select the snapshot by default", async (t) => {
    let capturedQuery;

    t.mock.method(AssessmentAttempt, "findOne", () => {
        capturedQuery = createQuery(null);
        return capturedQuery;
    });

    const result = await getAssessmentAttemptById({
        orgId: new mongoose.Types.ObjectId(),
        attemptId: new mongoose.Types.ObjectId()
    });

    assert.equal(capturedQuery.selectedFields, null);
    assert.equal(result, null);
});
