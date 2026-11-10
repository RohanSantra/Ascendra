import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Skill from "../../../../src/modules/skills/skill.model.js";
import {
    createSkillHandler,
    getSkillHandler,
    updateSkillHandler,
    archiveSkillHandler
} from "../../../../src/modules/skills/skill.controller.js";

const query = (value) => ({
    lean() {
        return Promise.resolve(value);
    },
    then(resolve, reject) {
        return Promise.resolve(value).then(resolve, reject);
    }
});

const invoke = async (handler, req) => {
    let status;
    let body;
    const errors = [];
    const res = {
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

const createSkillDocument = (orgId, adminId) => ({
    _id: new mongoose.Types.ObjectId(),
    org: orgId,
    name: "Coaching",
    slug: "coaching",
    competencies: [],
    status: "active",
    createdBy: adminId,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    save: async function () {
        return this;
    }
});

test("skill controllers create, retrieve, update, and archive organization skills", async (t) => {
    const orgId = new mongoose.Types.ObjectId();
    const adminId = new mongoose.Types.ObjectId();
    const skillId = new mongoose.Types.ObjectId();

    t.mock.method(Skill, "create", async (data) => ({
        ...createSkillDocument(orgId, adminId),
        ...data,
        _id: skillId
    }));
    const created = await invoke(createSkillHandler, {
        user: { orgId, userId: adminId },
        validated: { body: { name: "Coaching" } }
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.slug, "coaching");

    const skill = createSkillDocument(orgId, adminId);
    skill._id = skillId;
    t.mock.method(Skill, "findOne", (filter) => {
        assert.deepEqual(filter, { _id: skillId, org: orgId });
        return query(skill);
    });
    const retrieved = await invoke(getSkillHandler, {
        user: { orgId },
        validated: { params: { id: skillId } }
    });
    assert.equal(retrieved.status, 200);
    assert.equal(retrieved.body.data.id, skillId.toString());

    const updated = await invoke(updateSkillHandler, {
        user: { orgId, userId: adminId },
        validated: {
            params: { id: skillId },
            body: { name: "Advanced Coaching" }
        }
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.slug, "advanced-coaching");
    assert.equal(updated.body.data.updatedBy, adminId.toString());

    const archived = await invoke(archiveSkillHandler, {
        user: { orgId, userId: adminId },
        validated: { params: { id: skillId } }
    });
    assert.equal(archived.status, 200);
    assert.equal(archived.body.data.status, "archived");
    assert.deepEqual(archived.errors, []);
});

test("skill controller forwards service errors to Express", async (t) => {
    t.mock.method(Skill, "findOne", () => query(null));

    const response = await invoke(getSkillHandler, {
        user: { orgId: new mongoose.Types.ObjectId() },
        validated: { params: { id: new mongoose.Types.ObjectId() } }
    });

    assert.equal(response.status, undefined);
    assert.equal(response.errors[0].statusCode, 404);
    assert.equal(response.errors[0].code, "RESOURCE_NOT_FOUND");
});
