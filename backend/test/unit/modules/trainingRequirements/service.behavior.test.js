import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import TrainingRequirement from "../../../../src/modules/trainingRequirements/trainingRequirement.model.js";
import Competency from "../../../../src/modules/competencies/competency.model.js";
import Skill from "../../../../src/modules/skills/skill.model.js";
import {
    createTrainingRequirement
} from "../../../../src/modules/trainingRequirements/trainingRequirement.service.js";
import {
    listTrainingRequirements,
    getTrainingRequirementById,
    updateTrainingRequirement,
    archiveTrainingRequirement
} from "../../../../src/modules/trainingRequirements/trainingRequirement.service.js";

const id = () => new mongoose.Types.ObjectId();

const query = (value) => ({
    select() { return this; },
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    session() { return this; },
    lean() { return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
});

const transactionSession = () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {}
});

test("training requirement service rejects missing criteria within its transaction", async (t) => {
    let transactionCount = 0;
    t.mock.method(mongoose, "startSession", async () => ({
        withTransaction: async (callback) => {
            transactionCount += 1;
            return callback();
        },
        endSession: async () => {}
    }));

    await assert.rejects(
        () => createTrainingRequirement({
            orgId: id(),
            adminId: id(),
            data: { title: "Trainer request" }
        }),
        /At least one trainer requirement must be provided/
    );
    assert.equal(transactionCount, 1);
});

test("training requirement service creates and lists organization-scoped records", async (t) => {
    const orgId = id();
    const adminId = id();
    const requirementId = id();
    const created = {
        _id: requirementId, org: orgId, title: "Facilitator",
        qualificationKeywords: ["teaching"], status: "draft",
        createdBy: adminId, updatedBy: adminId,
        toObject() {
            return {
                _id: this._id, org: this.org, title: this.title,
                qualificationKeywords: this.qualificationKeywords,
                status: this.status, createdBy: this.createdBy,
                updatedBy: this.updatedBy
            };
        }
    };
    t.mock.method(mongoose, "startSession", async () => transactionSession());
    t.mock.method(TrainingRequirement, "create", async ([data]) => {
        assert.deepEqual(data, {
            title: "Facilitator", qualificationKeywords: ["teaching"],
            org: orgId, status: "draft", createdBy: adminId, updatedBy: adminId
        });
        return [created];
    });

    const createdResult = await createTrainingRequirement({
        orgId, adminId, data: { title: "Facilitator", qualificationKeywords: ["teaching"] }
    });
    assert.equal(createdResult.id, requirementId);
    assert.equal(createdResult.orgId, orgId);

    let capturedFilter;
    t.mock.method(TrainingRequirement, "find", (filter) => {
        capturedFilter = filter;
        return query([created]);
    });
    t.mock.method(TrainingRequirement, "countDocuments", async () => 1);
    const listed = await listTrainingRequirements({
        orgId, page: 1, limit: 5, status: "draft", search: "C++ (intro)"
    });
    assert.deepEqual(capturedFilter, {
        org: orgId,
        status: "draft",
        $or: [
            { title: { $regex: "C\\+\\+ \\(intro\\)", $options: "i" } },
            { description: { $regex: "C\\+\\+ \\(intro\\)", $options: "i" } }
        ]
    });
    assert.equal(listed.requirements[0].title, "Facilitator");
    assert.deepEqual(listed.pagination, { page: 1, limit: 5, total: 1, totalPages: 1 });
});

test("training requirement service gets, updates, and archives editable records", async (t) => {
    const orgId = id();
    const adminId = id();
    const requirementId = id();
    const competencyId = id();
    const skillId = id();
    const requirement = {
        _id: requirementId, org: orgId, title: "Facilitator",
        competencies: [{ competency: competencyId }],
        requiredSkills: [{ skill: skillId }],
        qualificationKeywords: ["teaching"],
        requiredCertifications: [], minimumExperienceYears: 2,
        minimumTeachingYears: 1, status: "draft", save: async () => {}
    };
    t.mock.method(mongoose, "startSession", async () => transactionSession());
    t.mock.method(TrainingRequirement, "findOne", () => query(requirement));
    t.mock.method(Competency, "find", () => query([{ _id: competencyId }]));
    t.mock.method(Skill, "find", () => query([{ _id: skillId }]));

    const found = await getTrainingRequirementById({ requirementId, orgId });
    assert.equal(found.id, requirementId);
    const updated = await updateTrainingRequirement({
        requirementId, orgId, adminId, data: { title: "Lead facilitator" }
    });
    assert.equal(updated.title, "Lead facilitator");
    assert.equal(updated.updatedBy, adminId);
    assert.equal(updated.minimumExperienceYears, 2);

    const archived = await archiveTrainingRequirement({ requirementId, orgId, adminId });
    assert.equal(archived.status, "archived");
    assert.equal(archived.updatedBy, adminId);
});

test("training requirement service rejects missing, locked, assigned, and already archived records", async (t) => {
    const orgId = id();
    const adminId = id();
    const requirementId = id();
    t.mock.method(mongoose, "startSession", async () => transactionSession());
    let current = null;
    t.mock.method(TrainingRequirement, "findOne", () => query(current));

    await assert.rejects(
        () => getTrainingRequirementById({ requirementId, orgId }),
        (error) => error.statusCode === 404 && error.code === "NOT_FOUND"
    );
    await assert.rejects(
        () => updateTrainingRequirement({ requirementId, orgId, adminId, data: { title: "New" } }),
        (error) => error.statusCode === 404
    );
    await assert.rejects(
        () => updateTrainingRequirement({
            requirementId, orgId, adminId, data: { status: "matched" }
        }),
        (error) => error.statusCode === 400 && error.code === "VALIDATION_ERROR"
    );

    current = {
        _id: requirementId, org: orgId, status: "matched",
        qualificationKeywords: ["teaching"], save: async () => {}
    };
    await assert.rejects(
        () => updateTrainingRequirement({ requirementId, orgId, adminId, data: { title: "New" } }),
        (error) => error.code === "CONFLICT"
    );

    current.status = "assigned";
    await assert.rejects(
        () => archiveTrainingRequirement({ requirementId, orgId, adminId }),
        (error) => error.code === "CONFLICT"
    );
    current.status = "archived";
    await assert.rejects(
        () => archiveTrainingRequirement({ requirementId, orgId, adminId }),
        (error) => error.code === "CONFLICT"
    );
});
