import test from "node:test";
import assert from "node:assert/strict";

process.env.CLIENT_URL ||= "http://localhost:3000";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/ascendra_test";
process.env.JWT_ACCESS_SECRET ||= "test-access-secret-for-course-service";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-for-course-service";

const { default: Course } = await import(
    "../../../../src/modules/courses/course.model.js"
);
const { default: TrainerAssignment } = await import(
    "../../../../src/modules/trainerAssignments/trainerAssignment.model.js"
);
const { default: OrganizationMembership } = await import(
    "../../../../src/modules/organizationMemberships/organizationMembership.model.js"
);
const { default: Enrollment } = await import(
    "../../../../src/modules/enrollments/enrollment.model.js"
);
const {
    createCourse,
    getCourse,
    listCourses,
    editCourse,
    transitionCourseStatus
} = await import("../../../../src/modules/courses/course.service.js");

const orgId = "507f1f77bcf86cd799439011";
const userId = "507f1f77bcf86cd799439012";
const courseId = "507f1f77bcf86cd799439013";
const assignmentId = "507f1f77bcf86cd799439014";

const query = (result) => ({
    session() { return this; },
    populate() { return this; },
    lean() { return Promise.resolve(result); }
});

const courseRecord = (overrides = {}) => ({
    _id: courseId,
    org: orgId,
    trainer: userId,
    status: "draft",
    startDate: new Date("2026-06-01"),
    endDate: new Date("2026-06-02"),
    ...overrides
});


test("creates a draft course from the requester's active trainer assignment", async (t) => {
    const assignment = {
        _id: assignmentId,
        trainer: userId,
        trainerProfile: "profile-1",
        requirement: "requirement-1",
        status: "assigned"
    };
    const created = { _id: courseId, status: "draft" };
    t.mock.method(TrainerAssignment, "findOne", () => query(assignment));
    t.mock.method(Course, "findOne", () => query(null));
    t.mock.method(Course.prototype, "save", async function () {
        this._id = courseId;
        return created;
    });

    const result = await createCourse({
        orgId,
        trainerAssignmentId: assignmentId,
        title: "Workplace Safety",
        startDate: "2026-06-01",
        endDate: "2026-06-03",
        createdBy: userId
    });

    assert.equal(result, created);
});


test("rejects duplicate or inactive assignment courses with controlled conflicts", async (t) => {
    t.mock.method(TrainerAssignment, "findOne", () => query({
        _id: assignmentId,
        trainer: userId,
        status: "completed"
    }));

    await assert.rejects(
        () => createCourse({
            orgId,
            trainerAssignmentId: assignmentId,
            title: "Workplace Safety",
            startDate: "2026-06-01",
            endDate: "2026-06-03",
            createdBy: userId
        }),
        (error) => error.statusCode === 409
    );
});


test("allows an owner to retrieve a course and rejects another trainer", async (t) => {
    t.mock.method(Course, "findOne", () => query(courseRecord()));

    assert.equal(
        await getCourse({ orgId, courseId, userId, role: "trainer" })
            .then((result) => result._id),
        courseId
    );
    await assert.rejects(
        () => getCourse({
            orgId,
            courseId,
            userId: "507f1f77bcf86cd799439099",
            role: "trainer"
        }),
        (error) => error.statusCode === 403
    );
});


test("checks trainee membership and enrollment before returning available courses", async (t) => {
    const publishedCourse = courseRecord({ status: "published" });
    const membershipFind = t.mock.method(
        OrganizationMembership,
        "findOne",
        () => ({ lean: async () => ({ status: "approved" }) })
    );
    const enrollmentFind = t.mock.method(
        Enrollment,
        "findOne",
        () => ({ lean: async () => ({ status: "enrolled" }) })
    );
    t.mock.method(Course, "findOne", () => query(publishedCourse));

    const result = await getCourse({
        orgId,
        courseId,
        userId,
        role: "trainee"
    });

    assert.equal(result, publishedCourse);
    assert.deepEqual(membershipFind.mock.calls[0].arguments[0], {
        org: orgId,
        user: userId,
        role: "trainee",
        status: "approved"
    });
    assert.deepEqual(enrollmentFind.mock.calls[0].arguments[0].status.$in, [
        "enrolled",
        "in_progress",
        "completed"
    ]);
});


test("applies role-specific course listing filters and rejects unsupported roles", async (t) => {
    let capturedFilter;
    t.mock.method(Course, "find", (filter) => {
        capturedFilter = filter;
        return {
            sort() { return this; },
            skip() { return this; },
            limit() { return this; },
            populate() { return this; },
            lean: async () => []
        };
    });
    t.mock.method(Course, "countDocuments", async () => 0);

    await listCourses({
        orgId, userId, role: "trainer", filters: { status: "ongoing" }
    });
    assert.deepEqual(capturedFilter, {
        org: orgId,
        status: "ongoing",
        trainer: userId
    });

    await listCourses({
        orgId, userId, role: "admin", filters: { status: "draft" }
    });
    assert.deepEqual(capturedFilter, { org: orgId, status: "draft" });

    await assert.rejects(
        () => listCourses({ orgId, userId, role: "unknown" }),
        (error) => error.statusCode === 403
    );
});


test("restricts trainee course listings to published courses", async (t) => {
    let capturedFilter;
    t.mock.method(
        OrganizationMembership,
        "findOne",
        () => ({ lean: async () => ({ status: "approved" }) })
    );
    t.mock.method(Course, "find", (filter) => {
        capturedFilter = filter;
        return {
            sort() { return this; },
            skip() { return this; },
            limit() { return this; },
            populate() { return this; },
            lean: async () => []
        };
    });
    t.mock.method(Course, "countDocuments", async () => 0);

    await listCourses({
        orgId, userId, role: "trainee", filters: { status: "cancelled" }
    });

    assert.deepEqual(capturedFilter, {
        org: orgId,
        status: "published"
    });
});


test("edits draft course metadata and rejects invalid date ranges", async (t) => {
    t.mock.method(Course, "findOne", () => query(courseRecord()));
    let captured;
    t.mock.method(Course, "findOneAndUpdate", (...args) => {
        captured = args;
        return Promise.resolve({ _id: courseId, title: "Updated" });
    });

    const updated = await editCourse({
        orgId,
        courseId,
        userId,
        role: "trainer",
        updates: { title: "Updated", startDate: "2026-06-01" }
    });

    assert.equal(updated.title, "Updated");
    assert.equal(captured[1].$set.title, "Updated");
    assert.ok(captured[1].$set.startDate instanceof Date);

    await assert.rejects(
        () => editCourse({
            orgId,
            courseId,
            userId,
            role: "trainer",
            updates: { startDate: "2026-06-04" }
        }),
        (error) => error.statusCode === 400
    );
});


test("transitions course lifecycle and rejects unsupported transitions", async (t) => {
    t.mock.method(Course, "findOne", () => query(courseRecord()));
    t.mock.method(Course, "findOneAndUpdate", async (_filter, update) => ({
        ...courseRecord(),
        status: update.$set.status
    }));

    const published = await transitionCourseStatus({
        orgId, courseId, userId, role: "trainer", status: "published"
    });
    assert.equal(published.status, "published");

    await assert.rejects(
        () => transitionCourseStatus({
            orgId, courseId, userId, role: "trainer", status: "completed"
        }),
        (error) => error.statusCode === 409
    );
});
