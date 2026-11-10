import test from "node:test";
import assert from "node:assert/strict";

process.env.CLIENT_URL ||= "http://localhost:3000";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/ascendra_test";
process.env.JWT_ACCESS_SECRET ||= "test-access-secret-for-material-controller-behavior";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-for-material-controller-behavior";
process.env.CLOUDINARY_CLOUD_NAME ||= "test-cloud";
process.env.CLOUDINARY_API_KEY ||= "test-api-key";
process.env.CLOUDINARY_API_SECRET ||= "test-api-secret";

const { default: mongoose } = await import("mongoose");
const { v2: cloudinary } = await import("cloudinary");
const { default: Course } = await import(
    "../../../../src/modules/courses/course.model.js"
);
const { default: CourseMaterial } = await import(
    "../../../../src/modules/courseMaterials/courseMaterial.model.js"
);
const { default: CourseMaterialUploadIntent } = await import(
    "../../../../src/modules/courseMaterials/courseMaterialUploadIntent.model.js"
);
const {
    initiateCourseMaterialUploadHandler,
    confirmCourseMaterialUploadHandler,
    getCourseMaterialHandler,
    updateCourseMaterialHandler,
    archiveCourseMaterialHandler,
    getCourseMaterialAccessUrlHandler
} = await import("../../../../src/modules/courseMaterials/courseMaterial.controller.js");

const orgId = "507f1f77bcf86cd799439011";
const courseId = "507f1f77bcf86cd799439012";
const userId = "507f1f77bcf86cd799439013";
const materialId = "507f1f77bcf86cd799439014";
const publicId = "a41b1e23-41a3-4fe9-83a8-cc2a4d59097b.pdf";
const assetFolder = `ascendra/course-materials/${orgId}/${courseId}`;

const courseQuery = () => ({
    session() { return this; },
    populate() { return this; },
    lean: async () => ({
        _id: courseId,
        org: orgId,
        trainer: userId,
        status: "published"
    })
});

const dataQuery = (result) => ({
    session() { return this; },
    populate() { return this; },
    lean: async () => result
});

const invoke = (handler, req) => new Promise((resolve, reject) => {
    const res = {
        req: {},
        status(statusCode) {
            this.statusCode = statusCode;
            return this;
        },
        json(body) {
            resolve({ statusCode: this.statusCode, body });
            return this;
        }
    };
    handler(req, res, reject);
});

const requestBase = {
    user: { orgId, userId },
    organizationMembership: { role: "admin" },
    validated: { params: { courseId } }
};

const materialRecord = (overrides = {}) => ({
    _id: materialId,
    org: orgId,
    course: courseId,
    status: "active",
    title: "Course Handout",
    materialType: "pdf",
    file: {
        storageProvider: "cloudinary",
        storageKey: `raw:${publicId}`,
        mimeType: "application/pdf",
        size: 1024,
        format: "pdf"
    },
    ...overrides
});


test("initiates an upload and returns signed upload metadata", async (t) => {
    t.mock.method(Course, "findOne", courseQuery);
    t.mock.method(cloudinary.utils, "api_sign_request", () => "signed-upload");
    t.mock.method(CourseMaterialUploadIntent, "create", async ([data]) => [data]);

    const response = await invoke(initiateCourseMaterialUploadHandler, {
        ...requestBase,
        validated: {
            ...requestBase.validated,
            body: {
                originalName: "lesson.pdf",
                mimeType: "application/pdf",
                size: 1024
            }
        }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data.upload.signature, "signed-upload");
});


test("confirms a verified upload and responds with created material", async (t) => {
    t.mock.method(Course, "findOne", courseQuery);
    t.mock.method(CourseMaterialUploadIntent, "findOne", () => dataQuery({
        publicId,
        originalName: "lesson.pdf",
        mimeType: "application/pdf",
        size: 1024,
        resourceType: "raw"
    }));
    t.mock.method(cloudinary.api, "resource", async () => ({
        public_id: publicId,
        resource_type: "raw",
        type: "authenticated",
        asset_folder: assetFolder,
        bytes: 1024,
        asset_id: "asset-1",
        format: "pdf"
    }));
    t.mock.method(
        CourseMaterialUploadIntent,
        "findOneAndUpdate",
        () => dataQuery({ status: "consumed" })
    );
    t.mock.method(CourseMaterial, "create", async ([data]) => [data]);
    t.mock.method(mongoose, "startSession", async () => ({
        withTransaction: async (callback) => callback(),
        endSession: async () => {}
    }));

    const response = await invoke(confirmCourseMaterialUploadHandler, {
        ...requestBase,
        validated: {
            ...requestBase.validated,
            body: {
                publicId,
                resourceType: "raw",
                originalName: "lesson.pdf",
                mimeType: "application/pdf",
                size: 1024,
                title: "Lesson 1",
                materialType: "pdf"
            }
        }
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.data.title, "Lesson 1");
    assert.equal(response.body.data.file.storageKey, `raw:${publicId}`);
});


test("retrieves a material under the authorized course", async (t) => {
    t.mock.method(Course, "findOne", courseQuery);
    t.mock.method(CourseMaterial, "findOne", () => dataQuery(materialRecord()));

    const response = await invoke(getCourseMaterialHandler, {
        ...requestBase,
        validated: {
            params: { courseId, materialId }
        }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data.title, "Course Handout");
});


test("updates allowed material metadata through the controller", async (t) => {
    t.mock.method(Course, "findOne", courseQuery);
    t.mock.method(CourseMaterial, "findOne", () => dataQuery(materialRecord()));
    t.mock.method(CourseMaterial, "findOneAndUpdate", () => dataQuery(
        materialRecord({ title: "Updated handout" })
    ));

    const response = await invoke(updateCourseMaterialHandler, {
        ...requestBase,
        validated: {
            params: { courseId, materialId },
            body: { title: "Updated handout" }
        }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data.title, "Updated handout");
});


test("archives materials and generates authenticated access links", async (t) => {
    t.mock.method(Course, "findOne", courseQuery);
    t.mock.method(CourseMaterial, "findOneAndUpdate", () => dataQuery(
        materialRecord({ status: "archived" })
    ));
    const archived = await invoke(archiveCourseMaterialHandler, {
        ...requestBase,
        validated: { params: { courseId, materialId } }
    });
    assert.equal(archived.statusCode, 200);
    assert.equal(archived.body.data.status, "archived");

    t.mock.method(CourseMaterial, "findOne", () => dataQuery(materialRecord()));
    t.mock.method(
        cloudinary.utils,
        "private_download_url",
        () => "https://cloudinary.test/temporary"
    );
    const access = await invoke(getCourseMaterialAccessUrlHandler, {
        ...requestBase,
        validated: { params: { courseId, materialId } }
    });
    assert.equal(access.statusCode, 200);
    assert.match(access.body.data.access.url, /temporary/);
});
