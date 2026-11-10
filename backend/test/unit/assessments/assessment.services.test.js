import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
    createAssessment,
    getAssessment
} from "../../../src/modules/assessments/assessment.service.js";

import {
    startAssessmentAttempt,
    saveAssessmentAnswers,
    submitAssessmentAttempt
} from "../../../src/modules/assessments/assessmentAttempt.service.js";

const ids = () => ({
    orgId: new mongoose.Types.ObjectId().toString(),
    assessmentId: new mongoose.Types.ObjectId().toString(),
    userId: new mongoose.Types.ObjectId().toString()
});

test("assessment operations reject unsupported roles before accessing resources", async () => {
    const validIds = ids();

    await assert.rejects(
        createAssessment({
            ...validIds,
            courseId: new mongoose.Types.ObjectId().toString(),
            role: "observer",
            assessmentData: { questions: [] }
        }),
        (error) => {
            assert.equal(error.statusCode, 403);
            assert.equal(error.code, "RESOURCE_ACCESS_DENIED");
            assert.match(error.message, /not authorized/i);
            return true;
        }
    );

    await assert.rejects(
        getAssessment({
            ...validIds,
            role: "observer"
        }),
        (error) => {
            assert.equal(error.statusCode, 403);
            assert.equal(error.code, "RESOURCE_ACCESS_DENIED");
            assert.match(error.message, /not authorized/i);
            return true;
        }
    );

    await assert.rejects(
        createAssessment({
            ...validIds,
            courseId: new mongoose.Types.ObjectId().toString(),
            role: "trainee",
            assessmentData: { questions: [] }
        }),
        (error) => {
            assert.equal(error.statusCode, 403);
            assert.equal(error.code, "RESOURCE_ACCESS_DENIED");
            return true;
        }
    );
});

test("attempt operations reject non-trainee actions before database access", async () => {
    const validIds = ids();
    const attemptId = new mongoose.Types.ObjectId().toString();

    await assert.rejects(
        startAssessmentAttempt({
            ...validIds,
            role: "trainer"
        }),
        (error) => {
            assert.equal(error.statusCode, 403);
            assert.equal(error.code, "RESOURCE_ACCESS_DENIED");
            assert.match(error.message, /only trainees/i);
            return true;
        }
    );

    await assert.rejects(
        saveAssessmentAnswers({
            orgId: validIds.orgId,
            attemptId,
            userId: validIds.userId,
            role: "admin",
            answers: []
        }),
        (error) => {
            assert.equal(error.statusCode, 403);
            assert.equal(error.code, "RESOURCE_ACCESS_DENIED");
            assert.match(error.message, /only trainees/i);
            return true;
        }
    );

    await assert.rejects(
        submitAssessmentAttempt({
            orgId: validIds.orgId,
            attemptId,
            userId: validIds.userId,
            role: "trainer"
        }),
        (error) => {
            assert.equal(error.statusCode, 403);
            assert.equal(error.code, "RESOURCE_ACCESS_DENIED");
            assert.match(error.message, /only trainees/i);
            return true;
        }
    );

    await assert.rejects(
        startAssessmentAttempt({
            ...validIds,
            role: "observer"
        }),
        (error) => {
            assert.equal(error.statusCode, 403);
            assert.equal(error.code, "RESOURCE_ACCESS_DENIED");
            return true;
        }
    );
});

test("attempt operations reject malformed identifiers before database access", async () => {
    await assert.rejects(
        startAssessmentAttempt({
            orgId: "not-an-object-id",
            assessmentId: new mongoose.Types.ObjectId().toString(),
            userId: new mongoose.Types.ObjectId().toString(),
            role: "trainee"
        }),
        { statusCode: 400, code: "VALIDATION_ERROR" }
    );

    await assert.rejects(
        submitAssessmentAttempt({
            orgId: new mongoose.Types.ObjectId().toString(),
            attemptId: "invalid",
            userId: new mongoose.Types.ObjectId().toString(),
            role: "trainee"
        }),
        { statusCode: 400, code: "VALIDATION_ERROR" }
    );
});

test("assessment creation rejects an invalid course ID before course lookup", async () => {
    const validIds = ids();

    await assert.rejects(
        createAssessment({
            ...validIds,
            courseId: "invalid-course-id",
            role: "trainer",
            assessmentData: { questions: [] }
        }),
        {
            statusCode: 400,
            code: "VALIDATION_ERROR"
        }
    );
});
