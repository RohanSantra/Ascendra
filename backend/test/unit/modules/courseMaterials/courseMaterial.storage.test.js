import test from "node:test";
import assert from "node:assert/strict";
import { v2 as cloudinary } from "cloudinary";

process.env.CLOUDINARY_CLOUD_NAME ||= "test-cloud";
process.env.CLOUDINARY_API_KEY ||= "test-api-key";
process.env.CLOUDINARY_API_SECRET ||= "test-api-secret";

const {
    MAX_COURSE_MATERIAL_SIZE,
    validateCourseMaterialFile,
    createCourseMaterialUploadSignature,
    verifyCourseMaterialUpload,
    createCourseMaterialAccessUrl,
    deleteCourseMaterialFile
} = await import(
    "../../../../src/modules/courseMaterials/courseMaterial.storage.js"
);


const orgId = "507f1f77bcf86cd799439011";
const courseId = "507f1f77bcf86cd799439012";
const publicId = "a41b1e23-41a3-4fe9-83a8-cc2a4d59097b.pdf";
const assetFolder = `ascendra/course-materials/${orgId}/${courseId}`;


test("validates supported file extension, MIME pairing and size limits", () => {
    assert.deepEqual(
        validateCourseMaterialFile(
            "lesson.pdf",
            "application/pdf",
            MAX_COURSE_MATERIAL_SIZE
        ),
        {
            extension: ".pdf",
            mimeType: "application/pdf",
            resourceType: "raw"
        }
    );
    assert.throws(
        () => validateCourseMaterialFile(
            "lesson.pdf",
            "video/mp4",
            12
        ),
        (error) => error.statusCode === 400
    );
    assert.throws(
        () => validateCourseMaterialFile(
            "lesson.pdf",
            "application/pdf",
            MAX_COURSE_MATERIAL_SIZE + 1
        ),
        (error) => error.statusCode === 400
    );
});


test("creates a signed authenticated upload request with server-bound Cloudinary parameters", (t) => {
    let captured;
    t.mock.method(cloudinary.utils, "api_sign_request", (params, secret) => {
        captured = { params, secret };
        return "signed-value";
    });

    const result = createCourseMaterialUploadSignature({
        orgId,
        courseId,
        originalName: "lesson.pdf",
        mimeType: "application/pdf",
        size: 1024
    });

    assert.equal(result.cloudName, "test-cloud");
    assert.equal(result.apiKey, "test-api-key");
    assert.equal(result.signature, "signed-value");
    assert.equal(result.assetFolder, assetFolder);
    assert.equal(result.resourceType, "raw");
    assert.equal(result.deliveryType, "authenticated");
    assert.equal(result.maxFileSize, MAX_COURSE_MATERIAL_SIZE);
    assert.match(result.publicId, /^[a-f\d-]{36}\.pdf$/i);
    assert.deepEqual(captured.params, {
        asset_folder: assetFolder,
        public_id: result.publicId,
        timestamp: result.timestamp,
        type: "authenticated",
        overwrite: false,
        unique_filename: false
    });
    assert.equal(captured.secret, "test-api-secret");
    assert.equal(cloudinary.config().secure, true);
});


test("verifies Cloudinary resource ownership and returns trusted storage metadata", async (t) => {
    let captured;
    const resource = {
        public_id: publicId,
        resource_type: "raw",
        type: "authenticated",
        asset_folder: assetFolder,
        bytes: 2048,
        asset_id: "asset-123",
        format: "pdf"
    };
    t.mock.method(cloudinary.api, "resource", async (id, options) => {
        captured = { id, options };
        return resource;
    });

    const result = await verifyCourseMaterialUpload({
        publicId,
        resourceType: "raw",
        orgId,
        courseId,
        expectedSize: 2048,
        mimeType: "application/pdf",
        originalName: "lesson.pdf"
    });

    assert.deepEqual(captured, {
        id: publicId,
        options: { resource_type: "raw", type: "authenticated" }
    });
    assert.deepEqual(result, {
        originalName: "lesson.pdf",
        storageProvider: "cloudinary",
        storageKey: `raw:${publicId}`,
        assetId: "asset-123",
        resourceType: "raw",
        mimeType: "application/pdf",
        size: 2048,
        checksum: null,
        format: "pdf"
    });
});


test("maps missing Cloudinary uploads to a not-found application error", async (t) => {
    t.mock.method(cloudinary.api, "resource", async () => {
        throw { http_code: 404 };
    });

    await assert.rejects(
        () => verifyCourseMaterialUpload({
            publicId,
            resourceType: "raw",
            orgId,
            courseId,
            expectedSize: 2048,
            mimeType: "application/pdf",
            originalName: "lesson.pdf"
        }),
        (error) => error.statusCode === 404 &&
            error.code === "RESOURCE_NOT_FOUND"
    );
});


test("rejects a Cloudinary resource that does not match the authorized size", async (t) => {
    t.mock.method(cloudinary.api, "resource", async () => ({
        public_id: publicId,
        resource_type: "raw",
        type: "authenticated",
        asset_folder: assetFolder,
        bytes: 2049
    }));

    await assert.rejects(
        () => verifyCourseMaterialUpload({
            publicId,
            resourceType: "raw",
            orgId,
            courseId,
            expectedSize: 2048,
            mimeType: "application/pdf",
            originalName: "lesson.pdf"
        }),
        (error) => error.statusCode === 400 &&
            error.message.includes("size does not match")
    );
});


test("generates authenticated short-lived access URLs for raw materials", (t) => {
    let captured;
    t.mock.method(
        cloudinary.utils,
        "private_download_url",
        (...args) => {
            captured = args;
            return "https://cloudinary.test/private-download";
        }
    );

    const result = createCourseMaterialAccessUrl({
        storageKey: `raw:${publicId}`,
        format: "pdf"
    });

    assert.equal(result.url, "https://cloudinary.test/private-download");
    assert.ok(result.expiresAt instanceof Date);
    assert.deepEqual(captured, [
        publicId,
        undefined,
        {
            resource_type: "raw",
            type: "authenticated",
            expires_at: Math.floor(result.expiresAt.getTime() / 1000)
        }
    ]);
});


test("deletes only UUID-scoped authenticated storage resources", async (t) => {
    let captured;
    t.mock.method(cloudinary.uploader, "destroy", async (...args) => {
        captured = args;
        return { result: "ok" };
    });

    const result = await deleteCourseMaterialFile(`raw:${publicId}`);

    assert.deepEqual(result, { result: "ok" });
    assert.deepEqual(captured, [
        publicId,
        {
            resource_type: "raw",
            type: "authenticated",
            invalidate: true
        }
    ]);

    await assert.rejects(
        () => deleteCourseMaterialFile("raw:arbitrary/public-id.pdf"),
        (error) => error.statusCode === 400
    );
});
