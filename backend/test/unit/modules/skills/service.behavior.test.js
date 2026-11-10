import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Skill from "../../../../src/modules/skills/skill.model.js";
import Competency from "../../../../src/modules/competencies/competency.model.js";
import {
    createSkill
} from "../../../../src/modules/skills/skill.service.js";
import {
    listSkills,
    getSkillById,
    updateSkill,
    archiveSkill
} from "../../../../src/modules/skills/skill.service.js";
import {
    listSkillsHandler
} from "../../../../src/modules/skills/skill.controller.js";

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
        return this;
    },

    then(resolve, reject) {
        return Promise.resolve(result).then(resolve, reject);
    },

    exec() {
        return Promise.resolve(result);
    }
});


test("skill creation generates a slug and persists organization ownership", async (t) => {
    const orgId = id();
    const adminId = id();
    const skillId = id();
    let savedData;
    t.mock.method(Skill, "create", async (data) => {
        savedData = data;
        return {
            _id: skillId,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    });

    const result = await createSkill({
        orgId,
        adminId,
        data: { name: "  Conflict Resolution  ", competencies: [] }
    });

    assert.equal(savedData.slug, "conflict-resolution");
    assert.equal(savedData.org, orgId);
    assert.equal(savedData.createdBy, adminId);
    assert.equal(savedData.status, "active");
    assert.equal(result.id, skillId.toString());
});


test("skills controller responds with scoped list data and pagination", async (t) => {
    const orgId = id();
    const userId = id();
    const skill = {
        _id: id(),
        org: orgId,
        name: "Facilitation",
        slug: "facilitation",
        competencies: [],
        createdBy: userId,
        status: "active"
    };
    let filter;
    let responseBody;
    let responseStatus;
    t.mock.method(Skill, "find", (query) => {
        filter = query;
        return createQuery([skill]);
    });
    t.mock.method(Skill, "countDocuments", () => Promise.resolve(1));
    const response = {
        status(value) {
            responseStatus = value;
            return this;
        },
        json(value) {
            responseBody = value;
            return this;
        }
    };

    listSkillsHandler(
        {
            user: { orgId, userId },
            validated: { query: { page: 1, limit: 20, status: "active" } }
        },
        response,
        (error) => {
            throw error;
        }
    );
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(filter, { org: orgId, status: "active" });
    assert.equal(responseStatus, 200);
    assert.equal(responseBody.data[0].name, "Facilitation");
    assert.deepEqual(responseBody.meta.pagination, {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1
    });
});

test("skill listing combines escaped search and optional organization filters", async (t) => {
    const orgId = id();
    const competencyId = id();
    let capturedFilter;
    t.mock.method(Skill, "find", (filter) => {
        capturedFilter = filter;
        return createQuery([]);
    });
    t.mock.method(Skill, "countDocuments", async () => 0);

    const result = await listSkills({
        orgId,
        page: 2,
        limit: 5,
        status: "all",
        category: "leadership",
        competencyId,
        search: "a+b"
    });

    assert.deepEqual(capturedFilter, {
        org: orgId,
        category: "leadership",
        competencies: competencyId,
        $or: [
            { name: /a\+b/i },
            { slug: /a\+b/i },
            { description: /a\+b/i }
        ]
    });
    assert.deepEqual(result.pagination, {
        page: 2,
        limit: 5,
        total: 0,
        totalPages: 0
    });
});

test("skill lookup is organization-scoped and reports missing records", async (t) => {
    const skillId = id();
    const orgId = id();
    let filter;
    t.mock.method(Skill, "findOne", (query) => {
        filter = query;
        return createQuery(null);
    });

    await assert.rejects(
        getSkillById({ skillId, orgId }),
        { statusCode: 404, code: "RESOURCE_NOT_FOUND" }
    );
    assert.deepEqual(filter, { _id: skillId, org: orgId });
});

test("skill updates generate a slug, validate active competencies, and record the administrator", async (t) => {
    const orgId = id();
    const adminId = id();
    const skillId = id();
    const competencyId = id();
    const skill = {
        _id: skillId,
        org: orgId,
        name: "Old name",
        slug: "old-name",
        competencies: [],
        status: "active",
        createdBy: adminId,
        updatedBy: null,
        save: async function () {
            return this;
        }
    };
    t.mock.method(Skill, "findOne", async () => skill);
    t.mock.method(Competency, "find", () => createQuery([{ _id: competencyId }]));
    t.mock.method(Competency, "countDocuments", async () => 1);

    const result = await updateSkill({
        skillId,
        orgId,
        adminId,
        data: {
            name: "  Résumé Coaching ",
            description: "Helps educators develop coaching skills.",
            category: "professional",
            competencies: [competencyId]
        }
    });

    assert.equal(result.name, "  Résumé Coaching ");
    assert.equal(result.slug, "resume-coaching");
    assert.equal(result.description, "Helps educators develop coaching skills.");
    assert.deepEqual(result.competencies, [competencyId.toString()]);
    assert.equal(result.updatedBy, adminId.toString());
});

test("skill updates reject missing, archived, invalid-slug, and unavailable competency cases", async (t) => {
    const orgId = id();
    const skillId = id();
    const adminId = id();
    const activeSkill = {
        _id: skillId,
        org: orgId,
        name: "Existing",
        slug: "existing",
        competencies: [],
        status: "active",
        createdBy: adminId,
        updatedBy: null,
        save: async function () {
            return this;
        }
    };
    let storedSkill = null;
    t.mock.method(Skill, "findOne", async () => storedSkill);
    await assert.rejects(
        updateSkill({ skillId, orgId, adminId, data: { name: "New" } }),
        { statusCode: 404, code: "RESOURCE_NOT_FOUND" }
    );

    storedSkill = { ...activeSkill, status: "archived" };
    await assert.rejects(
        updateSkill({ skillId, orgId, adminId, data: { name: "New" } }),
        { statusCode: 409, code: "RESOURCE_CONFLICT" }
    );

    storedSkill = { ...activeSkill };
    await assert.rejects(
        updateSkill({ skillId, orgId, adminId, data: { slug: "!!!" } }),
        { statusCode: 400, code: "VALIDATION_ERROR" }
    );

    storedSkill = { ...activeSkill };
    const competencyId = id();
    t.mock.method(Competency, "find", () => createQuery([{ _id: competencyId }]));
    t.mock.method(Competency, "countDocuments", async () => 0);
    await assert.rejects(
        updateSkill({
            skillId,
            orgId,
            adminId,
            data: { competencies: [competencyId] }
        }),
        { statusCode: 409, code: "RESOURCE_CONFLICT" }
    );
});

test("skill creation rejects unusable slugs and translates duplicate-key conflicts", async (t) => {
    const orgId = id();
    const adminId = id();
    await assert.rejects(
        createSkill({
            orgId,
            adminId,
            data: { name: "!!!" }
        }),
        { statusCode: 400, code: "VALIDATION_ERROR" }
    );

    const duplicate = Object.assign(new Error("duplicate"), { code: 11000 });
    t.mock.method(Skill, "create", async () => {
        throw duplicate;
    });
    await assert.rejects(
        createSkill({
            orgId,
            adminId,
            data: { name: "Existing Skill" }
        }),
        { statusCode: 409, code: "RESOURCE_ALREADY_EXISTS" }
    );
});

test("skill archiving records the administrator and rejects missing or already archived records", async (t) => {
    const orgId = id();
    const skillId = id();
    const adminId = id();
    let skill = {
        _id: skillId,
        org: orgId,
        name: "Mentoring",
        slug: "mentoring",
        competencies: [],
        status: "active",
        createdBy: adminId,
        updatedBy: null,
        save: async function () {
            return this;
        }
    };
    t.mock.method(Skill, "findOne", async () => skill);

    const result = await archiveSkill({ skillId, orgId, adminId });
    assert.equal(result.status, "archived");
    assert.equal(result.updatedBy, adminId.toString());

    await assert.rejects(
        archiveSkill({ skillId, orgId, adminId }),
        { statusCode: 409, code: "RESOURCE_CONFLICT" }
    );
    skill = null;
    await assert.rejects(
        archiveSkill({ skillId, orgId, adminId }),
        { statusCode: 404, code: "RESOURCE_NOT_FOUND" }
    );
});
