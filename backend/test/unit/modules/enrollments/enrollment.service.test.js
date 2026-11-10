import test from "node:test";
import assert from "node:assert/strict";

process.env.CLIENT_URL ||= "http://localhost:3000";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/ascendra_test";
process.env.JWT_ACCESS_SECRET ||= "test-access-secret-for-enrollments";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-for-enrollments";

const { createCourseEnrollment } = await import(
    "../../../../src/modules/enrollments/enrollment.service.js"
);


test("rejects invalid identifiers before attempting enrollment", async () => {
    await assert.rejects(
        () => createCourseEnrollment({
            orgId: "invalid",
            courseId: "507f1f77bcf86cd799439011",
            traineeId: "507f1f77bcf86cd799439012",
            requestedBy: "507f1f77bcf86cd799439013",
            role: "trainee"
        }),
        (error) => error.statusCode === 400 &&
            error.code === "VALIDATION_ERROR"
    );
});


test("prevents a trainer from creating enrollments on behalf of a trainee", async () => {
    await assert.rejects(
        () => createCourseEnrollment({
            orgId: "507f1f77bcf86cd799439010",
            courseId: "507f1f77bcf86cd799439011",
            traineeId: "507f1f77bcf86cd799439012",
            requestedBy: "507f1f77bcf86cd799439013",
            role: "trainer"
        }),
        (error) => error.statusCode === 403 &&
            error.message.includes("Only trainees can enroll themselves")
    );
});
