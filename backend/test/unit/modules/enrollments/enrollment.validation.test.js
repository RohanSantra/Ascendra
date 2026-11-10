import test from "node:test";
import assert from "node:assert/strict";

import {
    createEnrollmentSchema,
    listEnrollmentsQuerySchema,
    updateEnrollmentStatusSchema
} from "../../../../src/modules/enrollments/enrollment.validation.js";


const courseId = "507f1f77bcf86cd799439011";
const enrollmentId = "507f1f77bcf86cd799439012";


test("allows a trainee to enroll themselves without a trainee ID", () => {
    assert.equal(
        createEnrollmentSchema.safeParse({
            params: { courseId },
            body: {}
        }).success,
        true
    );
    assert.equal(
        createEnrollmentSchema.safeParse({
            params: { courseId },
            body: { traineeId: "not-an-id" }
        }).success,
        false
    );
});


test("coerces enrollment listing pagination and applies defaults", () => {
    const result = listEnrollmentsQuerySchema.parse({
        query: { courseId, page: "2", limit: "30" }
    });

    assert.equal(result.query.page, 2);
    assert.equal(result.query.limit, 30);
    assert.equal(result.query.sortBy, "enrolledAt");
    assert.equal(result.query.sortOrder, "desc");
    assert.equal(
        listEnrollmentsQuerySchema.safeParse({
            query: { status: "paused" }
        }).success,
        false
    );
});


test("validates enrollment lifecycle updates and rejects extra fields", () => {
    assert.equal(
        updateEnrollmentStatusSchema.safeParse({
            params: { enrollmentId },
            body: { status: "in_progress" }
        }).success,
        true
    );
    assert.equal(
        updateEnrollmentStatusSchema.safeParse({
            params: { enrollmentId },
            body: { status: "enrolled" }
        }).success,
        false
    );
    assert.equal(
        updateEnrollmentStatusSchema.safeParse({
            params: { enrollmentId },
            body: { status: "completed", traineeId: courseId }
        }).success,
        false
    );
});
