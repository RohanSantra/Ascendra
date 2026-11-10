import test from "node:test";
import assert from "node:assert/strict";

import Enrollment from "../../../../src/modules/enrollments/enrollment.model.js";
import {
    getEnrollmentByCourseAndTrainee,
    getEnrollments,
    updateEnrollment
} from "../../../../src/modules/enrollments/enrollment.repository.js";


const createQuery = (result) => ({
    session(value) {
        this.sessionValue = value;
        return this;
    },
    populate() {
        return this;
    },
    sort(value) {
        this.sortValue = value;
        return this;
    },
    skip(value) {
        this.skipValue = value;
        return this;
    },
    limit(value) {
        this.limitValue = value;
        return this;
    },
    lean() {
        return Promise.resolve(result);
    }
});


test("looks up an enrollment by organisation, course and trainee with an optional session", async (t) => {
    let capturedFilter;
    let query;
    const enrollment = { _id: "enrollment-1" };
    t.mock.method(Enrollment, "findOne", (filter) => {
        capturedFilter = filter;
        query = createQuery(enrollment);
        return query;
    });

    const result = await getEnrollmentByCourseAndTrainee({
        orgId: "org-1",
        courseId: "course-1",
        traineeId: "trainee-1"
    }, { session: "db-session" });

    assert.deepEqual(capturedFilter, {
        org: "org-1",
        course: "course-1",
        trainee: "trainee-1"
    });
    assert.equal(query.sessionValue, "db-session");
    assert.equal(result, enrollment);
});


test("scopes, sorts and paginates enrollment listings", async (t) => {
    let capturedFilter;
    let query;
    t.mock.method(Enrollment, "find", (filter) => {
        capturedFilter = filter;
        query = createQuery([{ _id: "enrollment-1" }]);
        return query;
    });
    t.mock.method(Enrollment, "countDocuments", async () => 4);

    const result = await getEnrollments({
        orgId: "org-1",
        courseId: "course-1",
        traineeId: "trainee-1",
        filters: { status: "in_progress" },
        pagination: { page: 2, limit: 1 },
        sort: { sortBy: "untrusted", sortOrder: "asc" }
    });

    assert.deepEqual(capturedFilter, {
        org: "org-1",
        course: "course-1",
        trainee: "trainee-1",
        status: "in_progress"
    });
    assert.deepEqual(query.sortValue, { enrolledAt: 1, _id: -1 });
    assert.equal(query.skipValue, 1);
    assert.equal(query.limitValue, 1);
    assert.deepEqual(result.meta, {
        page: 2,
        limit: 1,
        total: 4,
        totalPages: 4
    });
});


test("uses compare-and-set status filters for enrollment transitions", async (t) => {
    let captured;
    const updatedEnrollment = { status: "completed" };
    t.mock.method(Enrollment, "findOneAndUpdate", (...args) => {
        captured = args;
        return createQuery(updatedEnrollment);
    });

    const result = await updateEnrollment({
        orgId: "org-1",
        enrollmentId: "enrollment-1",
        expectedStatus: "in_progress",
        updates: { status: "completed", completedAt: new Date("2026-01-01") }
    });

    assert.equal(result, updatedEnrollment);
    assert.deepEqual(captured[0], {
        _id: "enrollment-1",
        org: "org-1",
        status: "in_progress"
    });
    assert.equal(captured[2].returnDocument, "after");
    assert.equal(captured[2].runValidators, true);
});
