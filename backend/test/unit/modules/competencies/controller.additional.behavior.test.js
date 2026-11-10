import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Competency from "../../../../src/modules/competencies/competency.model.js";
import {
    archiveCompetencyHandler,
    getCompetencyHandler,
    updateCompetencyHandler
} from "../../../../src/modules/competencies/competency.controller.js";

const id = () => new mongoose.Types.ObjectId();

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

test("competency detail, update, and archive handlers return successful responses", async (t) => {
    const orgId = id();
    const competencyId = id();
    const adminId = id();
    const competency = {
        _id: competencyId,
        org: orgId,
        name: "Communication",
        slug: "communication",
        status: "active",
        createdBy: adminId,
        save: async () => {}
    };
    let lookups = 0;
    t.mock.method(Competency, "findOne", () => {
        lookups += 1;
        if (lookups === 1) {
            return { lean: async () => competency };
        }

        return competency;
    });

    const detail = await invoke(getCompetencyHandler, {
        user: { orgId },
        validated: { params: { id: competencyId } }
    });
    assert.deepEqual(detail.errors, []);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.id, competencyId.toString());

    const update = await invoke(updateCompetencyHandler, {
        user: { orgId, userId: adminId },
        validated: {
            params: { id: competencyId },
            body: { description: "Clear communication" }
        }
    });
    assert.deepEqual(update.errors, []);
    assert.equal(update.status, 200);
    assert.equal(update.body.data.name, competency.name);

    const archive = await invoke(archiveCompetencyHandler, {
        user: { orgId, userId: adminId },
        validated: { params: { id: competencyId } }
    });
    assert.deepEqual(archive.errors, []);
    assert.equal(archive.status, 200);
    assert.equal(archive.body.data.status, "archived");
});

test("competency handler forwards service failures to Express error middleware", async (t) => {
    const failure = new Error("database unavailable");
    t.mock.method(Competency, "findOne", () => ({
        lean: async () => { throw failure; }
    }));

    const response = await invoke(getCompetencyHandler, {
        user: { orgId: id() },
        validated: { params: { id: id() } }
    });

    assert.deepEqual(response.errors, [failure]);
    assert.equal(response.status, undefined);
    assert.equal(response.body, undefined);
});
