import test from "node:test";
import assert from "node:assert/strict";

process.env.CLIENT_URL ||= "http://localhost:3000";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/ascendra_test";
process.env.JWT_ACCESS_SECRET ||= "test-access-secret-for-course-controller";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-for-course-controller";

const { getCourseHandler } = await import(
    "../../../../src/modules/courses/course.controller.js"
);
const { default: Course } = await import(
    "../../../../src/modules/courses/course.model.js"
);


test("returns a retrieved course in the standard API response", async (t) => {
    const course = { _id: "course-1", title: "Safety Training" };
    const query = {
        session() { return this; },
        populate() { return this; },
        lean() { return Promise.resolve(course); }
    };
    let capturedFilter;
    t.mock.method(Course, "findOne", (filter) => {
        capturedFilter = filter;
        return query;
    });

    const response = await new Promise((resolve, reject) => {
        const res = {
            req: { requestId: "request-course-1" },
            status(statusCode) {
                this.statusCode = statusCode;
                return this;
            },
            json(body) {
                resolve({ statusCode: this.statusCode, body });
                return this;
            }
        };
        getCourseHandler({
            user: {
                orgId: "507f1f77bcf86cd799439011",
                userId: "507f1f77bcf86cd799439012"
            },
            organizationMembership: { role: "admin" },
            validated: { params: { id: "507f1f77bcf86cd799439013" } }
        }, res, reject);
    });

    assert.deepEqual(capturedFilter, {
        _id: "507f1f77bcf86cd799439013",
        org: "507f1f77bcf86cd799439011"
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data, course);
    assert.equal(response.body.requestId, "request-course-1");
    assert.equal(response.body.message, "Course retrieved successfully.");
});
