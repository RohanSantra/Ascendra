import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import TrainingRequirement from "../../../../src/modules/trainingRequirements/trainingRequirement.model.js";
import {
    listTrainingRequirementsHandler
} from "../../../../src/modules/trainingRequirements/trainingRequirement.controller.js";
import {
    createTrainingRequirementHandler
} from "../../../../src/modules/trainingRequirements/trainingRequirement.controller.js";
import {
    getTrainingRequirementHandler,
    updateTrainingRequirementHandler,
    archiveTrainingRequirementHandler
} from "../../../../src/modules/trainingRequirements/trainingRequirement.controller.js";

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
    assert.deepEqual(errors, []);
    return { status, body };
};


test("training requirement controller returns organization-scoped results", async (t) => {
    const orgId = id();
    const adminId = id();
    const requirement = {
        _id: id(),
        org: orgId,
        title: "Facilitator",
        competencies: [],
        requiredSkills: [],
        qualificationKeywords: ["teaching"],
        requiredCertifications: [],
        status: "draft",
        createdBy: adminId,
        updatedBy: adminId
    };
    t.mock.method(TrainingRequirement, "find", () => query([requirement]));
    t.mock.method(TrainingRequirement, "countDocuments", () => Promise.resolve(1));

    const response = await invoke(listTrainingRequirementsHandler, {
        user: { orgId },
        validated: { query: { page: 1, limit: 5, status: "draft" } }
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data[0].title, "Facilitator");
    assert.deepEqual(response.body.meta.pagination, {
        page: 1,
        limit: 5,
        total: 1,
        totalPages: 1
    });
});


test("training requirement controller creates a draft with server-owned identifiers", async (t) => {
    const orgId = id();
    const adminId = id();
    const requirement = {
        _id: id(),
        org: orgId,
        title: "Facilitator",
        qualificationKeywords: ["teaching"],
        status: "draft",
        createdBy: adminId,
        updatedBy: adminId
    };
    t.mock.method(mongoose, "startSession", async () => session());
    t.mock.method(TrainingRequirement, "create", async () => [requirement]);

    const response = await invoke(createTrainingRequirementHandler, {
        user: { orgId, userId: adminId },
        validated: {
            body: { title: "Facilitator", qualificationKeywords: ["teaching"] }
        }
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.requirement.orgId, orgId);
    assert.equal(response.body.data.requirement.createdBy, adminId);
});

test("training requirement controller retrieves, updates, and archives a requirement", async (t) => {
    const orgId = id();
    const adminId = id();
    const requirementId = id();
    const requirement = {
        _id: requirementId,
        org: orgId,
        title: "Facilitator",
        competencies: [],
        requiredSkills: [],
        qualificationKeywords: ["teaching"],
        requiredCertifications: [],
        minimumExperienceYears: 0,
        minimumTeachingYears: 0,
        status: "draft",
        createdBy: adminId,
        updatedBy: adminId,
        save: async () => {}
    };
    t.mock.method(mongoose, "startSession", async () => session());
    t.mock.method(TrainingRequirement, "findOne", () => query(requirement));
    const req = {
        user: { orgId, userId: adminId },
        validated: { params: { id: requirementId }, body: { title: "Lead facilitator" } }
    };

    const read = await invoke(getTrainingRequirementHandler, req);
    const updated = await invoke(updateTrainingRequirementHandler, req);
    const archived = await invoke(archiveTrainingRequirementHandler, req);

    assert.equal(read.status, 200);
    assert.equal(read.body.data.requirement.title, "Facilitator");
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.requirement.title, "Lead facilitator");
    assert.equal(updated.body.data.requirement.updatedBy, adminId);
    assert.equal(archived.status, 200);
    assert.equal(archived.body.data.requirement.status, "archived");
});
