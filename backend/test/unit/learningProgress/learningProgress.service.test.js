import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
    getLearningProgress,
    updateMaterialProgress
} from "../../../src/modules/learningProgress/learningProgress.service.js";

import {
    updateLearningProgressSchema,
    listLearningProgressQuerySchema
} from "../../../src/modules/learningProgress/learningProgress.validation.js";

import Course from "../../../src/modules/courses/course.model.js";
import CourseMaterial from "../../../src/modules/courseMaterials/courseMaterial.model.js";
import Enrollment from "../../../src/modules/enrollments/enrollment.model.js";
import LearningProgress from "../../../src/modules/learningProgress/learningProgress.model.js";
import OrganizationMembership from "../../../src/modules/organizationMemberships/organizationMembership.model.js";

import {
    ERROR_CODES,
    HTTP_STATUS
} from "../../../src/core/constants/index.js";


const createQuery = (result) => ({
    session() {
        return this;
    },

    populate() {
        return this;
    },

    lean() {
        return Promise.resolve(result);
    }
});


test("denies non-trainees access to individual learning progress", async () => {
    await assert.rejects(
        () => getLearningProgress({
            orgId: new mongoose.Types.ObjectId(),
            courseId: new mongoose.Types.ObjectId(),
            materialId: new mongoose.Types.ObjectId(),
            userId: new mongoose.Types.ObjectId(),
            role: "trainer"
        }),
        (error) => {
            assert.equal(error.statusCode, HTTP_STATUS.FORBIDDEN);
            assert.equal(error.code, ERROR_CODES.RESOURCE_ACCESS_DENIED);
            return true;
        }
    );
});


test("starts and completes material progress with lifecycle timestamps", async (t) => {
    const orgId = new mongoose.Types.ObjectId();
    const courseId = new mongoose.Types.ObjectId();
    const materialId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const enrollment = { _id: new mongoose.Types.ObjectId() };
    const updates = [];
    let existingProgress = null;

    t.mock.method(
        Course,
        "findOne",
        () => createQuery({ _id: courseId, status: "published" })
    );
    t.mock.method(
        OrganizationMembership,
        "findOne",
        () => createQuery({ role: "trainee", status: "approved" })
    );
    t.mock.method(
        CourseMaterial,
        "findOne",
        () => createQuery({ _id: materialId, status: "active" })
    );
    t.mock.method(Enrollment, "findOne", () =>
        createQuery({ ...enrollment, status: "in_progress" })
    );
    t.mock.method(
        LearningProgress,
        "findOne",
        () => createQuery(existingProgress)
    );
    t.mock.method(
        LearningProgress,
        "findOneAndUpdate",
        (filter, update) => {
            updates.push({ filter, update });
            return createQuery({ status: update.$setOnInsert
                ? "not_started"
                : update.$set.status });
        }
    );

    const started = await updateMaterialProgress({
        orgId,
        courseId,
        materialId,
        userId,
        role: "trainee",
        status: "in_progress"
    });

    assert.equal(started.status, "in_progress");
    assert.ok(updates[1].update.$set.startedAt instanceof Date);
    assert.ok(updates[1].update.$set.lastAccessedAt instanceof Date);

    updates.length = 0;
    existingProgress = {
        status: "in_progress",
        startedAt: new Date("2025-01-01")
    };

    const completed = await updateMaterialProgress({
        orgId,
        courseId,
        materialId,
        userId,
        role: "trainee",
        status: "completed"
    });

    assert.equal(completed.status, "completed");
    assert.equal(
        updates[1].update.$set.startedAt.getTime(),
        new Date("2025-01-01").getTime()
    );
    assert.ok(updates[1].update.$set.completedAt instanceof Date);
});


test("preserves completed progress and reports failed non-racing updates", async (t) => {
    const orgId = new mongoose.Types.ObjectId();
    const courseId = new mongoose.Types.ObjectId();
    const materialId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const existing = { status: "completed" };
    let currentProgress = existing;
    let currentUpdate = null;

    t.mock.method(
        Course,
        "findOne",
        () => createQuery({ _id: courseId, status: "published" })
    );
    t.mock.method(
        OrganizationMembership,
        "findOne",
        () => createQuery({ role: "trainee", status: "approved" })
    );
    t.mock.method(
        CourseMaterial,
        "findOne",
        () => createQuery({ _id: materialId, status: "active" })
    );
    t.mock.method(Enrollment, "findOne", () =>
        createQuery({ _id: new mongoose.Types.ObjectId(), status: "completed" })
    );
    const findProgress = t.mock.method(
        LearningProgress,
        "findOne",
        () => createQuery(currentProgress)
    );
    const updateProgress = t.mock.method(
        LearningProgress,
        "findOneAndUpdate",
        () => createQuery(currentUpdate)
    );

    assert.equal(
        await updateMaterialProgress({
            orgId,
            courseId,
            materialId,
            userId,
            role: "trainee",
            status: "in_progress"
        }),
        existing
    );
    assert.equal(findProgress.mock.callCount(), 1);
    assert.equal(updateProgress.mock.callCount(), 0);

    currentProgress = null;
    currentUpdate = null;

    await assert.rejects(
        () => updateMaterialProgress({
            orgId,
            courseId,
            materialId,
            userId,
            role: "trainee",
            status: "completed"
        }),
        {
            code: ERROR_CODES.RESOURCE_CONFLICT,
            statusCode: HTTP_STATUS.CONFLICT
        }
    );
});


test("rejects attempts to set backend-managed not_started status", async () => {
    await assert.rejects(
        () => updateMaterialProgress({
            orgId: new mongoose.Types.ObjectId(),
            courseId: new mongoose.Types.ObjectId(),
            materialId: new mongoose.Types.ObjectId(),
            userId: new mongoose.Types.ObjectId(),
            role: "trainee",
            status: "not_started"
        }),
        (error) => {
            assert.equal(error.statusCode, HTTP_STATUS.BAD_REQUEST);
            assert.equal(error.code, ERROR_CODES.VALIDATION_ERROR);
            return true;
        }
    );

    assert.equal(
        updateLearningProgressSchema.safeParse({
            params: {
                courseId: "507f1f77bcf86cd799439011",
                materialId: "507f1f77bcf86cd799439012"
            },
            body: { status: "not_started" }
        }).success,
        false
    );
});


test("coerces listing pagination and uses current progress sort defaults", () => {
    const result = listLearningProgressQuerySchema.parse({
        params: {
            courseId: "507f1f77bcf86cd799439011"
        },
        query: {
            page: "3",
            limit: "8"
        }
    });

    assert.deepEqual(result.query, {
        page: 3,
        limit: 8,
        sortBy: "updatedAt",
        sortOrder: "desc"
    });
});
