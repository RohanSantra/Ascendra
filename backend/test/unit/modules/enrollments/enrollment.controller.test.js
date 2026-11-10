import test from "node:test";
import assert from "node:assert/strict";

process.env.CLIENT_URL ||= "http://localhost:3000";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/ascendra_test";
process.env.JWT_ACCESS_SECRET ||= "test-access-secret-for-enrollment-controller";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-for-enrollment-controller";

const { getEnrollmentListHandler } = await import(
    "../../../../src/modules/enrollments/enrollment.controller.js"
);
const { default: Enrollment } = await import(
    "../../../../src/modules/enrollments/enrollment.model.js"
);
const { default: OrganizationMembership } = await import(
    "../../../../src/modules/organizationMemberships/organizationMembership.model.js"
);


test("returns scoped enrollment data and pagination in the API response", async (t) => {
    const enrollments = [{ _id: "enrollment-1" }];
    let capturedFilter;
    const query = {
        populate() { return this; },
        sort() { return this; },
        skip() { return this; },
        limit() { return this; },
        lean() { return Promise.resolve(enrollments); }
    };
    t.mock.method(
        OrganizationMembership,
        "findOne",
        () => ({ lean: async () => ({ role: "admin", status: "approved" }) })
    );
    t.mock.method(Enrollment, "find", (filter) => {
        capturedFilter = filter;
        return query;
    });
    t.mock.method(Enrollment, "countDocuments", async () => 1);

    const response = await new Promise((resolve, reject) => {
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
        getEnrollmentListHandler({
            user: {
                orgId: "507f1f77bcf86cd799439011",
                userId: "507f1f77bcf86cd799439012"
            },
            organizationMembership: { role: "admin" },
            validated: {
                query: {
                    courseId: undefined,
                    traineeId: undefined,
                    status: "enrolled",
                    page: 1,
                    limit: 20,
                    sortBy: "enrolledAt",
                    sortOrder: "desc"
                }
            }
        }, res, reject);
    });

    assert.deepEqual(capturedFilter, {
        org: "507f1f77bcf86cd799439011",
        status: "enrolled"
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.data, enrollments);
    assert.deepEqual(response.body.meta, {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1
    });
});
