import test from "node:test";
import assert from "node:assert/strict";

import {
    initiateCourseMaterialUploadSchema,
    confirmCourseMaterialUploadSchema,
    listCourseMaterialsQuerySchema,
    updateCourseMaterialSchema
} from "../../../../src/modules/courseMaterials/courseMaterial.validation.js";


const courseId = "507f1f77bcf86cd799439011";
const materialId = "507f1f77bcf86cd799439012";


test("validates upload initiation metadata and rejects unsupported files", () => {
    const valid = initiateCourseMaterialUploadSchema.safeParse({
        params: { courseId },
        body: {
            originalName: "lesson.pdf",
            mimeType: "application/pdf",
            size: 1024
        }
    });
    const invalid = initiateCourseMaterialUploadSchema.safeParse({
        params: { courseId },
        body: {
            originalName: "lesson.exe",
            mimeType: "application/octet-stream",
            size: 1024
        }
    });

    assert.equal(valid.success, true);
    assert.equal(invalid.success, false);
});


test("applies confirmation defaults and enforces strict upload metadata", () => {
    const result = confirmCourseMaterialUploadSchema.safeParse({
        params: { courseId },
        body: {
            publicId: "course-materials/lesson",
            resourceType: "raw",
            originalName: "lesson.pdf",
            mimeType: "application/pdf",
            size: 1024,
            title: "Lesson PDF",
            materialType: "pdf"
        }
    });
    const withUnknownField = confirmCourseMaterialUploadSchema.safeParse({
        params: { courseId },
        body: {
            publicId: "course-materials/lesson",
            resourceType: "raw",
            originalName: "lesson.pdf",
            mimeType: "application/pdf",
            size: 1024,
            title: "Lesson PDF",
            materialType: "pdf",
            storageKey: "untrusted"
        }
    });

    assert.equal(result.success, true);
    assert.equal(result.data.body.description, "");
    assert.equal(result.data.body.displayOrder, 0);
    assert.equal(withUnknownField.success, false);
});


test("coerces material-list pagination and applies ordering defaults", () => {
    const result = listCourseMaterialsQuerySchema.parse({
        params: { courseId },
        query: { page: "2", limit: "8" }
    });

    assert.equal(result.query.page, 2);
    assert.equal(result.query.limit, 8);
    assert.equal(result.query.sortBy, "displayOrder");
    assert.equal(result.query.sortOrder, "asc");
});


test("requires material updates to contain only editable fields", () => {
    assert.equal(
        updateCourseMaterialSchema.safeParse({
            params: { courseId, materialId },
            body: {}
        }).success,
        false
    );
    assert.equal(
        updateCourseMaterialSchema.safeParse({
            params: { courseId, materialId },
            body: { status: "archived" }
        }).success,
        false
    );
    assert.equal(
        updateCourseMaterialSchema.safeParse({
            params: { courseId, materialId },
            body: { displayOrder: 0 }
        }).success,
        true
    );
});
