import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
    createFeedback,
    getFeedbackRecords
} from "../../../src/modules/feedback/feedback.repository.js";

import Feedback from "../../../src/modules/feedback/feedback.model.js";


test("creates feedback with the requested transaction session", async (t) => {
    const feedbackData = {
        org: new mongoose.Types.ObjectId(),
        rating: 5
    };
    const session = {};
    let captured;
    const created = { _id: new mongoose.Types.ObjectId() };

    t.mock.method(Feedback, "create", async (documents, options) => {
        captured = { documents, options };
        return [created];
    });

    assert.equal(
        await createFeedback(feedbackData, { session }),
        created
    );
    assert.deepEqual(captured, {
        documents: [feedbackData],
        options: { session }
    });
});


test("applies organization filters and falls back from unsafe feedback sorting", async (t) => {
    const orgId = new mongoose.Types.ObjectId();
    const captured = {};
    const query = {
        populate() {
            return this;
        },

        sort(value) {
            captured.sort = value;
            return this;
        },

        skip(value) {
            captured.skip = value;
            return this;
        },

        limit(value) {
            captured.limit = value;
            return this;
        },

        lean() {
            return Promise.resolve([]);
        }
    };

    t.mock.method(Feedback, "find", (filter) => {
        captured.filter = filter;
        return query;
    });
    t.mock.method(Feedback, "countDocuments", async (filter) => {
        assert.deepEqual(filter, captured.filter);
        return 3;
    });

    const result = await getFeedbackRecords({
        orgId,
        filters: {
            courseId: "course-1",
            trainerId: "trainer-1",
            traineeId: "trainee-1",
            status: "submitted"
        },
        pagination: {
            page: 2,
            limit: 1
        },
        sort: {
            sortBy: "password",
            sortOrder: "asc"
        }
    });

    assert.deepEqual(captured.filter, {
        org: orgId,
        course: "course-1",
        trainer: "trainer-1",
        trainee: "trainee-1",
        status: "submitted"
    });
    assert.deepEqual(captured.sort, { createdAt: 1, _id: 1 });
    assert.equal(captured.skip, 1);
    assert.equal(captured.limit, 1);
    assert.deepEqual(result.meta, {
        page: 2,
        limit: 1,
        total: 3,
        totalPages: 3
    });
});
