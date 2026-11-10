import test from "node:test";
import assert from "node:assert/strict";

process.env.CLIENT_URL ||= "http://localhost:3000";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/ascendra_test";
process.env.JWT_ACCESS_SECRET ||= "test-access-secret-for-material-controller";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-for-material-controller";

const { getCourseMaterialListHandler } = await import(
    "../../../../src/modules/courseMaterials/courseMaterial.controller.js"
);
const { default: Course } = await import(
    "../../../../src/modules/courses/course.model.js"
);
const { default: CourseMaterial } = await import(
    "../../../../src/modules/courseMaterials/courseMaterial.model.js"
);


test("returns course materials and pagination after enforcing course access", async (t) => {
    const course = {
        _id: "507f1f77bcf86cd799439013",
        trainer: "507f1f77bcf86cd799439014",
        status: "published"
    };
    const materials = [{ _id: "material-1", title: "Handout" }];
    let courseFilter;
    let materialFilter;
    const courseQuery = {
        session() { return this; },
        populate() { return this; },
        lean() { return Promise.resolve(course); }
    };
    const materialQuery = {
        sort() { return this; },
        skip() { return this; },
        limit() { return this; },
        populate() { return this; },
        lean() { return Promise.resolve(materials); }
    };
    t.mock.method(Course, "findOne", (filter) => {
        courseFilter = filter;
        return courseQuery;
    });
    t.mock.method(CourseMaterial, "find", (filter) => {
        materialFilter = filter;
        return materialQuery;
    });
    t.mock.method(CourseMaterial, "countDocuments", async () => 1);

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
        getCourseMaterialListHandler({
            user: {
                orgId: "507f1f77bcf86cd799439011",
                userId: "507f1f77bcf86cd799439012"
            },
            organizationMembership: { role: "admin" },
            validated: {
                params: { courseId: course._id },
                query: {
                    status: undefined,
                    page: 1,
                    limit: 20,
                    sortBy: "displayOrder",
                    sortOrder: "asc"
                }
            }
        }, res, reject);
    });

    assert.deepEqual(courseFilter, {
        _id: course._id,
        org: "507f1f77bcf86cd799439011"
    });
    assert.deepEqual(materialFilter, {
        org: "507f1f77bcf86cd799439011",
        course: course._id,
        status: "active"
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.data, materials);
    assert.equal(response.body.meta.total, 1);
});
