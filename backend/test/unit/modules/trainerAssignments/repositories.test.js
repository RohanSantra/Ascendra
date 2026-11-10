import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import TrainerAssignment from "../../../../src/modules/trainerAssignments/trainerAssignment.model.js";
import {
    getTrainerAssignments
} from "../../../../src/modules/trainerAssignments/trainerAssignment.repository.js";

const createQuery = (result) => {
    const query = {
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

        session() {
            return this;
        },

        lean() {
            return Promise.resolve(result);
        },

        then(resolve, reject) {
            return Promise.resolve(result).then(resolve, reject);
        }
    };

    return query;
};


test("trainer assignment repository applies organization filters and returns pagination metadata", async (t) => {
    const orgId = new mongoose.Types.ObjectId();
    const requirementId = new mongoose.Types.ObjectId();
    const assignment = { _id: new mongoose.Types.ObjectId() };
    let capturedFilter;
    let capturedCountFilter;
    let capturedSkip;
    let capturedLimit;

    t.mock.method(TrainerAssignment, "find", (filter) => {
        capturedFilter = filter;
        const query = createQuery([assignment]);
        const skip = query.skip;
        const limit = query.limit;
        query.skip = function (value) {
            capturedSkip = value;
            return skip.call(this, value);
        };
        query.limit = function (value) {
            capturedLimit = value;
            return limit.call(this, value);
        };
        return query;
    });

    t.mock.method(TrainerAssignment, "countDocuments", (filter) => {
        capturedCountFilter = filter;
        return Promise.resolve(6);
    });

    const result = await getTrainerAssignments({
        orgId,
        page: 2,
        limit: 2,
        status: "assigned",
        requirementId
    });

    assert.deepEqual(capturedFilter, {
        org: orgId,
        status: "assigned",
        requirement: requirementId
    });
    assert.deepEqual(capturedCountFilter, capturedFilter);
    assert.equal(capturedSkip, 2);
    assert.equal(capturedLimit, 2);
    assert.deepEqual(result, {
        assignments: [assignment],
        pagination: { page: 2, limit: 2, total: 6, totalPages: 3 }
    });
});
