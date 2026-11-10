import test from "node:test";
import assert from "node:assert/strict";

process.env.CLIENT_URL ||= "http://localhost:3000";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/ascendra_test";
process.env.JWT_ACCESS_SECRET ||= "test-access-secret-for-enrollment-service";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-for-enrollment-service";

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
    createCourseEnrollment,
    getCourseEnrollment,
    listCourseEnrollments,
    updateCourseEnrollmentStatus
} = await import("../../../../src/modules/enrollments/enrollment.service.js");

const orgId = "507f1f77bcf86cd799439011";
const courseId = "507f1f77bcf86cd799439012";
const traineeId = "507f1f77bcf86cd799439013";
const adminId = "507f1f77bcf86cd799439014";
const enrollmentId = "507f1f77bcf86cd799439015";

const query = (result) => ({
    session() { return this; },
    populate() { return this; },
    lean() { return Promise.resolve(result); }
});

const approvedMembership = () => ({
    lean: async () => ({ status: "approved" })
});

const enrollment = (overrides = {}) => ({
    _id: enrollmentId,
    org: orgId,
    course: courseId,
    trainee: traineeId,
    status: "enrolled",
    ...overrides
});

const publishedCourse = (overrides = {}) => ({
    _id: courseId,
    trainer: adminId,
    status: "published",
    ...overrides
});


test("creates self-enrollment after verifying published course and approved trainee membership", async (t) => {
    t.mock.method(
        OrganizationMembership,
        "findOne",
        () => approvedMembership()
    );
    t.mock.method(Course, "findOne", () => query(publishedCourse()));
    t.mock.method(Enrollment, "findOne", () => query(null));
    let inserted;
    t.mock.method(Enrollment, "create", async ([data]) => {
        inserted = data;
        return [data];
    });

    const result = await createCourseEnrollment({
        orgId,
        courseId,
        traineeId,
        requestedBy: traineeId,
        role: "trainee"
    });

    assert.equal(result, inserted);
    assert.deepEqual(inserted, {
        org: orgId,
        course: courseId,
        trainee: traineeId,
        status: "enrolled",
        enrolledAt: inserted.enrolledAt
    });
    assert.ok(inserted.enrolledAt instanceof Date);
});


test("allows admins to enroll an approved trainee and translates duplicate-key races", async (t) => {
    const membership = t.mock.method(
        OrganizationMembership,
        "findOne",
        () => approvedMembership()
    );
    t.mock.method(Course, "findOne", () => query(publishedCourse()));
    t.mock.method(Enrollment, "findOne", () => query(null));
    t.mock.method(Enrollment, "create", async () => {
        throw { code: 11000 };
    });

    await assert.rejects(
        () => createCourseEnrollment({
            orgId,
            courseId,
            traineeId,
            requestedBy: adminId,
            role: "admin"
        }),
        (error) => error.statusCode === 409
    );
    assert.equal(membership.mock.calls.length, 2);
});


test("rejects non-published courses and existing enrollment records", async (t) => {
    t.mock.method(
        OrganizationMembership,
        "findOne",
        () => approvedMembership()
    );
    t.mock.method(Course, "findOne", () => query(publishedCourse({
        status: "draft"
    })));

    await assert.rejects(
        () => createCourseEnrollment({
            orgId,
            courseId,
            traineeId,
            requestedBy: traineeId,
            role: "trainee"
        }),
        (error) => error.statusCode === 409
    );
});


test("retrieves a trainer-owned enrollment and enforces trainee ownership", async (t) => {
    t.mock.method(
        OrganizationMembership,
        "findOne",
        () => approvedMembership()
    );
    t.mock.method(Enrollment, "findOne", () => query(enrollment({
        trainee: traineeId
    })));
    t.mock.method(Course, "findOne", () => query(publishedCourse({
        trainer: adminId
    })));

    assert.equal(
        (await getCourseEnrollment({
            orgId,
            enrollmentId,
            userId: adminId,
            role: "trainer"
        }))._id,
        enrollmentId
    );

    await assert.rejects(
        () => getCourseEnrollment({
            orgId,
            enrollmentId,
            userId: "507f1f77bcf86cd799439099",
            role: "trainee"
        }),
        (error) => error.statusCode === 403
    );
});


test("lists trainee records scoped to the requester and requires a course for trainers", async (t) => {
    t.mock.method(
        OrganizationMembership,
        "findOne",
        () => approvedMembership()
    );
    let captured;
    t.mock.method(Enrollment, "find", (filter) => {
        captured = filter;
        return {
            populate() { return this; },
            sort() { return this; },
            skip() { return this; },
            limit() { return this; },
            lean: async () => []
        };
    });
    t.mock.method(Enrollment, "countDocuments", async () => 0);

    await listCourseEnrollments({
        orgId,
        userId: traineeId,
        role: "trainee",
        traineeId: adminId,
        filters: { status: "enrolled" }
    });
    assert.equal(captured.trainee, traineeId);

    await assert.rejects(
        () => listCourseEnrollments({
            orgId,
            userId: adminId,
            role: "trainer"
        }),
        (error) => error.statusCode === 400
    );
});


test("transitions trainee enrollment to in-progress with a start timestamp", async (t) => {
    t.mock.method(
        OrganizationMembership,
        "findOne",
        () => approvedMembership()
    );
    t.mock.method(Enrollment, "findOne", () => query(enrollment()));
    t.mock.method(Course, "findOne", () => query(publishedCourse()));
    let captured;
    t.mock.method(Enrollment, "findOneAndUpdate", (filter, update) => {
        captured = { filter, update };
        return query(enrollment({
            status: "in_progress",
            startedAt: update.$set.startedAt
        }));
    });

    const result = await updateCourseEnrollmentStatus({
        orgId,
        enrollmentId,
        status: "in_progress",
        userId: traineeId,
        role: "trainee"
    });

    assert.equal(result.status, "in_progress");
    assert.ok(captured.update.$set.startedAt instanceof Date);
    assert.equal(captured.filter.status, "enrolled");
});


test("allows course trainers to complete enrollments and sets completion time", async (t) => {
    t.mock.method(
        OrganizationMembership,
        "findOne",
        () => approvedMembership()
    );
    t.mock.method(Enrollment, "findOne", () => query(enrollment({
        status: "in_progress"
    })));
    t.mock.method(Course, "findOne", () => query(publishedCourse({
        trainer: adminId
    })));
    let capturedUpdate;
    t.mock.method(Enrollment, "findOneAndUpdate", (_filter, update) => {
        capturedUpdate = update;
        return query(enrollment({
            status: "completed",
            completedAt: update.$set.completedAt
        }));
    });

    const result = await updateCourseEnrollmentStatus({
        orgId,
        enrollmentId,
        status: "completed",
        userId: adminId,
        role: "trainer"
    });

    assert.equal(result.status, "completed");
    assert.ok(capturedUpdate.$set.completedAt instanceof Date);
});


test("rejects terminal-state transitions and conflicting concurrent updates", async (t) => {
    t.mock.method(
        OrganizationMembership,
        "findOne",
        () => approvedMembership()
    );
    t.mock.method(Enrollment, "findOne", () => query(enrollment({
        status: "completed"
    })));
    t.mock.method(Course, "findOne", () => query(publishedCourse()));

    await assert.rejects(
        () => updateCourseEnrollmentStatus({
            orgId,
            enrollmentId,
            status: "cancelled",
            userId: adminId,
            role: "admin"
        }),
        (error) => error.statusCode === 409
    );
});
