import test from "node:test";
import assert from "node:assert/strict";

process.env.CLIENT_URL ||= "http://localhost:3000";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/ascendra_test";
process.env.JWT_ACCESS_SECRET ||= "test-access-secret-for-enrollment-controller-behavior";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-for-enrollment-controller-behavior";

const { default: Course } = await import(
    "../../../../src/modules/courses/course.model.js"
);
const { default: Enrollment } = await import(
    "../../../../src/modules/enrollments/enrollment.model.js"
);
const { default: OrganizationMembership } = await import(
    "../../../../src/modules/organizationMemberships/organizationMembership.model.js"
);
const {
    createEnrollmentHandler,
    getEnrollmentHandler,
    updateEnrollmentStatusHandler
} = await import("../../../../src/modules/enrollments/enrollment.controller.js");

const orgId = "507f1f77bcf86cd799439011";
const courseId = "507f1f77bcf86cd799439012";
const traineeId = "507f1f77bcf86cd799439013";
const enrollmentId = "507f1f77bcf86cd799439014";

const query = (result) => ({
    session() { return this; },
    populate() { return this; },
    lean: async () => result
});

const invoke = (handler, req) => new Promise((resolve, reject) => {
    const res = {
        req: {},
        status(statusCode) {
            this.statusCode = statusCode;
            return this;
        },
        json(body) {
            resolve({ statusCode: this.statusCode, body });
            return this;
        }
    };
    handler(req, res, reject);
});

const traineeRequest = {
    user: { orgId, userId: traineeId },
    organizationMembership: { role: "trainee" }
};

const enrollmentRecord = (overrides = {}) => ({
    _id: enrollmentId,
    org: orgId,
    course: courseId,
    trainee: traineeId,
    status: "enrolled",
    ...overrides
});


test("creates a trainee's self-enrollment and returns HTTP 201", async (t) => {
    t.mock.method(OrganizationMembership, "findOne", () => ({
        lean: async () => ({ status: "approved" })
    }));
    t.mock.method(Course, "findOne", () => query({
        _id: courseId,
        status: "published"
    }));
    t.mock.method(Enrollment, "findOne", () => query(null));
    t.mock.method(Enrollment, "create", async ([data]) => [data]);

    const response = await invoke(createEnrollmentHandler, {
        ...traineeRequest,
        validated: {
            params: { courseId },
            body: {}
        }
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.data.trainee, traineeId);
    assert.equal(response.body.data.status, "enrolled");
});


test("retrieves a trainee's own enrollment with the standard response", async (t) => {
    t.mock.method(OrganizationMembership, "findOne", () => ({
        lean: async () => ({ status: "approved" })
    }));
    t.mock.method(Enrollment, "findOne", () => query(enrollmentRecord()));

    const response = await invoke(getEnrollmentHandler, {
        ...traineeRequest,
        validated: { params: { enrollmentId } }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data._id, enrollmentId);
});


test("updates a trainee enrollment and returns the new lifecycle state", async (t) => {
    t.mock.method(OrganizationMembership, "findOne", () => ({
        lean: async () => ({ status: "approved" })
    }));
    t.mock.method(Enrollment, "findOne", () => query(enrollmentRecord()));
    t.mock.method(Course, "findOne", () => query({
        _id: courseId,
        trainer: "507f1f77bcf86cd799439099",
        status: "published"
    }));
    t.mock.method(Enrollment, "findOneAndUpdate", (_filter, update) => query(
        enrollmentRecord({
            status: update.$set.status,
            startedAt: update.$set.startedAt
        })
    ));

    const response = await invoke(updateEnrollmentStatusHandler, {
        ...traineeRequest,
        validated: {
            params: { enrollmentId },
            body: { status: "in_progress" }
        }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data.status, "in_progress");
    assert.ok(response.body.data.startedAt instanceof Date);
});


test("forwards missing authenticated organization context to error middleware", async () => {
    const error = await new Promise((resolve) => {
        createEnrollmentHandler({
            validated: {
                params: { courseId },
                body: {}
            }
        }, {}, resolve);
    });

    assert.match(error.message, /context is missing/);
});
