import test from "node:test";
import assert from "node:assert/strict";

import {
    submitCourseFeedbackController,
    getCourseFeedbackController,
    listCourseFeedbackController,
    updateCourseFeedbackStatusController
} from "../../../src/modules/feedback/feedback.controller.js";

import Feedback from "../../../src/modules/feedback/feedback.model.js";
import Course from "../../../src/modules/courses/course.model.js";
import Enrollment from "../../../src/modules/enrollments/enrollment.model.js";
import OrganizationMembership from "../../../src/modules/organizationMemberships/organizationMembership.model.js";


const invoke = (handler, req) => new Promise((resolve) => {
    const res = {
        status(statusCode) {
            this.statusCode = statusCode;
            return this;
        },

        json(body) {
            resolve({ statusCode: this.statusCode, body });
            return this;
        }
    };

    handler(req, res, (error) => resolve({ error }));
});


const createQuery = (result) => ({
    session() { return this; },
    populate() { return this; },
    lean() { return Promise.resolve(result); }
});


test("returns successful responses for feedback submission, retrieval and status updates", async (t) => {
    const orgId = "507f1f77bcf86cd799439011";
    const courseId = "507f1f77bcf86cd799439012";
    const userId = "507f1f77bcf86cd799439013";
    const trainerId = "507f1f77bcf86cd799439014";
    const enrollmentId = "507f1f77bcf86cd799439015";
    const feedbackId = "507f1f77bcf86cd799439016";
    const feedbackRecord = {
        _id: feedbackId,
        trainee: userId,
        trainer: trainerId,
        status: "submitted",
        rating: 5
    };
    let lookupCount = 0;

    t.mock.method(
        OrganizationMembership,
        "findOne",
        () => createQuery({ status: "approved", role: "trainee" })
    );
    t.mock.method(
        Course,
        "findOne",
        () => createQuery({
            _id: courseId,
            trainer: trainerId,
            status: "published"
        })
    );
    t.mock.method(
        Enrollment,
        "findOne",
        () => createQuery({ _id: enrollmentId, status: "completed" })
    );
    t.mock.method(Feedback, "findOne", () => {
        lookupCount += 1;
        return createQuery(lookupCount === 1 ? null : feedbackRecord);
    });
    t.mock.method(Feedback, "create", async () => [feedbackRecord]);
    t.mock.method(
        Feedback,
        "findOneAndUpdate",
        () => createQuery({ ...feedbackRecord, status: "hidden" })
    );

    const req = {
        user: { orgId, userId },
        organizationMembership: { role: "trainee" },
        validated: {
            params: { courseId, feedbackId },
            body: { rating: 5, comment: "Helpful" },
            query: {
                courseId: undefined,
                trainerId: undefined,
                traineeId: undefined,
                status: undefined,
                page: 1,
                limit: 20,
                sortBy: "createdAt",
                sortOrder: "desc"
            }
        }
    };

    const submitted = await invoke(submitCourseFeedbackController, req);
    const retrieved = await invoke(getCourseFeedbackController, req);
    const updated = await invoke(updateCourseFeedbackStatusController, {
        ...req,
        organizationMembership: { role: "admin" },
        validated: {
            ...req.validated,
            body: { status: "hidden" }
        }
    });

    assert.equal(submitted.statusCode, 201);
    assert.equal(submitted.body.data.rating, 5);
    assert.equal(retrieved.statusCode, 200);
    assert.equal(retrieved.body.data._id, feedbackId);
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.body.data.status, "hidden");
});


test("returns feedback data and pagination from the list handler", async (t) => {
    const records = [{ rating: 5 }];
    const query = {
        populate() { return this; },
        sort() { return this; },
        skip() { return this; },
        limit() { return this; },
        lean() { return Promise.resolve(records); }
    };

    t.mock.method(Feedback, "find", () => query);
    t.mock.method(Feedback, "countDocuments", async () => 1);

    const result = await invoke(listCourseFeedbackController, {
        user: {
            orgId: "507f1f77bcf86cd799439011",
            userId: "507f1f77bcf86cd799439012"
        },
        organizationMembership: { role: "admin" },
        validated: {
            query: {
                courseId: undefined,
                trainerId: undefined,
                traineeId: undefined,
                status: undefined,
                page: 1,
                limit: 20,
                sortBy: "createdAt",
                sortOrder: "desc"
            }
        }
    });

    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body.data, records);
    assert.deepEqual(result.body.meta, {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1
    });
});


test("forwards invalid-reference errors from feedback handlers", async () => {
    const request = {
        user: { orgId: "invalid", userId: "invalid" },
        organizationMembership: { role: "admin" },
        validated: {
            params: {
                courseId: "invalid",
                feedbackId: "invalid"
            },
            body: {
                rating: 5,
                status: "hidden"
            },
            query: {
                courseId: undefined,
                trainerId: undefined,
                traineeId: undefined,
                status: undefined,
                page: 1,
                limit: 20,
                sortBy: "createdAt",
                sortOrder: "desc"
            }
        }
    };

    const results = await Promise.all([
        invoke(submitCourseFeedbackController, request),
        invoke(getCourseFeedbackController, request),
        invoke(updateCourseFeedbackStatusController, request)
    ]);

    for (const result of results) {
        assert.ok(result.error);
        assert.equal(result.error.statusCode, 400);
    }
});
