import test from "node:test";
import assert from "node:assert/strict";

import Course from "../../../../src/modules/courses/course.model.js";
import {
    getCourseById,
    getCourses,
    updateCourseStatus
} from "../../../../src/modules/courses/course.repository.js";


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


test("retrieves a course within its organisation and applies requested population", async (t) => {
    const orgId = "org-1";
    const courseId = "course-1";
    const expected = { _id: courseId };
    let capturedFilter;
    let query;

    t.mock.method(Course, "findOne", (filter) => {
        capturedFilter = filter;
        query = createQuery(expected);
        return query;
    });

    const result = await getCourseById({
        orgId,
        courseId,
        session: "db-session"
    });

    assert.deepEqual(capturedFilter, { _id: courseId, org: orgId });
    assert.equal(query.sessionValue, "db-session");
    assert.equal(result, expected);
});


test("filters and paginates course lists with an allowlisted sort", async (t) => {
    let capturedFilter;
    let query;
    let capturedCountFilter;
    t.mock.method(Course, "find", (filter) => {
        capturedFilter = filter;
        query = createQuery([{ _id: "course-1" }]);
        return query;
    });
    t.mock.method(Course, "countDocuments", async (filter) => {
        capturedCountFilter = filter;
        return 9;
    });

    const result = await getCourses({
        orgId: "org-1",
        filters: { status: "published", trainerId: "trainer-1" },
        pagination: { page: 2, limit: 3 },
        sort: { sortBy: "unsafeField", sortOrder: "asc" }
    });

    assert.deepEqual(capturedFilter, {
        org: "org-1",
        status: "published",
        trainer: "trainer-1"
    });
    assert.deepEqual(capturedCountFilter, capturedFilter);
    assert.deepEqual(query.sortValue, { createdAt: 1, _id: 1 });
    assert.equal(query.skipValue, 3);
    assert.equal(query.limitValue, 3);
    assert.deepEqual(result, {
        courses: [{ _id: "course-1" }],
        pagination: { total: 9, page: 2, limit: 3, totalPages: 3 }
    });
});


test("updates a course status only within the organization and enables validation", async (t) => {
    const expected = { status: "published" };
    let captured;
    t.mock.method(Course, "findOneAndUpdate", (...args) => {
        captured = args;
        return Promise.resolve(expected);
    });

    const result = await updateCourseStatus({
        orgId: "org-1",
        courseId: "course-1",
        status: "published",
        session: "db-session"
    });

    assert.equal(result, expected);
    assert.deepEqual(captured, [
        { _id: "course-1", org: "org-1" },
        { $set: { status: "published" } },
        {
            returnDocument: "after",
            runValidators: true,
            session: "db-session"
        }
    ]);
});
