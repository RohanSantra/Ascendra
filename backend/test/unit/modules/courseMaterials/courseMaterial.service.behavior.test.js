import test from "node:test";
import assert from "node:assert/strict";

process.env.CLIENT_URL ||= "http://localhost:3000";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/ascendra_test";
process.env.JWT_ACCESS_SECRET ||= "test-access-secret-for-material-service";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-for-material-service";
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
const { default: OrganizationMembership } = await import(
    "../../../../src/modules/organizationMemberships/organizationMembership.model.js"
);
const { default: Enrollment } = await import(
    "../../../../src/modules/enrollments/enrollment.model.js"
);
const {
    initiateCourseMaterialUpload,
    confirmCourseMaterialUpload,
    getCourseMaterial,
    listCourseMaterials,
    editCourseMaterial,
    archiveCourseMaterialRecord,
    getCourseMaterialAccessUrl
} = await import("../../../../src/modules/courseMaterials/courseMaterial.service.js");

const orgId = "507f1f77bcf86cd799439011";
const courseId = "507f1f77bcf86cd799439012";
const userId = "507f1f77bcf86cd799439013";
const materialId = "507f1f77bcf86cd799439014";
const publicId = "a41b1e23-41a3-4fe9-83a8-cc2a4d59097b.pdf";

const query = (result) => ({
    session() { return this; },
    populate() { return this; },
    lean() { return Promise.resolve(result); }
});

const authorizedCourse = () => {
    const course = {
        _id: courseId,
        org: orgId,
        trainer: userId,
        status: "published"
    };
    return {
        session() { return this; },
        populate() { return this; },
        lean() { return Promise.resolve(course); }
    };
};

const material = (overrides = {}) => ({
    _id: materialId,
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

const accessOptions = {
    orgId,
    courseId,
    userId,
    role: "admin"
};


test("initiates an upload, persisting a bound intent and normalized PDF metadata", async (t) => {
    t.mock.method(Course, "findOne", () => authorizedCourse());
    t.mock.method(cloudinary.utils, "api_sign_request", () => "signed-upload");
    let capturedIntent;
    t.mock.method(CourseMaterialUploadIntent, "create", async ([data]) => {
        capturedIntent = data;
        return [data];
    });

    const result = await initiateCourseMaterialUpload({
        ...accessOptions,
        originalName: "  lesson.pdf  ",
        mimeType: "application/pdf",
        size: 2048
    });

    assert.equal(result.upload.signature, "signed-upload");
    assert.equal(result.file.originalName, "lesson.pdf");
    assert.equal(result.file.materialType, "pdf");
    assert.equal(capturedIntent.originalName, "lesson.pdf");
    assert.equal(capturedIntent.status, "pending");
    assert.equal(capturedIntent.expiresAt.getTime() > Date.now(), true);
});


test("rejects trainee upload initiation after successful course access", async (t) => {
    t.mock.method(Course, "findOne", () => authorizedCourse());
    t.mock.method(OrganizationMembership, "findOne", () => ({
        lean: async () => ({ status: "approved" })
    }));
    t.mock.method(Enrollment, "findOne", () => ({
        lean: async () => ({ status: "enrolled" })
    }));

    await assert.rejects(
        () => initiateCourseMaterialUpload({
            ...accessOptions,
            role: "trainee",
            originalName: "lesson.pdf",
            mimeType: "application/pdf",
            size: 1024
        }),
        (error) => error.statusCode === 403
    );
});


test("confirms a pending upload transactionally and persists verified metadata", async (t) => {
    t.mock.method(Course, "findOne", () => authorizedCourse());
    const intent = {
        publicId,
        originalName: "lesson.pdf",
        mimeType: "application/pdf",
        size: 1024,
        resourceType: "raw"
    };
    t.mock.method(CourseMaterialUploadIntent, "findOne", () => query(intent));
    t.mock.method(cloudinary.api, "resource", async () => ({
        public_id: publicId,
        resource_type: "raw",
        type: "authenticated",
        asset_folder: `ascendra/course-materials/${orgId}/${courseId}`,
        bytes: 1024,
        asset_id: "asset-1",
        format: "pdf"
    }));

    const consumed = { status: "consumed" };
    t.mock.method(CourseMaterialUploadIntent, "findOneAndUpdate", () => query(consumed));
    let insertedData;
    t.mock.method(CourseMaterial, "create", async ([data]) => {
        insertedData = data;
        return [data];
    });
    const session = {
        async withTransaction(callback) {
            await callback();
        },
        async endSession() {
            this.ended = true;
        }
    };
    t.mock.method(mongoose, "startSession", async () => session);

    const result = await confirmCourseMaterialUpload({
        ...accessOptions,
        publicId,
        resourceType: "raw",
        originalName: "lesson.pdf",
        mimeType: "application/pdf",
        size: 1024,
        title: "  Lesson 1  ",
        description: "  Intro  ",
        materialType: "pdf",
        displayOrder: 2
    });

    assert.equal(result, insertedData);
    assert.equal(insertedData.title, "Lesson 1");
    assert.equal(insertedData.description, "Intro");
    assert.equal(insertedData.file.storageKey, `raw:${publicId}`);
    assert.equal(insertedData.status, "active");
    assert.equal(session.ended, true);
});


test("rejects confirmation when the upload intent metadata does not match", async (t) => {
    t.mock.method(Course, "findOne", () => authorizedCourse());
    t.mock.method(CourseMaterialUploadIntent, "findOne", () => query({
        publicId,
        originalName: "lesson.pdf",
        mimeType: "application/pdf",
        size: 1024,
        resourceType: "raw"
    }));

    await assert.rejects(
        () => confirmCourseMaterialUpload({
            ...accessOptions,
            publicId,
            resourceType: "raw",
            originalName: "lesson.pdf",
            mimeType: "application/pdf",
            size: 1025,
            title: "Lesson 1",
            materialType: "pdf"
        }),
        (error) => error.statusCode === 400 &&
            error.message.includes("metadata does not match")
    );
});


test("retrieves active course materials and rejects archived trainee access", async (t) => {
    t.mock.method(Course, "findOne", () => authorizedCourse());
    let materialResult = material();
    t.mock.method(CourseMaterial, "findOne", () => query(materialResult));
    t.mock.method(OrganizationMembership, "findOne", () => ({
        lean: async () => ({ status: "approved" })
    }));
    t.mock.method(Enrollment, "findOne", () => ({
        lean: async () => ({ status: "enrolled" })
    }));

    assert.equal(
        await getCourseMaterial({
            ...accessOptions,
            materialId
        }).then((result) => result._id),
        materialId
    );

    materialResult = material({
        status: "archived"
    });
    await assert.rejects(
        () => getCourseMaterial({
            ...accessOptions,
            role: "trainee",
            materialId
        }),
        (error) => error.statusCode === 404
    );
});


test("forces active-only material listings for trainees", async (t) => {
    t.mock.method(Course, "findOne", () => authorizedCourse());
    t.mock.method(OrganizationMembership, "findOne", () => ({
        lean: async () => ({ status: "approved" })
    }));
    t.mock.method(Enrollment, "findOne", () => ({
        lean: async () => ({ status: "enrolled" })
    }));
    let captured;
    t.mock.method(CourseMaterial, "find", (filter) => {
        captured = filter;
        return {
            sort() { return this; },
            skip() { return this; },
            limit() { return this; },
            populate() { return this; },
            lean: async () => []
        };
    });
    t.mock.method(CourseMaterial, "countDocuments", async () => 0);

    const result = await listCourseMaterials({
        ...accessOptions,
        role: "trainee",
        status: "archived",
        page: 2,
        limit: 5,
        sortBy: "title"
    });

    assert.deepEqual(captured, {
        org: orgId,
        course: courseId,
        status: "active"
    });
    assert.equal(result.meta.page, 2);
});


test("edits only editable active material fields and archives without deleting files", async (t) => {
    t.mock.method(Course, "findOne", () => authorizedCourse());
    t.mock.method(CourseMaterial, "findOne", () => query(material()));
    let capturedUpdate;
    t.mock.method(CourseMaterial, "findOneAndUpdate", (filter, update) => {
        capturedUpdate = { filter, update };
        return query({ ...material(), title: "Updated" });
    });
    const updated = await editCourseMaterial({
        ...accessOptions,
        materialId,
        updates: {
            title: "Updated",
            file: { storageKey: "untrusted" },
            status: "archived"
        }
    });

    assert.equal(updated.title, "Updated");
    assert.deepEqual(capturedUpdate.update, { $set: { title: "Updated" } });

    let archiveUpdate;
    t.mock.method(CourseMaterial, "findOneAndUpdate", (_filter, update) => {
        archiveUpdate = update;
        return query({ ...material(), status: "archived" });
    });
    const archived = await archiveCourseMaterialRecord({
        ...accessOptions,
        materialId
    });
    assert.equal(archived.status, "archived");
    assert.deepEqual(archiveUpdate, { $set: { status: "archived" } });
});


test("creates a temporary URL only for active Cloudinary materials", async (t) => {
    t.mock.method(Course, "findOne", () => authorizedCourse());
    t.mock.method(CourseMaterial, "findOne", () => query(material()));
    t.mock.method(cloudinary.utils, "private_download_url", () => "https://signed.test/file");

    const result = await getCourseMaterialAccessUrl({
        ...accessOptions,
        materialId
    });

    assert.equal(result.material.id, materialId);
    assert.equal(result.material.mimeType, "application/pdf");
    assert.match(result.access.url, /signed\.test/);
});


test("rejects URL generation for non-Cloudinary material storage", async (t) => {
    t.mock.method(Course, "findOne", () => authorizedCourse());
    t.mock.method(CourseMaterial, "findOne", () => query(material({
        file: { storageProvider: "s3", storageKey: "bucket/key" }
    })));

    await assert.rejects(
        () => getCourseMaterialAccessUrl({
            ...accessOptions,
            materialId
        }),
        (error) => error.statusCode === 400
    );
});
