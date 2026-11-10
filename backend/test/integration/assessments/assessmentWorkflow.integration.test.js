import test, {
    before,
    after,
    beforeEach
} from "node:test";

import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
    startTestDatabase,
    clearTestDatabase,
    stopTestDatabase
} from "../../helpers/database.js";

import User from "../../../src/modules/auth/user.model.js";
import Organization from "../../../src/modules/organizations/organization.model.js";
import OrganizationMembership from "../../../src/modules/organizationMemberships/organizationMembership.model.js";
import Enrollment from "../../../src/modules/enrollments/enrollment.model.js";
import Course from "../../../src/modules/courses/course.model.js";
import Assessment from "../../../src/modules/assessments/assessment.model.js";
import AssessmentAttempt from "../../../src/modules/assessments/assessmentAttempt.model.js";
import {
    expireAssessmentAttempts
} from "../../../src/modules/assessments/assessmentAttempt.repository.js";

import {
    createAssessmentHandler,
    publishAssessmentHandler,
    createAssessmentVersionHandler,
    updateAssessmentHandler,
    archiveAssessmentHandler,
    getAssessmentHandler
} from "../../../src/modules/assessments/assessment.controller.js";

import {
    listAssessmentsHandler
} from "../../../src/modules/assessments/assessment.controller.js";

import {
    startAssessmentAttemptHandler,
    saveAssessmentAnswersHandler,
    submitAssessmentAttemptHandler,
    getAssessmentAttemptHandler,
    listAssessmentAttemptsHandler
} from "../../../src/modules/assessments/assessmentAttempt.controller.js";

let organization;
let trainer;
let trainee;
let admin;
let course;

const invokeHandler = (handler, req) => new Promise((resolve, reject) => {
    const res = {
        req: {},
        statusCode: null,
        status(statusCode) {
            this.statusCode = statusCode;
            return this;
        },
        json(body) {
            resolve({
                statusCode: this.statusCode,
                body
            });
            return this;
        }
    };

    handler(req, res, reject);
});

const createRequest = ({
    user,
    role,
    params = {},
    query = {},
    body = {}
}) => ({
    user: {
        orgId: organization._id.toString(),
        userId: user._id.toString()
    },
    organizationMembership: { role },
    validated: {
        params,
        query,
        body
    }
});

before(async () => {
    await startTestDatabase();
});

after(async () => {
    await stopTestDatabase();
});

beforeEach(async () => {
    await clearTestDatabase();

    trainer = await User.create({
        firstName: "Test",
        lastName: "Trainer",
        email: "trainer-assessment@example.com"
    });

    admin = await User.create({
        firstName: "Test",
        lastName: "Admin",
        email: "admin-assessment@example.com"
    });

    trainee = await User.create({
        firstName: "Test",
        lastName: "Trainee",
        email: "trainee-assessment@example.com"
    });

    organization = await Organization.create({
        name: "Assessment Test Organization",
        slug: "assessment-test-organization",
        status: "active",
        createdBy: trainer._id
    });

    await OrganizationMembership.create([
        {
            org: organization._id,
            user: trainer._id,
            role: "trainer",
            status: "approved"
        },
        {
            org: organization._id,
            user: trainee._id,
            role: "trainee",
            status: "approved"
        },
        {
            org: organization._id,
            user: admin._id,
            role: "admin",
            status: "approved"
        }
    ]);

    course = await Course.create({
        org: organization._id,
        title: "Assessment workflow course",
        trainer: trainer._id,
        trainerProfile: new mongoose.Types.ObjectId(),
        trainerAssignment: new mongoose.Types.ObjectId(),
        requirement: new mongoose.Types.ObjectId(),
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2027-01-01T00:00:00.000Z"),
        status: "published",
        createdBy: trainer._id
    });

    await Enrollment.create({
        org: organization._id,
        course: course._id,
        trainee: trainee._id,
        status: "enrolled"
    });
});

test("assessment controllers support publishing, trainee evaluation, and versioning", async () => {
    const question = {
        questionId: "question-1",
        questionText: "Which option is correct?",
        options: [
            { optionId: "wrong", text: "Incorrect" },
            { optionId: "right", text: "Correct" }
        ],
        correctOptionId: "right",
        marks: 5
    };

    const createdResponse = await invokeHandler(
        createAssessmentHandler,
        createRequest({
            user: trainer,
            role: "trainer",
            params: { courseId: course._id.toString() },
            body: {
                title: "Workflow assessment",
                questions: [question],
                durationMinutes: 30,
                passingPercentage: 80,
                maxAttempts: 2
            }
        })
    );

    assert.equal(createdResponse.statusCode, 201);
    const assessmentId = createdResponse.body.data._id.toString();
    const assessmentKey = createdResponse.body.data.assessmentKey.toString();

    const publishResponse = await invokeHandler(
        publishAssessmentHandler,
        createRequest({
            user: trainer,
            role: "trainer",
            params: { assessmentId }
        })
    );

    assert.equal(publishResponse.statusCode, 200);
    assert.equal(publishResponse.body.data.status, "published");

    const listResponse = await invokeHandler(
        listAssessmentsHandler,
        createRequest({
            user: trainee,
            role: "trainee",
            params: { courseId: course._id.toString() },
            query: {
                page: 1,
                limit: 20,
                sortBy: "createdAt",
                sortOrder: "desc"
            }
        })
    );

    assert.equal(listResponse.statusCode, 200);
    assert.equal(listResponse.body.data.length, 1);
    assert.equal(
        listResponse.body.data[0].questions[0].correctOptionId,
        undefined
    );

    const startResponse = await invokeHandler(
        startAssessmentAttemptHandler,
        createRequest({
            user: trainee,
            role: "trainee",
            params: { assessmentId }
        })
    );

    assert.equal(startResponse.statusCode, 201);
    const attemptId = startResponse.body.data._id.toString();
    assert.equal(
        startResponse.body.data.assessmentSnapshot.questions[0].correctOptionId,
        undefined
    );

    await assert.rejects(
        invokeHandler(
            saveAssessmentAnswersHandler,
            createRequest({
                user: trainee,
                role: "trainee",
                params: { attemptId },
                body: {
                    answers: [{
                        questionId: "question-1",
                        selectedOptionId: "unknown-option"
                    }]
                }
            })
        ),
        (error) => {
            assert.equal(error.statusCode, 400);
            assert.equal(error.code, "VALIDATION_ERROR");
            return true;
        }
    );

    const saveResponse = await invokeHandler(
        saveAssessmentAnswersHandler,
        createRequest({
            user: trainee,
            role: "trainee",
            params: { attemptId },
            body: {
                answers: [{
                    questionId: "question-1",
                    selectedOptionId: "right"
                }]
            }
        })
    );

    assert.equal(saveResponse.statusCode, 200);
    assert.deepEqual(saveResponse.body.data.answers, [{
        questionId: "question-1",
        selectedOptionId: "right"
    }]);

    const submitResponse = await invokeHandler(
        submitAssessmentAttemptHandler,
        createRequest({
            user: trainee,
            role: "trainee",
            params: { attemptId }
        })
    );

    assert.equal(submitResponse.statusCode, 200);
    assert.equal(submitResponse.body.data.status, "evaluated");
    assert.equal(submitResponse.body.data.score, 5);
    assert.equal(submitResponse.body.data.percentage, 100);
    assert.equal(
        submitResponse.body.data.assessmentSnapshot.questions[0].correctOptionId,
        undefined
    );

    const traineeHistory = await invokeHandler(
        listAssessmentAttemptsHandler,
        createRequest({
            user: trainee,
            role: "trainee",
            query: {
                assessmentId,
                status: "evaluated",
                page: 1,
                limit: 10,
                sortBy: "score",
                sortOrder: "desc"
            }
        })
    );

    assert.equal(traineeHistory.statusCode, 200);
    assert.equal(traineeHistory.body.data.length, 1);
    assert.equal(traineeHistory.body.meta.total, 1);
    assert.equal(
        traineeHistory.body.data[0].assessmentSnapshot,
        undefined
    );

    const trainerHistory = await invokeHandler(
        listAssessmentAttemptsHandler,
        createRequest({
            user: trainer,
            role: "trainer",
            query: {
                assessmentId,
                page: 1,
                limit: 10,
                sortBy: "attemptNumber",
                sortOrder: "asc"
            }
        })
    );
    assert.equal(trainerHistory.body.data.length, 1);

    const organizationHistory = await invokeHandler(
        listAssessmentAttemptsHandler,
        createRequest({
            user: admin,
            role: "admin",
            query: {
                page: 1,
                limit: 10,
                sortBy: "createdAt",
                sortOrder: "desc"
            }
        })
    );
    assert.equal(organizationHistory.body.data.length, 1);

    const secondAttemptResponse = await invokeHandler(
        startAssessmentAttemptHandler,
        createRequest({
            user: trainee,
            role: "trainee",
            params: { assessmentId }
        })
    );
    assert.equal(secondAttemptResponse.statusCode, 201);

    const secondAttemptId = secondAttemptResponse.body.data._id.toString();
    const secondSubmit = await invokeHandler(
        submitAssessmentAttemptHandler,
        createRequest({
            user: trainee,
            role: "trainee",
            params: { attemptId: secondAttemptId }
        })
    );
    assert.equal(secondSubmit.body.data.score, 0);

    await assert.rejects(
        invokeHandler(
            startAssessmentAttemptHandler,
            createRequest({
                user: trainee,
                role: "trainee",
                params: { assessmentId }
            })
        ),
        (error) => {
            assert.equal(error.statusCode, 409);
            assert.equal(error.code, "RESOURCE_CONFLICT");
            assert.match(error.message, /maximum number of attempts/i);
            return true;
        }
    );

    const versionResponse = await invokeHandler(
        createAssessmentVersionHandler,
        createRequest({
            user: trainer,
            role: "trainer",
            params: { assessmentId }
        })
    );

    assert.equal(versionResponse.statusCode, 201);
    const secondVersionId = versionResponse.body.data._id.toString();
    assert.equal(versionResponse.body.data.version, 2);
    assert.equal(versionResponse.body.data.assessmentKey.toString(), assessmentKey);

    const publishSecondVersion = await invokeHandler(
        publishAssessmentHandler,
        createRequest({
            user: trainer,
            role: "trainer",
            params: { assessmentId: secondVersionId }
        })
    );

    assert.equal(publishSecondVersion.body.data.status, "published");

    const firstVersion = await Assessment.findById(assessmentId).lean();
    assert.equal(firstVersion.status, "archived");

    const archiveResponse = await invokeHandler(
        archiveAssessmentHandler,
        createRequest({
            user: trainer,
            role: "trainer",
            params: { assessmentId: secondVersionId }
        })
    );
    assert.equal(archiveResponse.statusCode, 200);
    assert.equal(archiveResponse.body.data.status, "archived");

    const storedAttempt = await AssessmentAttempt.findById(attemptId)
        .select("+assessmentSnapshot +assessmentSnapshot.questions.correctOptionId")
        .lean();

    assert.equal(storedAttempt.assessmentVersion, 1);
    assert.equal(storedAttempt.assessmentSnapshot.questions[0].correctOptionId, "right");

    const getAttemptResponse = await invokeHandler(
        getAssessmentAttemptHandler,
        createRequest({
            user: trainee,
            role: "trainee",
            params: { attemptId }
        })
    );

    assert.equal(getAttemptResponse.statusCode, 200);
    assert.equal(
        getAttemptResponse.body.data.assessmentSnapshot.questions[0].correctOptionId,
        undefined
    );

    await assert.rejects(
        invokeHandler(
            getAssessmentHandler,
            createRequest({
                user: trainee,
                role: "trainee",
                params: { assessmentId: secondVersionId }
            })
        ),
        (error) => {
            assert.equal(error.statusCode, 404);
            assert.equal(error.code, "RESOURCE_NOT_FOUND");
            return true;
        }
    );
});

test("assessment editing recalculates marks before publication and archive lifecycle", async () => {
    const created = await invokeHandler(
        createAssessmentHandler,
        createRequest({
            user: trainer,
            role: "trainer",
            params: { courseId: course._id.toString() },
            body: {
                title: "Draft assessment",
                questions: [{
                    questionId: "question-1",
                    questionText: "Select an answer.",
                    options: [
                        { optionId: "a", text: "A" },
                        { optionId: "b", text: "B" }
                    ],
                    correctOptionId: "a",
                    marks: 2
                }],
                durationMinutes: 20
            }
        })
    );

    const assessmentId = created.body.data._id.toString();
    const updateResponse = await invokeHandler(
        updateAssessmentHandler,
        createRequest({
            user: trainer,
            role: "trainer",
            params: { assessmentId },
            body: {
                title: "Updated draft",
                questions: [{
                    questionId: "question-1",
                    questionText: "Select an answer.",
                    options: [
                        { optionId: "a", text: "A" },
                        { optionId: "b", text: "B" }
                    ],
                    correctOptionId: "a",
                    marks: 7
                }]
            }
        })
    );

    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateResponse.body.data.title, "Updated draft");
    assert.equal(updateResponse.body.data.totalMarks, 7);
    assert.equal(updateResponse.body.data.__v, 1);

    const publishResponse = await invokeHandler(
        publishAssessmentHandler,
        createRequest({
            user: trainer,
            role: "trainer",
            params: { assessmentId }
        })
    );

    assert.equal(publishResponse.body.data.status, "published");

    const archiveResponse = await invokeHandler(
        archiveAssessmentHandler,
        createRequest({
            user: trainer,
            role: "trainer",
            params: { assessmentId }
        })
    );

    assert.equal(archiveResponse.body.data.status, "archived");
});

test("assessment access, lifecycle and expired-attempt branches return expected outcomes", async () => {
    await Course.updateOne(
        { _id: course._id },
        { $set: { status: "cancelled" } }
    );

    await assert.rejects(
        invokeHandler(
            createAssessmentHandler,
            createRequest({
                user: trainer,
                role: "trainer",
                params: { courseId: course._id.toString() },
                body: {
                    title: "Not available",
                    questions: [{
                        questionId: "question-1",
                        questionText: "Choose an option.",
                        options: [
                            { optionId: "a", text: "A" },
                            { optionId: "b", text: "B" }
                        ],
                        correctOptionId: "a"
                    }],
                    durationMinutes: 20
                }
            })
        ),
        (error) => {
            assert.equal(error.statusCode, 409);
            assert.equal(error.code, "RESOURCE_CONFLICT");
            return true;
        }
    );

    await Course.updateOne(
        { _id: course._id },
        { $set: { status: "published" } }
    );

    const assessmentPayload = {
        title: "Branch coverage assessment",
        questions: [{
            questionId: "question-1",
            questionText: "Choose an option.",
            options: [
                { optionId: "a", text: "A" },
                { optionId: "b", text: "B" }
            ],
            correctOptionId: "a"
        }],
        durationMinutes: 20,
        maxAttempts: 3
    };

    const draftResponse = await invokeHandler(
        createAssessmentHandler,
        createRequest({
            user: trainer,
            role: "trainer",
            params: { courseId: course._id.toString() },
            body: assessmentPayload
        })
    );
    const draftId = draftResponse.body.data._id.toString();

    await assert.rejects(
        invokeHandler(
            getAssessmentHandler,
            createRequest({
                user: trainee,
                role: "trainee",
                params: { assessmentId: draftId }
            })
        ),
        (error) => {
            assert.equal(error.statusCode, 404);
            assert.equal(error.code, "RESOURCE_NOT_FOUND");
            return true;
        }
    );

    await assert.rejects(
        invokeHandler(
            getAssessmentHandler,
            createRequest({
                user: trainer,
                role: "trainer",
                params: { assessmentId: new mongoose.Types.ObjectId().toString() }
            })
        ),
        (error) => {
            assert.equal(error.statusCode, 404);
            assert.equal(error.code, "RESOURCE_NOT_FOUND");
            return true;
        }
    );

    await assert.rejects(
        invokeHandler(
            createAssessmentVersionHandler,
            createRequest({
                user: trainer,
                role: "trainer",
                params: { assessmentId: draftId }
            })
        ),
        (error) => {
            assert.equal(error.statusCode, 409);
            assert.equal(error.code, "RESOURCE_CONFLICT");
            return true;
        }
    );

    await assert.rejects(
        invokeHandler(
            archiveAssessmentHandler,
            createRequest({
                user: trainer,
                role: "trainer",
                params: { assessmentId: draftId }
            })
        ),
        (error) => {
            assert.equal(error.statusCode, 409);
            assert.equal(error.code, "RESOURCE_CONFLICT");
            return true;
        }
    );

    await assert.rejects(
        invokeHandler(
            listAssessmentAttemptsHandler,
            createRequest({
                user: trainer,
                role: "trainer",
                query: {
                    page: 1,
                    limit: 10,
                    sortBy: "createdAt",
                    sortOrder: "desc"
                }
            })
        ),
        (error) => {
            assert.equal(error.statusCode, 400);
            assert.equal(error.code, "VALIDATION_ERROR");
            return true;
        }
    );

    const emptyDraft = await invokeHandler(
        createAssessmentHandler,
        createRequest({
            user: trainer,
            role: "trainer",
            params: { courseId: course._id.toString() },
            body: {
                ...assessmentPayload,
                title: "Empty assessment",
                questions: []
            }
        })
    );

    await assert.rejects(
        invokeHandler(
            publishAssessmentHandler,
            createRequest({
                user: trainer,
                role: "trainer",
                params: { assessmentId: emptyDraft.body.data._id.toString() }
            })
        ),
        (error) => {
            assert.equal(error.statusCode, 400);
            assert.equal(error.code, "VALIDATION_ERROR");
            return true;
        }
    );

    const publishResponse = await invokeHandler(
        publishAssessmentHandler,
        createRequest({
            user: trainer,
            role: "trainer",
            params: { assessmentId: draftId }
        })
    );
    assert.equal(publishResponse.body.data.status, "published");

    const started = await invokeHandler(
        startAssessmentAttemptHandler,
        createRequest({
            user: trainee,
            role: "trainee",
            params: { assessmentId: draftId }
        })
    );
    const firstAttemptId = started.body.data._id.toString();

    const resumed = await invokeHandler(
        startAssessmentAttemptHandler,
        createRequest({
            user: trainee,
            role: "trainee",
            params: { assessmentId: draftId }
        })
    );
    assert.equal(resumed.body.data._id.toString(), firstAttemptId);

    await AssessmentAttempt.updateOne(
        { _id: firstAttemptId },
        { $set: { expiresAt: new Date(Date.now() - 60_000) } }
    );

    const afterExpiry = await invokeHandler(
        startAssessmentAttemptHandler,
        createRequest({
            user: trainee,
            role: "trainee",
            params: { assessmentId: draftId }
        })
    );
    assert.notEqual(afterExpiry.body.data._id.toString(), firstAttemptId);

    const expiredOnReadId = afterExpiry.body.data._id.toString();
    await AssessmentAttempt.updateOne(
        { _id: expiredOnReadId },
        { $set: { expiresAt: new Date(Date.now() - 60_000) } }
    );

    const expiredOnRead = await invokeHandler(
        getAssessmentAttemptHandler,
        createRequest({
            user: trainee,
            role: "trainee",
            params: { attemptId: expiredOnReadId }
        })
    );
    assert.equal(expiredOnRead.body.data.status, "expired");

    const newAttempt = await invokeHandler(
        startAssessmentAttemptHandler,
        createRequest({
            user: trainee,
            role: "trainee",
            params: { assessmentId: draftId }
        })
    );
    const repositoryExpiryId = newAttempt.body.data._id.toString();

    await AssessmentAttempt.updateOne(
        { _id: repositoryExpiryId },
        { $set: { expiresAt: new Date(Date.now() - 60_000) } }
    );

    const expiryResult = await expireAssessmentAttempts({
        orgId: organization._id,
        now: new Date()
    });
    assert.equal(expiryResult.modifiedCount, 1);
    assert.equal(
        (await AssessmentAttempt.findById(repositoryExpiryId).lean()).status,
        "expired"
    );
});
