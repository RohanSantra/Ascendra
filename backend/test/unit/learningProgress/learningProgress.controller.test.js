import test from "node:test";
import assert from "node:assert/strict";

import {
    getLearningProgressController,
    updateMaterialProgressController,
    listLearningProgressController,
    getCourseLearningProgressSummaryController
} from "../../../src/modules/learningProgress/learningProgress.controller.js";

import Course from "../../../src/modules/courses/course.model.js";
import CourseMaterial from "../../../src/modules/courseMaterials/courseMaterial.model.js";
import Enrollment from "../../../src/modules/enrollments/enrollment.model.js";
import LearningProgress from "../../../src/modules/learningProgress/learningProgress.model.js";
import OrganizationMembership from "../../../src/modules/organizationMemberships/organizationMembership.model.js";


const invoke = (handler, req) => new Promise((resolve) => {
    const res = {
        status(statusCode) {
            this.statusCode = statusCode;
            return this;
        },

        json(body) {
            resolve({ statusCode: this.statusCode, body });
            return this;
        }
    };

    handler(req, res, (error) => resolve({ error }));
});


const createQuery = (result) => ({
    session() { return this; },
    populate() { return this; },
    lean() { return Promise.resolve(result); }
});


test("returns successful responses for material progress and its course summary", async (t) => {
    const orgId = "507f1f77bcf86cd799439011";
    const courseId = "507f1f77bcf86cd799439012";
    const materialId = "507f1f77bcf86cd799439013";
    const userId = "507f1f77bcf86cd799439014";
    const materialIds = [materialId, "507f1f77bcf86cd799439015"];
    const updateCalls = [];

    t.mock.method(
        Course,
        "findOne",
        () => createQuery({ _id: courseId, status: "published" })
    );
    t.mock.method(
        OrganizationMembership,
        "findOne",
        () => createQuery({ status: "approved" })
    );
    t.mock.method(
        Enrollment,
        "findOne",
        () => createQuery({
            _id: "507f1f77bcf86cd799439016",
            status: "in_progress"
        })
    );
    t.mock.method(
        CourseMaterial,
        "findOne",
        () => createQuery({ _id: materialId, status: "active" })
    );
    t.mock.method(CourseMaterial, "distinct", () => ({
        session() { return Promise.resolve(materialIds); }
    }));
    t.mock.method(
        LearningProgress,
        "findOne",
        () => createQuery(null)
    );
    t.mock.method(
        LearningProgress,
        "findOneAndUpdate",
        (filter, update) => {
            updateCalls.push({ filter, update });
            return createQuery({
                status: update.$setOnInsert
                    ? "not_started"
                    : update.$set.status
            });
        }
    );
    t.mock.method(LearningProgress, "countDocuments", (filter) => ({
        session() {
            return Promise.resolve(
                filter.status === "completed" ? 1 : 0
            );
        }
    }));

    const req = {
        user: { orgId, userId },
        organizationMembership: { role: "trainee" },
        validated: {
            params: { courseId, materialId },
            body: { status: "completed" }
        }
    };

    const retrieved = await invoke(getLearningProgressController, req);
    const updated = await invoke(updateMaterialProgressController, req);
    const summary = await invoke(getCourseLearningProgressSummaryController, req);

    assert.equal(retrieved.statusCode, 200);
    assert.equal(retrieved.body.data.status, "not_started");
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.body.data.status, "completed");
    assert.equal(summary.statusCode, 200);
    assert.deepEqual(summary.body.data, {
        totalMaterials: 2,
        completedMaterials: 1,
        inProgressMaterials: 0,
        notStartedMaterials: 1,
        completionPercentage: 50
    });
    assert.equal(updateCalls.length, 3);
});


test("returns course progress records and metadata from the list handler", async (t) => {
    const records = [{ status: "completed" }];
    const courseQuery = {
        session() { return this; },
        populate() { return this; },
        lean() { return Promise.resolve({ _id: "course-id" }); }
    };
    const progressQuery = {
        sort() { return this; },
        skip() { return this; },
        limit() { return this; },
        session() { return this; },
        lean() { return Promise.resolve(records); }
    };

    t.mock.method(Course, "findOne", () => courseQuery);
    t.mock.method(LearningProgress, "find", () => progressQuery);
    t.mock.method(LearningProgress, "countDocuments", () => ({
        session() {
            return Promise.resolve(1);
        }
    }));

    const result = await invoke(listLearningProgressController, {
        user: {
            orgId: "507f1f77bcf86cd799439011",
            userId: "507f1f77bcf86cd799439012"
        },
        organizationMembership: { role: "admin" },
        validated: {
            params: { courseId: "507f1f77bcf86cd799439013" },
            query: {
                traineeId: undefined,
                status: undefined,
                page: 1,
                limit: 20,
                sortBy: "updatedAt",
                sortOrder: "desc"
            }
        }
    });

    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body.data, records);
    assert.deepEqual(result.body.meta, {
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1
    });
});


test("forwards authorization errors from individual progress handlers", async () => {
    const request = {
        user: {
            orgId: "507f1f77bcf86cd799439011",
            userId: "507f1f77bcf86cd799439012"
        },
        organizationMembership: { role: "trainer" },
        validated: {
            params: {
                courseId: "507f1f77bcf86cd799439013",
                materialId: "507f1f77bcf86cd799439014"
            },
            body: { status: "completed" },
            query: {
                traineeId: undefined,
                status: undefined,
                page: 1,
                limit: 20,
                sortBy: "updatedAt",
                sortOrder: "desc"
            }
        }
    };

    const results = await Promise.all([
        invoke(getLearningProgressController, request),
        invoke(updateMaterialProgressController, request),
        invoke(getCourseLearningProgressSummaryController, request)
    ]);

    for (const result of results) {
        assert.ok(result.error);
        assert.equal(result.error.statusCode, 403);
    }
});
