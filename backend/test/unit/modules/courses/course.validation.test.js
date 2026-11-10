import test from "node:test";
import assert from "node:assert/strict";

import {
    createCourseSchema,
    updateCourseSchema,
    listCoursesQuerySchema,
    updateCourseStatusSchema
} from "../../../../src/modules/courses/course.validation.js";


const courseId = "507f1f77bcf86cd799439011";


test("validates and trims course creation data", () => {
    const result = createCourseSchema.safeParse({
        body: {
            trainerAssignmentId: courseId,
            title: "  Safety Training  ",
            description: "  Required orientation  ",
            startDate: "2026-06-01",
            endDate: "2026-06-02"
        }
    });

    assert.equal(result.success, true);
    assert.equal(result.data.body.title, "Safety Training");
    assert.equal(result.data.body.description, "Required orientation");
});


test("rejects impossible dates, reversed date ranges and unknown creation fields", () => {
    const invalidDate = createCourseSchema.safeParse({
        body: {
            trainerAssignmentId: courseId,
            title: "Safety Training",
            startDate: "2026-02-30",
            endDate: "2026-03-01"
        }
    });
    const reversedRange = createCourseSchema.safeParse({
        body: {
            trainerAssignmentId: courseId,
            title: "Safety Training",
            startDate: "2026-06-02",
            endDate: "2026-06-01"
        }
    });
    const unknownField = createCourseSchema.safeParse({
        body: {
            trainerAssignmentId: courseId,
            title: "Safety Training",
            startDate: "2026-06-01",
            endDate: "2026-06-02",
            status: "published"
        }
    });

    assert.equal(invalidDate.success, false);
    assert.equal(reversedRange.success, false);
    assert.equal(unknownField.success, false);
});


test("requires a non-empty update and rejects immutable fields", () => {
    assert.equal(
        updateCourseSchema.safeParse({
            params: { id: courseId },
            body: {}
        }).success,
        false
    );
    assert.equal(
        updateCourseSchema.safeParse({
            params: { id: courseId },
            body: { status: "published" }
        }).success,
        false
    );
    assert.equal(
        updateCourseSchema.safeParse({
            params: { id: courseId },
            body: { title: "  New title  " }
        }).data.body.title,
        "New title"
    );
});


test("coerces course-list pagination and applies defaults", () => {
    const result = listCoursesQuerySchema.parse({
        query: { page: "3", limit: "25" }
    });

    assert.deepEqual(result.query, {
        page: 3,
        limit: 25,
        sortBy: "createdAt",
        sortOrder: "desc"
    });
    assert.equal(
        listCoursesQuerySchema.safeParse({
            query: { status: "unknown" }
        }).success,
        false
    );
});


test("accepts supported lifecycle statuses and rejects draft transitions", () => {
    assert.equal(
        updateCourseStatusSchema.safeParse({
            body: { status: "published" }
        }).success,
        true
    );
    assert.equal(
        updateCourseStatusSchema.safeParse({
            body: { status: "draft" }
        }).success,
        false
    );
});
