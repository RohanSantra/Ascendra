import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import MatchingConfig from "../../../../src/modules/matchingConfig/matchingConfig.model.js";
import {
    getActiveMatchingConfig
} from "../../../../src/modules/matchingConfig/matchingConfig.service.js";
import {
    listMatchingConfigVersions,
    createInitialMatchingConfig,
    createMatchingConfigVersion,
    activateMatchingConfigVersion
} from "../../../../src/modules/matchingConfig/matchingConfig.service.js";

const id = () => new mongoose.Types.ObjectId();


const createQuery = (result) => ({
    select() {
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

    populate() {
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
});


test("matching configuration service returns an organization-scoped active config", async (t) => {
    const orgId = id();
    const config = {
        _id: id(),
        org: orgId,
        version: 3,
        isActive: true,
        weights: {},
        thresholds: {},
        evidenceRules: {},
        proficiencyLevels: {},
        tieBreakOrder: [],
        defaultResultLimit: 10,
        algorithmVersion: "v1",
        createdBy: id(),
        updatedBy: null
    };
    let capturedFilter;
    t.mock.method(MatchingConfig, "findOne", (filter) => {
        capturedFilter = filter;
        return createQuery(config);
    });

    const result = await getActiveMatchingConfig({ orgId });

    assert.deepEqual(capturedFilter, { org: orgId, isActive: true });
    assert.equal(result.orgId, orgId.toString());
    assert.equal(result.version, 3);
});

test("matching configuration service reports a missing active configuration", async (t) => {
    t.mock.method(MatchingConfig, "findOne", () => createQuery(null));

    await assert.rejects(
        getActiveMatchingConfig({ orgId: id() }),
        { statusCode: 404, code: "RESOURCE_NOT_FOUND" }
    );
});

test("matching configuration versions are organization-scoped and paginated", async (t) => {
    const orgId = id();
    const config = new MatchingConfig({
        org: orgId,
        version: 4,
        isActive: false,
        createdBy: id()
    }).toObject();
    let capturedFilter;
    let capturedSkip;
    let capturedLimit;
    t.mock.method(MatchingConfig, "find", (filter) => {
        capturedFilter = filter;
        const result = createQuery([config]);
        const skip = result.skip;
        const limit = result.limit;
        result.skip = function (value) {
            capturedSkip = value;
            return skip.call(this, value);
        };
        result.limit = function (value) {
            capturedLimit = value;
            return limit.call(this, value);
        };
        return result;
    });
    t.mock.method(MatchingConfig, "countDocuments", async () => 5);

    const result = await listMatchingConfigVersions({
        orgId,
        page: 2,
        limit: 2
    });

    assert.deepEqual(capturedFilter, { org: orgId });
    assert.equal(capturedSkip, 2);
    assert.equal(capturedLimit, 2);
    assert.equal(result.configurations[0].version, 4);
    assert.deepEqual(result.pagination, {
        page: 2,
        limit: 2,
        total: 5,
        totalPages: 3
    });
});

test("initial configuration creation rejects duplicate setup and always closes its session", async (t) => {
    let ended = false;
    const testSession = {
        withTransaction: async (callback) => callback(),
        endSession: async () => {
            ended = true;
        }
    };
    t.mock.method(mongoose, "startSession", async () => testSession);
    t.mock.method(MatchingConfig, "findOne", () => createQuery({ version: 1 }));

    await assert.rejects(
        createInitialMatchingConfig({
            orgId: id(),
            adminId: id(),
            data: {}
        }),
        { statusCode: 409, code: "RESOURCE_CONFLICT" }
    );
    assert.equal(ended, true);
});

test("initial configuration validates input shape and rejects client-controlled fields", async (t) => {
    const testSession = {
        withTransaction: async (callback) => callback(),
        endSession: async () => {}
    };
    t.mock.method(mongoose, "startSession", async () => testSession);
    t.mock.method(MatchingConfig, "findOne", () => createQuery(null));

    for (const data of [null, [], { org: id() }]) {
        await assert.rejects(
            createInitialMatchingConfig({
                orgId: id(),
                adminId: id(),
                data
            }),
            { statusCode: 400, code: "VALIDATION_ERROR" }
        );
    }
});

test("initial configuration rejects inconsistent scoring and proficiency values", async (t) => {
    const testSession = {
        withTransaction: async (callback) => callback(),
        endSession: async () => {}
    };
    t.mock.method(mongoose, "startSession", async () => testSession);
    t.mock.method(MatchingConfig, "findOne", () => createQuery(null));

    await assert.rejects(
        createInitialMatchingConfig({
            orgId: id(),
            adminId: id(),
            data: {
                weights: {
                    competency: 0,
                    skills: 0,
                    qualification: 0,
                    experience: 0,
                    teaching: 0,
                    certification: 0
                }
            }
        }),
        { statusCode: 422, code: "VALIDATION_ERROR" }
    );
    await assert.rejects(
        createInitialMatchingConfig({
            orgId: id(),
            adminId: id(),
            data: { thresholds: { strong: 0.5, partial: 0.5 } }
        }),
        { statusCode: 422, code: "VALIDATION_ERROR" }
    );
    await assert.rejects(
        createInitialMatchingConfig({
            orgId: id(),
            adminId: id(),
            data: { proficiencyLevels: { beginner: 4 } }
        }),
        { statusCode: 422, code: "VALIDATION_ERROR" }
    );
});

test("matching configuration transaction converts duplicate database keys to conflicts", async (t) => {
    let ended = false;
    const testSession = {
        withTransaction: async (callback) => callback(),
        endSession: async () => {
            ended = true;
        }
    };
    t.mock.method(mongoose, "startSession", async () => testSession);
    t.mock.method(MatchingConfig, "findOne", () => createQuery(null));
    t.mock.method(MatchingConfig.prototype, "save", async () => {
        throw Object.assign(new Error("duplicate key"), { code: 11000 });
    });

    await assert.rejects(
        createInitialMatchingConfig({
            orgId: id(),
            adminId: id(),
            data: {}
        }),
        { statusCode: 409, code: "RESOURCE_CONFLICT" }
    );
    assert.equal(ended, true);
});

test("new matching configuration versions inherit defaults and remain inactive", async (t) => {
    const orgId = id();
    const adminId = id();
    const latest = new MatchingConfig({
        org: orgId,
        version: 5,
        isActive: true,
        createdBy: id(),
        algorithmVersion: "v5"
    }).toObject();
    const testSession = {
        withTransaction: async (callback) => callback(),
        endSession: async () => {}
    };
    t.mock.method(mongoose, "startSession", async () => testSession);
    t.mock.method(MatchingConfig, "findOne", () => createQuery(latest));
    t.mock.method(MatchingConfig.prototype, "save", async function () {
        return this;
    });

    const result = await createMatchingConfigVersion({
        orgId,
        adminId,
        data: { defaultResultLimit: 12 }
    });

    assert.equal(result.version, 6);
    assert.equal(result.isActive, false);
    assert.equal(result.defaultResultLimit, 12);
    assert.equal(result.algorithmVersion, "v5");
    assert.equal(result.createdBy.toString(), adminId.toString());
});

test("new matching configuration versions require an initial version", async (t) => {
    const testSession = {
        withTransaction: async (callback) => callback(),
        endSession: async () => {}
    };
    t.mock.method(mongoose, "startSession", async () => testSession);
    t.mock.method(MatchingConfig, "findOne", () => createQuery(null));

    await assert.rejects(
        createMatchingConfigVersion({
            orgId: id(),
            adminId: id(),
            data: {}
        }),
        { statusCode: 409, code: "RESOURCE_CONFLICT" }
    );
});

test("matching configuration activation is idempotent and updates the prior active version", async (t) => {
    const orgId = id();
    const adminId = id();
    const configId = id();
    const testSession = {
        withTransaction: async (callback) => callback(),
        endSession: async () => {}
    };
    t.mock.method(mongoose, "startSession", async () => testSession);
    let target = new MatchingConfig({
        _id: configId,
        org: orgId,
        version: 2,
        isActive: true,
        createdBy: adminId
    });
    t.mock.method(
        MatchingConfig,
        "findOne",
        () => createQuery(target)
    );
    const updateOne = t.mock.method(MatchingConfig, "updateOne", async () => {});
    const save = t.mock.method(MatchingConfig.prototype, "save", async function () {
        return this;
    });

    const unchanged = await activateMatchingConfigVersion({
        orgId,
        configId,
        adminId
    });
    assert.equal(unchanged.isActive, true);
    assert.equal(updateOne.mock.callCount(), 0);

    target = new MatchingConfig({
        _id: configId,
        org: orgId,
        version: 2,
        isActive: false,
        createdBy: adminId
    });

    const activated = await activateMatchingConfigVersion({
        orgId,
        configId,
        adminId
    });
    assert.equal(activated.isActive, true);
    assert.equal(activated.updatedBy.toString(), adminId.toString());
    assert.equal(updateOne.mock.callCount(), 1);
    assert.equal(save.mock.callCount(), 1);
    assert.deepEqual(updateOne.mock.calls[0].arguments[0], {
        org: orgId,
        isActive: true
    });
});

test("matching configuration activation rejects an unknown version", async (t) => {
    const testSession = {
        withTransaction: async (callback) => callback(),
        endSession: async () => {}
    };
    t.mock.method(mongoose, "startSession", async () => testSession);
    t.mock.method(MatchingConfig, "findOne", () => createQuery(null));

    await assert.rejects(
        activateMatchingConfigVersion({
            orgId: id(),
            configId: id(),
            adminId: id()
        }),
        { statusCode: 404, code: "RESOURCE_NOT_FOUND" }
    );
});
