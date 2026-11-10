import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import CourseMaterial from "../../../../src/modules/courseMaterials/courseMaterial.model.js";


const createMaterial = (overrides = {}) => new CourseMaterial({
    org: new mongoose.Types.ObjectId(),
    course: new mongoose.Types.ObjectId(),
    title: "  Course Handout  ",
    materialType: "pdf",
    file: {
        originalName: "handout.pdf",
        storageProvider: "cloudinary",
        storageKey: "raw:materials/handout",
        assetId: "asset-123",
        resourceType: "raw",
        mimeType: "application/pdf",
        size: 2048
    },
    uploadedBy: new mongoose.Types.ObjectId(),
    ...overrides
});


test("applies material defaults and normalizes nested file metadata", async () => {
    const material = createMaterial();

    assert.equal(material.title, "Course Handout");
    assert.equal(material.status, "active");
    assert.equal(material.displayOrder, 0);
    assert.equal(material.description, "");
    assert.equal(material.file.storageKey, "raw:materials/handout");
    await material.validate();
});


test("requires valid material and file metadata", async () => {
    const missingFile = createMaterial({
        file: undefined
    });
    const invalidFile = createMaterial({
        file: {
            originalName: "handout.pdf",
            storageProvider: "unknown",
            storageKey: "raw:materials/handout",
            mimeType: "application/pdf",
            size: 0
        }
    });

    await assert.rejects(
        missingFile.validate(),
        (error) => Boolean(error.errors.file)
    );
    await assert.rejects(
        invalidFile.validate(),
        (error) => Boolean(
            error.errors["file.storageProvider"] &&
            error.errors["file.size"]
        )
    );
});


test("defines a partial unique index for registered Cloudinary assets", () => {
    const assetIndex = CourseMaterial.schema.indexes().find(
        ([keys]) => keys["file.assetId"] === 1
    );

    assert.equal(assetIndex[1].unique, true);
    assert.deepEqual(assetIndex[1].partialFilterExpression, {
        "file.storageProvider": "cloudinary",
        "file.assetId": { $type: "string" }
    });
});
