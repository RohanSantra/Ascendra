import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import TrainingRequirement from "../../../../src/modules/trainingRequirements/trainingRequirement.model.js";
import MatchingConfig from "../../../../src/modules/matchingConfig/matchingConfig.model.js";
import OrganizationMembership from "../../../../src/modules/organizationMemberships/organizationMembership.model.js";
import MatchRun from "../../../../src/modules/matchRun/matchRun.model.js";
import { executeTrainerMatchingHandler } from "../../../../src/modules/matching/matching.controller.js";

const query = (value) => ({
    select() {
        return this;
    },
    sort() {
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

test("matching controller executes matching and returns the created run", async (t) => {
    const orgId = new mongoose.Types.ObjectId();
    const requirementId = new mongoose.Types.ObjectId();
    const adminId = new mongoose.Types.ObjectId();
    const requirement = {
        _id: requirementId,
        competencies: [],
        requiredSkills: [],
        qualificationKeywords: [],
        qualificationMustHave: false,
        requiredCertifications: [],
        minimumExperienceYears: 0,
        minimumTeachingYears: 0
    };
    const config = {
        weights: {
            competency: 1,
            skills: 0,
            qualification: 0,
            experience: 0,
            teaching: 0,
            certification: 0
        },
        thresholds: { strong: 0.8, partial: 0.5 },
        evidenceRules: {
            qualificationBasePoints: 2,
            certificationBasePoints: 3,
            experiencePointsPerYear: 0.5,
            experiencePointsCap: 5,
            teachingPointsPerYear: 0.5,
            teachingPointsCap: 3,
            assessmentScoreDivisor: 20,
            assessmentPointsCap: 5,
            halfLifeYears: 3,
            diminishingReturnFactor: 0.7,
            verifiedTrust: 1,
            selfReportedTrust: 0.5
        },
        tieBreakOrder: ["verifiedRatio", "recency", "load", "profileCompletedAt"],
        defaultResultLimit: 20,
        algorithmVersion: "1.0.0"
    };
    const session = {
        withTransaction: async (callback) => callback(),
        endSession: async () => {}
    };
    t.mock.method(mongoose, "startSession", async () => session);
    t.mock.method(TrainingRequirement, "findOne", () => query(requirement));
    t.mock.method(TrainingRequirement, "findOneAndUpdate", async () => requirement);
    t.mock.method(MatchingConfig, "findOne", () => query(config));
    t.mock.method(OrganizationMembership, "find", () => ({
        select() {
            return this;
        },
        session() {
            return this;
        },
        lean() {
            return Promise.resolve([]);
        }
    }));
    t.mock.method(MatchRun.prototype, "save", async function () {
        this._id = new mongoose.Types.ObjectId();
        return this;
    });

    const response = await invoke(executeTrainerMatchingHandler, {
        user: { orgId, userId: adminId },
        validated: {
            params: { requirementId },
            body: { orgId: new mongoose.Types.ObjectId() }
        }
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.matchRun.outcome, "none_suitable");
    assert.equal(response.body.data.matchRun.org.toString(), orgId.toString());
    assert.deepEqual(response.errors, []);
});

test("matching controller forwards service failures to Express error middleware", async (t) => {
    t.mock.method(TrainingRequirement, "findOne", () => query(null));

    const response = await invoke(executeTrainerMatchingHandler, {
        user: { orgId: new mongoose.Types.ObjectId(), userId: new mongoose.Types.ObjectId() },
        validated: { params: { requirementId: new mongoose.Types.ObjectId() } }
    });

    assert.equal(response.status, undefined);
    assert.equal(response.errors[0].statusCode, 404);
    assert.equal(response.errors[0].code, "RESOURCE_NOT_FOUND");
});
