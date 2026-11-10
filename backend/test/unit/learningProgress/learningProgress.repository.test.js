import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
    getOrCreateLearningProgress,
    getLearningProgressRecords,
    getLearningProgressSummary,
    updateLearningProgress
} from "../../../src/modules/learningProgress/learningProgress.repository.js";

import LearningProgress from "../../../src/modules/learningProgress/learningProgress.model.js";
import CourseMaterial from "../../../src/modules/courseMaterials/courseMaterial.model.js";


const createQuery = (result) => ({
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

    session(value) {
        this.sessionValue = value;
        return this;
    },

    lean() {
        return Promise.resolve(result);
    }
});


const createCountQuery = (result) => ({
    session() {
        return this;
    },

    then(resolve, reject) {
        return Promise.resolve(result).then(resolve, reject);
    }
});


test("upserts progress by unique trainee and material keys with safe defaults", async (t) => {
    const progressData = {
        org: new mongoose.Types.ObjectId(),
        course: new mongoose.Types.ObjectId(),
        trainee: new mongoose.Types.ObjectId(),
        material: new mongoose.Types.ObjectId(),
        status: "not_started"
    };
    const session = {};
    let updateCall;

    t.mock.method(
        LearningProgress,
        "findOneAndUpdate",
        (filter, update, options) => {
            updateCall = { filter, update, options };
            return createQuery({ ...progressData });
        }
    );

    await getOrCreateLearningProgress(
        { progressData },
        { session }
    );

    assert.deepEqual(updateCall.filter, {
        org: progressData.org,
        course: progressData.course,
        trainee: progressData.trainee,
        material: progressData.material
    });
    assert.deepEqual(updateCall.update, {
        $setOnInsert: progressData
    });
    assert.deepEqual(updateCall.options, {
        returnDocument: "after",
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
        session
    });
});


test("lists progress with scoped filters, pagination, sorting and metadata", async (t) => {
    const orgId = new mongoose.Types.ObjectId();
    const courseId = new mongoose.Types.ObjectId();
    const traineeId = new mongoose.Types.ObjectId();
    const records = [{ status: "completed" }];
    let capturedFilter;
    let capturedQuery;

    t.mock.method(LearningProgress, "find", (filter) => {
        capturedFilter = filter;
        capturedQuery = createQuery(records);
        return capturedQuery;
    });
    t.mock.method(
        LearningProgress,
        "countDocuments",
        (filter) => {
            assert.deepEqual(filter, capturedFilter);
            return createCountQuery(5);
        }
    );

    const result = await getLearningProgressRecords({
        orgId,
        courseId,
        filters: {
            traineeId,
            status: "completed"
        },
        pagination: {
            page: 2,
            limit: 2
        },
        sort: {
            sortBy: "unsafeField",
            sortOrder: "asc"
        }
    });

    assert.deepEqual(capturedFilter, {
        org: orgId,
        course: courseId,
        trainee: traineeId,
        status: "completed"
    });
    assert.deepEqual(capturedQuery.sortValue, { updatedAt: 1 });
    assert.equal(capturedQuery.skipValue, 2);
    assert.equal(capturedQuery.limitValue, 2);
    assert.deepEqual(result, {
        data: records,
        meta: {
            total: 5,
            page: 2,
            limit: 2,
            totalPages: 3
        }
    });
});


test("summarizes only active materials and counts missing progress as not started", async (t) => {
    const orgId = new mongoose.Types.ObjectId();
    const courseId = new mongoose.Types.ObjectId();
    const traineeId = new mongoose.Types.ObjectId();
    const materialIds = [
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId()
    ];
    const filters = [];
    let distinctFilter;

    t.mock.method(CourseMaterial, "distinct", (field, filter) => {
        assert.equal(field, "_id");
        distinctFilter = filter;
        return {
            session() {
                return Promise.resolve(materialIds);
            }
        };
    });
    t.mock.method(LearningProgress, "countDocuments", (filter) => {
        filters.push(filter);
        return createCountQuery(
            filter.status === "completed" ? 1 : 2
        );
    });

    const summary = await getLearningProgressSummary({
        orgId,
        courseId,
        traineeId
    });

    assert.deepEqual(distinctFilter, {
        org: orgId,
        course: courseId,
        status: "active"
    });
    assert.equal(filters.length, 2);
    assert.deepEqual(filters[0].material, { $in: materialIds });
    assert.deepEqual(summary, {
        totalMaterials: 4,
        completedMaterials: 1,
        inProgressMaterials: 2,
        notStartedMaterials: 1,
        completionPercentage: 25
    });
});


test("does not update completed progress records", async (t) => {
    let capturedFilter;

    t.mock.method(
        LearningProgress,
        "findOneAndUpdate",
        (filter) => {
            capturedFilter = filter;
            return createQuery(null);
        }
    );

    await updateLearningProgress({
        orgId: new mongoose.Types.ObjectId(),
        courseId: new mongoose.Types.ObjectId(),
        traineeId: new mongoose.Types.ObjectId(),
        materialId: new mongoose.Types.ObjectId(),
        updates: { status: "in_progress" }
    });

    assert.deepEqual(capturedFilter.status, { $ne: "completed" });
});
