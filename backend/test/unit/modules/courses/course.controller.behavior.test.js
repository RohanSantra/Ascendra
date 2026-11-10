import test from "node:test";
import assert from "node:assert/strict";

process.env.CLIENT_URL ||= "http://localhost:3000";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/ascendra_test";
process.env.JWT_ACCESS_SECRET ||= "test-access-secret-for-course-controller-behavior";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-for-course-controller-behavior";

const { default: Course } = await import(
    "../../../../src/modules/courses/course.model.js"
);
const { default: TrainerAssignment } = await import(
    "../../../../src/modules/trainerAssignments/trainerAssignment.model.js"
);
const {
    createCourseHandler,
    getCourseListHandler,
    updateCourseHandler,
    transitionCourseStatusHandler
} = await import("../../../../src/modules/courses/course.controller.js");

const orgId = "507f1f77bcf86cd799439011";
const userId = "507f1f77bcf86cd799439012";
const courseId = "507f1f77bcf86cd799439013";
const assignmentId = "507f1f77bcf86cd799439014";

const query = (result) => ({
    session() { return this; },
    populate() { return this; },
    lean() { return Promise.resolve(result); }
});

const invoke = (handler, req) => new Promise((resolve, reject) => {
    const res = {
        req: { requestId: "course-controller-test" },
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

const requestBase = {
    user: { orgId, userId },
    organizationMembership: { role: "admin" }
};


test("creates a course and returns the created representation", async (t) => {
    const assignment = {
        _id: assignmentId,
        trainer: userId,
        trainerProfile: "profile-1",
        requirement: "requirement-1",
        status: "assigned"
    };
    t.mock.method(TrainerAssignment, "findOne", () => query(assignment));
    t.mock.method(Course, "findOne", () => query(null));
    t.mock.method(Course.prototype, "save", async () => ({
        _id: courseId,
        title: "Workplace Safety"
    }));

    const response = await invoke(createCourseHandler, {
        ...requestBase,
        validated: {
            body: {
                trainerAssignmentId: assignmentId,
                title: "Workplace Safety",
                description: "Safety course",
                startDate: "2026-06-01",
                endDate: "2026-06-02"
            }
        }
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.data.title, "Workplace Safety");
});


test("lists courses with pagination metadata", async (t) => {
    const courses = [{ _id: courseId, title: "Workplace Safety" }];
    t.mock.method(Course, "find", () => ({
        sort() { return this; },
        skip() { return this; },
        limit() { return this; },
        populate() { return this; },
        lean: async () => courses
    }));
    t.mock.method(Course, "countDocuments", async () => 1);

    const response = await invoke(getCourseListHandler, {
        ...requestBase,
        validated: {
            query: {
                status: "published",
                page: 2,
                limit: 5,
                sortBy: "startDate",
                sortOrder: "asc"
            }
        }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data, courses);
    assert.equal(response.body.meta.page, 2);
});


test("updates a draft course and publishes it through lifecycle transition", async (t) => {
    const draft = {
        _id: courseId,
        trainer: userId,
        status: "draft",
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-06-02")
    };
    t.mock.method(Course, "findOne", () => query(draft));
    t.mock.method(Course, "findOneAndUpdate", async (_filter, update) => ({
        ...draft,
        ...update.$set,
        status: update.$set.status || draft.status
    }));

    const edited = await invoke(updateCourseHandler, {
        ...requestBase,
        validated: {
            params: { id: courseId },
            body: { title: "Updated safety course" }
        }
    });
    assert.equal(edited.statusCode, 200);
    assert.equal(edited.body.data.title, "Updated safety course");

    const published = await invoke(transitionCourseStatusHandler, {
        ...requestBase,
        validated: {
            params: { id: courseId },
            body: { status: "published" }
        }
    });
    assert.equal(published.statusCode, 200);
    assert.equal(published.body.data.status, "published");
});
