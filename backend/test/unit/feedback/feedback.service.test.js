import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
    getCourseFeedback,
    listCourseFeedback,
    submitCourseFeedback,
    updateCourseFeedbackStatus
} from "../../../src/modules/feedback/feedback.service.js";

import Feedback from "../../../src/modules/feedback/feedback.model.js";
import Course from "../../../src/modules/courses/course.model.js";
import Enrollment from "../../../src/modules/enrollments/enrollment.model.js";
import OrganizationMembership from "../../../src/modules/organizationMemberships/organizationMembership.model.js";

import {
    createFeedbackSchema,
    listFeedbackQuerySchema
} from "../../../src/modules/feedback/feedback.validation.js";

import {
    ERROR_CODES,
    HTTP_STATUS
} from "../../../src/core/constants/index.js";


const createQuery = (result) => ({
    session() {
        return this;
    },

    populate() {
        return this;
    },

    lean() {
        return Promise.resolve(result);
    }
});


test("submits feedback for an enrolled trainee and stores course references", async (t) => {
    const orgId = new mongoose.Types.ObjectId();
    const courseId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const trainerId = new mongoose.Types.ObjectId();
    const enrollmentId = new mongoose.Types.ObjectId();
    const feedback = { rating: 5 };
    let capturedCreate;

    t.mock.method(
        OrganizationMembership,
        "findOne",
        () => createQuery({ role: "trainee", status: "approved" })
    );
    t.mock.method(
        Course,
        "findOne",
        () => createQuery({
            _id: courseId,
            status: "published",
            trainer: trainerId
        })
    );
    t.mock.method(
        Enrollment,
        "findOne",
        (filter) => createQuery(
            filter.status === "completed"
                ? { _id: enrollmentId }
                : { _id: enrollmentId, status: "enrolled" }
        )
    );
    t.mock.method(Feedback, "findOne", () => createQuery(null));
    t.mock.method(Feedback, "create", async (documents) => {
        capturedCreate = documents[0];
        return [feedback];
    });

    assert.equal(
        await submitCourseFeedback({
            orgId,
            courseId,
            userId,
            rating: 5,
            comment: "Good course"
        }),
        feedback
    );
    assert.deepEqual(capturedCreate, {
        org: orgId,
        course: courseId,
        enrollment: enrollmentId,
        trainee: userId,
        trainer: trainerId,
        category: "course",
        rating: 5,
        comment: "Good course"
    });
});


test("maps duplicate feedback insert conflicts to a controlled error", async (t) => {
    const orgId = new mongoose.Types.ObjectId();
    const courseId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const enrollmentId = new mongoose.Types.ObjectId();

    t.mock.method(
        OrganizationMembership,
        "findOne",
        () => createQuery({})
    );
    t.mock.method(
        Course,
        "findOne",
        () => createQuery({
            _id: courseId,
            status: "published",
            trainer: new mongoose.Types.ObjectId()
        })
    );
    t.mock.method(
        Enrollment,
        "findOne",
        () => createQuery({ _id: enrollmentId })
    );
    t.mock.method(Feedback, "findOne", () => createQuery(null));
    t.mock.method(Feedback, "create", async () => {
        const error = new Error("Duplicate key");
        error.code = 11000;
        throw error;
    });

    await assert.rejects(
        () => submitCourseFeedback({
            orgId,
            courseId,
            userId,
            rating: 4
        }),
        {
            code: ERROR_CODES.RESOURCE_CONFLICT,
            statusCode: HTTP_STATUS.CONFLICT
        }
    );
});


test("updates feedback visibility with audit fields", async (t) => {
    const orgId = new mongoose.Types.ObjectId();
    const feedbackId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    let capturedUpdate;

    t.mock.method(
        Feedback,
        "findOne",
        () => createQuery({ _id: feedbackId })
    );
    t.mock.method(
        Feedback,
        "findOneAndUpdate",
        (filter, update) => {
            capturedUpdate = { filter, update };
            return createQuery({ status: "hidden" });
        }
    );

    assert.deepEqual(
        await updateCourseFeedbackStatus({
            orgId,
            feedbackId,
            userId,
            status: "hidden"
        }),
        { status: "hidden" }
    );
    assert.deepEqual(capturedUpdate.filter, {
        _id: feedbackId,
        org: orgId
    });
    assert.equal(capturedUpdate.update.$set.status, "hidden");
    assert.equal(capturedUpdate.update.$set.statusUpdatedBy, userId);
    assert.ok(capturedUpdate.update.$set.statusUpdatedAt instanceof Date);
});


test("limits trainer feedback listings to submitted records owned by that trainer", async (t) => {
    const orgId = new mongoose.Types.ObjectId();
    const trainerId = new mongoose.Types.ObjectId();
    let capturedFilter;

    const query = {
        populate() {
            return this;
        },

        sort() {
            return this;
        },

        skip() {
            return this;
        },

        limit() {
            return this;
        },

        lean() {
            return Promise.resolve([]);
        }
    };

    t.mock.method(Feedback, "find", (filter) => {
        capturedFilter = filter;
        return query;
    });
    t.mock.method(Feedback, "countDocuments", async () => 0);

    await listCourseFeedback({
        orgId,
        userId: trainerId,
        role: "trainer",
        filters: {
            trainerId: new mongoose.Types.ObjectId().toString(),
            status: "hidden"
        },
        pagination: { page: 1, limit: 10 }
    });

    assert.deepEqual(capturedFilter, {
        org: orgId,
        trainer: trainerId,
        status: "submitted"
    });
});


test("prevents trainees from reading another trainee's feedback", async (t) => {
    const feedback = {
        trainee: new mongoose.Types.ObjectId(),
        trainer: new mongoose.Types.ObjectId()
    };

    t.mock.method(
        Feedback,
        "findOne",
        () => createQuery(feedback)
    );

    await assert.rejects(
        () => getCourseFeedback({
            orgId: new mongoose.Types.ObjectId(),
            feedbackId: new mongoose.Types.ObjectId(),
            userId: new mongoose.Types.ObjectId(),
            role: "trainee"
        }),
        (error) => {
            assert.equal(error.statusCode, HTTP_STATUS.FORBIDDEN);
            assert.equal(error.code, ERROR_CODES.RESOURCE_ACCESS_DENIED);
            return true;
        }
    );
});


test("validates feedback rating bounds and listing defaults", () => {
    assert.equal(
        createFeedbackSchema.safeParse({
            params: { courseId: "507f1f77bcf86cd799439011" },
            body: { rating: 5, comment: "  Helpful course  " }
        }).data.body.comment,
        "Helpful course"
    );

    assert.equal(
        createFeedbackSchema.safeParse({
            params: { courseId: "507f1f77bcf86cd799439011" },
            body: { rating: 6 }
        }).success,
        false
    );

    assert.deepEqual(
        listFeedbackQuerySchema.parse({ query: {} }).query,
        {
            page: 1,
            limit: 20,
            sortBy: "createdAt",
            sortOrder: "desc"
        }
    );
});
