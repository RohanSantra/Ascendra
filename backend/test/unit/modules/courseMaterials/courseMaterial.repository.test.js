import test from "node:test";
import assert from "node:assert/strict";

import CourseMaterial from "../../../../src/modules/courseMaterials/courseMaterial.model.js";
import CourseMaterialUploadIntent from "../../../../src/modules/courseMaterials/courseMaterialUploadIntent.model.js";
import {
    getCourseMaterials,
    archiveCourseMaterial
} from "../../../../src/modules/courseMaterials/courseMaterial.repository.js";
import {
    getPendingCourseMaterialUploadIntent,
    consumeCourseMaterialUploadIntent
} from "../../../../src/modules/courseMaterials/courseMaterialUploadIntent.repository.js";


const createQuery = (result) => ({
    session(value) {
        this.sessionValue = value;
        return this;
    },
    populate() {
        return this;
    },
    sort(value) {
        this.sortValue = value;
        return this;
    },
    skip(value) {
        this.skipValue = value;
        return this;
    },
    limit(value) {
        this.limitValue = value;
        return this;
    },
    lean() {
        return Promise.resolve(result);
    }
});


test("lists active materials by default and clamps pagination with a safe sort", async (t) => {
    let capturedFilter;
    let query;
    t.mock.method(CourseMaterial, "find", (filter) => {
        capturedFilter = filter;
        query = createQuery([{ _id: "material-1" }]);
        return query;
    });
    t.mock.method(CourseMaterial, "countDocuments", async () => 205);

    const result = await getCourseMaterials({
        orgId: "org-1",
        courseId: "course-1",
        pagination: { page: 2, limit: 200 },
        sort: { sortBy: "unexpected", sortOrder: "desc" }
    });

    assert.deepEqual(capturedFilter, {
        org: "org-1",
        course: "course-1",
        status: "active"
    });
    assert.deepEqual(query.sortValue, { displayOrder: -1, _id: 1 });
    assert.equal(query.skipValue, 100);
    assert.equal(query.limitValue, 100);
    assert.deepEqual(result.meta, {
        page: 2,
        limit: 100,
        total: 205,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true
    });
});


test("archives an active material without deleting its external asset", async (t) => {
    let captured;
    const archived = { status: "archived" };
    t.mock.method(CourseMaterial, "findOneAndUpdate", (...args) => {
        captured = args;
        return createQuery(archived);
    });

    const result = await archiveCourseMaterial({
        orgId: "org-1",
        courseId: "course-1",
        materialId: "material-1"
    });

    assert.equal(result, archived);
    assert.deepEqual(captured[0], {
        _id: "material-1",
        org: "org-1",
        course: "course-1",
        status: "active"
    });
    assert.deepEqual(captured[1], { $set: { status: "archived" } });
});


test("only retrieves unexpired pending upload intents within the full owner scope", async (t) => {
    let capturedFilter;
    let query;
    t.mock.method(CourseMaterialUploadIntent, "findOne", (filter) => {
        capturedFilter = filter;
        query = createQuery({ publicId: "upload-1" });
        return query;
    });

    await getPendingCourseMaterialUploadIntent({
        orgId: "org-1",
        courseId: "course-1",
        userId: "user-1",
        publicId: "upload-1"
    }, { session: "db-session" });

    assert.deepEqual(capturedFilter, {
        org: "org-1",
        course: "course-1",
        uploadedBy: "user-1",
        publicId: "upload-1",
        status: "pending",
        expiresAt: capturedFilter.expiresAt
    });
    assert.ok(capturedFilter.expiresAt.$gt instanceof Date);
    assert.equal(query.sessionValue, "db-session");
});


test("atomically consumes an unexpired pending upload intent", async (t) => {
    let captured;
    const intent = { status: "consumed" };
    t.mock.method(CourseMaterialUploadIntent, "findOneAndUpdate", (...args) => {
        captured = args;
        return createQuery(intent);
    });

    const result = await consumeCourseMaterialUploadIntent({
        orgId: "org-1",
        courseId: "course-1",
        userId: "user-1",
        publicId: "upload-1"
    });

    assert.equal(result, intent);
    assert.deepEqual(captured[0], {
        org: "org-1",
        course: "course-1",
        uploadedBy: "user-1",
        publicId: "upload-1",
        status: "pending",
        expiresAt: captured[0].expiresAt
    });
    assert.ok(captured[0].expiresAt.$gt instanceof Date);
    assert.equal(captured[1].$set.status, "consumed");
    assert.equal(captured[1].$set.consumedAt, captured[0].expiresAt.$gt);
});
