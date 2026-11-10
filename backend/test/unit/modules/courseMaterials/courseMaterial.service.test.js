import test from "node:test";
import assert from "node:assert/strict";

process.env.CLIENT_URL ||= "http://localhost:3000";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/ascendra_test";
process.env.JWT_ACCESS_SECRET ||= "test-access-secret-for-course-materials";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-for-course-materials";

const { initiateCourseMaterialUpload } = await import(
    "../../../../src/modules/courseMaterials/courseMaterial.service.js"
);


test("rejects invalid access identifiers before initiating an upload", async () => {
    await assert.rejects(
        () => initiateCourseMaterialUpload({
            orgId: "invalid",
            courseId: "507f1f77bcf86cd799439011",
            userId: "507f1f77bcf86cd799439012",
            role: "trainer",
            originalName: "lesson.pdf",
            mimeType: "application/pdf",
            size: 1024
        }),
        (error) => error.statusCode === 400 &&
            error.code === "VALIDATION_ERROR"
    );
});
