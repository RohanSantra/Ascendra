import test, {
    before,
    after,
    beforeEach
} from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
    startTestDatabase,
    clearTestDatabase,
    stopTestDatabase
} from "../../helpers/database.js";

import MatchRun from "../../../src/modules/matchRun/matchRun.model.js";
import {
    executeTrainerMatchingHandler
} from "../../../src/modules/matching/matching.controller.js";
import {
    getMatchingHistoryHandler,
    getMatchingRunDetailsHandler
} from "../../../src/modules/matching/matchingHistory.controller.js";

let organizationId;
let requirementId;
let adminId;
let matchRun;

const invoke = (handler, request) =>
    new Promise((resolve) => {
        const response = {
            req: { requestId: "matching-history-request" },
            statusCode: null,
            body: null,
            status(statusCode) {
                this.statusCode = statusCode;
                return this;
            },
            json(body) {
                this.body = body;
                resolve({ response: this, forwardedError: undefined });
                return this;
            }
        };

        handler(request, response, (forwardedError) => {
            resolve({ response, forwardedError });
        });
    });

before(async () => {
    await startTestDatabase();
});

after(async () => {
    await stopTestDatabase();
});

beforeEach(async () => {
    await clearTestDatabase();

    organizationId = new mongoose.Types.ObjectId();
    requirementId = new mongoose.Types.ObjectId();
    adminId = new mongoose.Types.ObjectId();

    matchRun = await MatchRun.create({
        org: organizationId,
        requirement: requirementId,
        requirementSnapshot: { title: "Test requirement" },
        configSnapshot: { algorithmVersion: "1.0.0" },
        algorithmVersion: "1.0.0",
        outcome: "none_suitable",
        executedBy: adminId
    });

    await MatchRun.create({
        org: new mongoose.Types.ObjectId(),
        requirement: new mongoose.Types.ObjectId(),
        requirementSnapshot: { title: "Another organization" },
        configSnapshot: { algorithmVersion: "1.0.0" },
        algorithmVersion: "1.0.0",
        outcome: "none_suitable",
        executedBy: adminId
    });
});

test("returns paginated matching history scoped to the current organization", async () => {
    const { response, forwardedError } = await invoke(
        getMatchingHistoryHandler,
        {
            user: { orgId: organizationId.toString() },
            validated: { query: { page: 1, limit: 10 } }
        }
    );

    assert.equal(forwardedError, undefined, forwardedError?.stack);
    assert.equal(response.statusCode, 200);
    assert.equal(
        response.body.message,
        "Matching history retrieved successfully."
    );
    assert.equal(response.body.data.matchRuns.length, 1);
    assert.equal(
        response.body.data.matchRuns[0]._id.toString(),
        matchRun._id.toString()
    );
    assert.equal(response.body.meta.pagination.total, 1);
    assert.equal(response.body.meta.pagination.page, 1);
});

test("returns organization-owned matching run details", async () => {
    const { response, forwardedError } = await invoke(
        getMatchingRunDetailsHandler,
        {
            user: { orgId: organizationId.toString() },
            validated: {
                params: { id: matchRun._id.toString() }
            }
        }
    );

    assert.equal(forwardedError, undefined, forwardedError?.stack);
    assert.equal(response.statusCode, 200);
    assert.equal(
        response.body.data.matchRun._id.toString(),
        matchRun._id.toString()
    );
});

test("returns not-found for a matching run owned by another organization", async () => {
    const { response, forwardedError } = await invoke(
        getMatchingRunDetailsHandler,
        {
            user: { orgId: organizationId.toString() },
            validated: {
                params: { id: new mongoose.Types.ObjectId().toString() }
            }
        }
    );

    assert.equal(forwardedError.statusCode, 404);
    assert.equal(forwardedError.code, "RESOURCE_NOT_FOUND");
    assert.equal(response.body, null);
});

test("forwards matching execution validation errors to Express", async () => {
    const { response, forwardedError } = await invoke(
        executeTrainerMatchingHandler,
        {
            user: {
                orgId: organizationId.toString(),
                userId: adminId.toString()
            },
            validated: { params: {} }
        }
    );

    assert.equal(forwardedError.statusCode, 400);
    assert.equal(forwardedError.code, "VALIDATION_ERROR");
    assert.equal(response.body, null);
});
