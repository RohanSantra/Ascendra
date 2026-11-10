import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Skill from "../../../../src/modules/skills/skill.model.js";
import Competency from "../../../../src/modules/competencies/competency.model.js";
import {
    listCompetenciesHandler
} from "../../../../src/modules/competencies/competency.controller.js";
import {
    createCompetencyHandler
} from "../../../../src/modules/competencies/competency.controller.js";
import {
    createSkillHandler
} from "../../../../src/modules/skills/skill.controller.js";

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
    assert.deepEqual(errors, []);
    return { status, body };
};


test("competency controller returns serialized list and navigation metadata", async (t) => {
    const orgId = id();
    const adminId = id();
    const competency = {
        _id: id(),
        org: orgId,
        name: "Communication",
        slug: "communication",
        createdBy: adminId,
        status: "active"
    };
    t.mock.method(Competency, "find", () => query([competency]));
    t.mock.method(Competency, "countDocuments", () => Promise.resolve(2));

    const response = await invoke(listCompetenciesHandler, {
        user: { orgId },
        validated: { query: { page: 1, limit: 1 } }
    });


    assert.equal(response.status, 200);
    assert.equal(response.body.data[0].name, "Communication");
    assert.deepEqual(response.body.meta.pagination, {
        page: 1,
        limit: 1,
        total: 2,
        totalPages: 2,
        hasNextPage: true,
        hasPreviousPage: false
    });
});


test("competency and skill controllers create resources for the current organization", async (t) => {
    const orgId = id();
    const adminId = id();
    const competency = {
        _id: id(),
        org: orgId,
        name: "Communication",
        slug: "communication",
        status: "active",
        createdBy: adminId
    };
    t.mock.method(Competency, "create", async (data) => ({
        ...competency,
        ...data
    }));

    const competencyResponse = await invoke(createCompetencyHandler, {
        user: { orgId, userId: adminId },
        validated: { body: { name: "Communication" } }
    });

    assert.equal(competencyResponse.status, 201);
    assert.equal(competencyResponse.body.data.org, orgId.toString());

    const skill = {
        _id: id(),
        org: orgId,
        name: "Facilitation",
        slug: "facilitation",
        competencies: [],
        status: "active",
        createdBy: adminId
    };
    t.mock.method(Skill, "create", async (data) => ({
        ...skill,
        ...data
    }));

    const skillResponse = await invoke(createSkillHandler, {
        user: { orgId, userId: adminId },
        validated: { body: { name: "Facilitation" } }
    });

    assert.equal(skillResponse.status, 201);
    assert.equal(skillResponse.body.data.org, orgId.toString());
});
