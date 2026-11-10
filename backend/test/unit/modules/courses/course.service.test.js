import test from "node:test";
import assert from "node:assert/strict";

process.env.CLIENT_URL ||= "http://localhost:3000";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/ascendra_test";
process.env.JWT_ACCESS_SECRET ||= "test-access-secret-for-courses";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-for-courses";

const { getCourse } = await import(
    "../../../../src/modules/courses/course.service.js"
);


test("rejects invalid identifiers before querying a course", async () => {
    await assert.rejects(
        () => getCourse({
            orgId: "not-an-object-id",
            courseId: "507f1f77bcf86cd799439011",
            userId: "507f1f77bcf86cd799439012",
            role: "admin"
        }),
        (error) => error.statusCode === 400 &&
            error.code === "VALIDATION_ERROR"
    );
});
