import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import MatchingConfig from "../../../../src/modules/matchingConfig/matchingConfig.model.js";
import {
    getActiveMatchingConfigHandler
} from "../../../../src/modules/matchingConfig/matchingConfig.controller.js";
import {
    createInitialMatchingConfigHandler
} from "../../../../src/modules/matchingConfig/matchingConfig.controller.js";
import {
    listMatchingConfigVersionsHandler,
    createMatchingConfigVersionHandler,
    activateMatchingConfigVersionHandler
} from "../../../../src/modules/matchingConfig/matchingConfig.controller.js";

const id = () => new mongoose.Types.ObjectId();


const query = (value) => ({
    select() {
        return this;
    },
    populate() {
        return this;
    },
    sort() {
        return this;
    },
    skip() {
        return this;
    },
    limit() {
        return this;
    },
    session() {
        return this;
    },
    lean() {
        return Promise.resolve(value);
    },
    then(resolve, reject) {
        return Promise.resolve(value).then(resolve, reject);
    }
});


const session = () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {}
});


const invoke = async (handler, req) => {
    let status;
    let body;
    const errors = [];
    const res = {
        req: {},
        status(value) {
            status = value;
            return this;
        },
        json(value) {
            body = value;
            return this;
        }
    };

    handler(req, res, (error) => errors.push(error));
    await new Promise((resolve) => setImmediate(resolve));
    return { status, body, errors };
};


test("matching configuration controller returns active settings", async (t) => {
    const orgId = id();
    const config = {
        _id: id(),
        org: orgId,
        version: 1,
        isActive: true,
        weights: {},
        thresholds: {},
        evidenceRules: {},
        proficiencyLevels: {},
        tieBreakOrder: [],
        defaultResultLimit: 10,
        algorithmVersion: "v1",
        createdBy: id()
    };
    t.mock.method(MatchingConfig, "findOne", () => query(config));

    const response = await invoke(getActiveMatchingConfigHandler, {
        user: { orgId }
    });


    assert.equal(response.status, 200);
    assert.equal(response.body.data.matchingConfig.version, 1);
    assert.equal(response.body.data.matchingConfig.orgId, orgId.toString());
});


test("initial matching configuration controller creates and activates version one", async (t) => {
    const orgId = id();
    const adminId = id();
    t.mock.method(mongoose, "startSession", async () => session());
    t.mock.method(MatchingConfig, "findOne", () => query(null));
    t.mock.method(MatchingConfig.prototype, "save", async function () {
        return this;
    });

    const response = await invoke(createInitialMatchingConfigHandler, {
        user: { orgId, userId: adminId },
        validated: { body: { defaultResultLimit: 12 } }
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.matchingConfig.version, 1);
    assert.equal(response.body.data.matchingConfig.isActive, true);
    assert.equal(response.body.data.matchingConfig.defaultResultLimit, 12);
});

test("matching configuration controllers list, version, and activate organization settings", async (t) => {
    const orgId = id();
    const adminId = id();
    const current = new MatchingConfig({
        org: orgId,
        version: 1,
        isActive: true,
        createdBy: adminId
    });
    const testSession = session();
    t.mock.method(mongoose, "startSession", async () => testSession);
    t.mock.method(MatchingConfig, "find", () => query([current.toObject()]));
    t.mock.method(MatchingConfig, "countDocuments", async () => 1);

    const listResponse = await invoke(listMatchingConfigVersionsHandler, {
        user: { orgId },
        validated: { query: { page: 1, limit: 10 } }
    });
    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.body.data.configurations[0].version, 1);

    let configResult = current.toObject();
    t.mock.method(MatchingConfig, "findOne", () => query(configResult));
    t.mock.method(MatchingConfig.prototype, "save", async function () {
        return this;
    });
    const versionResponse = await invoke(createMatchingConfigVersionHandler, {
        user: { orgId, userId: adminId },
        validated: { body: { defaultResultLimit: 15 } }
    });
    assert.equal(versionResponse.status, 201);
    assert.equal(versionResponse.body.data.matchingConfig.version, 2);
    assert.equal(versionResponse.body.data.matchingConfig.defaultResultLimit, 15);

    const target = new MatchingConfig({
        org: orgId,
        version: 2,
        isActive: false,
        createdBy: adminId
    });
    configResult = target;
    t.mock.method(MatchingConfig, "updateOne", async () => ({}));
    const activationResponse = await invoke(activateMatchingConfigVersionHandler, {
        user: { orgId, userId: adminId },
        validated: { params: { id: target._id } }
    });
    assert.equal(activationResponse.status, 200);
    assert.equal(activationResponse.body.data.matchingConfig.isActive, true);
    assert.deepEqual(activationResponse.errors, []);
});

test("matching configuration controller forwards service errors", async (t) => {
    t.mock.method(MatchingConfig, "findOne", () => query(null));

    const response = await invoke(getActiveMatchingConfigHandler, {
        user: { orgId: id() }
    });

    assert.equal(response.status, undefined);
    assert.equal(response.errors[0].statusCode, 404);
    assert.equal(response.errors[0].code, "RESOURCE_NOT_FOUND");
});
