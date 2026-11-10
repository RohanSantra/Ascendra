import mongoose from "mongoose";
import test from "node:test";
import assert from "node:assert/strict";

import TrainingRequirement from "../../../src/modules/trainingRequirements/trainingRequirement.model.js";
import MatchingConfig from "../../../src/modules/matchingConfig/matchingConfig.model.js";
import OrganizationMembership from "../../../src/modules/organizationMemberships/organizationMembership.model.js";
import TrainerProfile from "../../../src/modules/trainerProfiles/trainerProfile.model.js";
import CompetencyEvidence from "../../../src/modules/competencyEvidence/submissions/competencyEvidence.model.js";
import MatchRun from "../../../src/modules/matchRun/matchRun.model.js";

import {
    executeTrainerMatching
} from "../../../src/modules/matching/matching.service.js";

const createQuery = (result) => ({
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
        return Promise.resolve(result);
    },
    then(resolve, reject) {
        return Promise.resolve(result).then(resolve, reject);
    }
});

const createMatchingConfig = (overrides = {}) => ({
    weights: {
        competency: 1,
        skills: 0,
        qualification: 0,
        experience: 0,
        teaching: 0,
        certification: 0
    },
    thresholds: {
        strong: 0.8,
        partial: 0.5
    },
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
    tieBreakOrder: [
        "verifiedRatio",
        "recency",
        "load",
        "profileCompletedAt"
    ],
    defaultResultLimit: 20,
    algorithmVersion: "1.0.0",
    ...overrides
});

const createMatchingFixture = () => {
    const orgId = new mongoose.Types.ObjectId();
    const requirementId = new mongoose.Types.ObjectId();
    const executedBy = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const profileId = new mongoose.Types.ObjectId();
    const competencyId = new mongoose.Types.ObjectId();

    return {
        orgId,
        requirementId,
        executedBy,
        userId,
        profileId,
        competencyId,
        requirement: {
            _id: requirementId,
            competencies: [{
                competency: competencyId,
                minLevel: 3,
                weight: 1,
                mustHave: true
            }],
            requiredSkills: [],
            qualificationKeywords: [],
            qualificationMustHave: false,
            requiredCertifications: [],
            minimumExperienceYears: 0,
            minimumTeachingYears: 0
        },
        trainerProfile: {
            _id: profileId,
            user: userId,
            competencySummary: [{
                competency: competencyId,
                points: 9,
                level: "expert",
                levelNum: 4
            }],
            skills: [],
            evidenceStats: {
                verifiedRatio: 1,
                latestEvidenceAt: new Date("2026-11-03T00:00:00.000Z")
            },
            availability: {
                status: "available",
                activeTrainings: 0,
                maxConcurrentTrainings: 3
            },
            completion: {
                profileCompletedAt: new Date("2026-01-01T00:00:00.000Z")
            }
        }
    };
};

const mockMatchingQueries = (t, fixture, config = createMatchingConfig()) => {
    t.mock.method(
        TrainingRequirement,
        "findOne",
        () => createQuery(fixture.requirement)
    );
    t.mock.method(
        MatchingConfig,
        "findOne",
        () => createQuery(config)
    );
    t.mock.method(
        OrganizationMembership,
        "find",
        () => createQuery([{ user: fixture.userId }])
    );
    t.mock.method(
        TrainerProfile,
        "find",
        () => createQuery([fixture.trainerProfile])
    );
    t.mock.method(
        CompetencyEvidence,
        "find",
        () => createQuery([{
            trainerProfile: fixture.profileId,
            type: "qualification",
            competencies: [fixture.competencyId],
            skills: [],
            verification: { status: "verified" },
            isDeleted: false,
            supersededBy: null
        }])
    );
};

test("requires organization, requirement and executing user identifiers", async () => {
    await assert.rejects(
        executeTrainerMatching({
            orgId: new mongoose.Types.ObjectId(),
            requirementId: new mongoose.Types.ObjectId()
        }),
        {
            statusCode: 400,
            code: "VALIDATION_ERROR"
        }
    );
});

test("rejects invalid matching configuration before querying trainers", async (t) => {
    const fixture = createMatchingFixture();
    const config = createMatchingConfig({
        tieBreakOrder: ["verifiedRatio", "verifiedRatio"]
    });
    let trainerQueryCalled = false;

    t.mock.method(
        TrainingRequirement,
        "findOne",
        () => createQuery(fixture.requirement)
    );
    t.mock.method(
        MatchingConfig,
        "findOne",
        () => createQuery(config)
    );
    t.mock.method(
        OrganizationMembership,
        "find",
        () => {
            trainerQueryCalled = true;
            return createQuery([]);
        }
    );

    await assert.rejects(
        executeTrainerMatching({
            orgId: fixture.orgId,
            requirementId: fixture.requirementId,
            executedBy: fixture.executedBy
        }),
        {
            statusCode: 422,
            code: "VALIDATION_ERROR"
        }
    );

    assert.equal(trainerQueryCalled, false);
});

test("rejects invalid matching weights, thresholds, evidence rules and result limits", async (t) => {
    const fixture = createMatchingFixture();
    const baseConfig = createMatchingConfig();
    const invalidConfigurations = [
        {
            name: "missing configuration sections",
            config: {}
        },
        {
            name: "unsupported matching weight",
            config: {
                ...baseConfig,
                weights: { ...baseConfig.weights, extra: 1 }
            }
        },
        {
            name: "non-object matching weights",
            config: { ...baseConfig, weights: [] }
        },
        {
            name: "negative matching weight",
            config: {
                ...baseConfig,
                weights: { ...baseConfig.weights, skills: -1 }
            }
        },
        {
            name: "all matching weights are zero",
            config: {
                ...baseConfig,
                weights: Object.fromEntries(
                    Object.keys(baseConfig.weights).map((key) => [key, 0])
                )
            }
        },
        {
            name: "invalid matching thresholds",
            config: {
                ...baseConfig,
                thresholds: { strong: 0.4, partial: 0.5 }
            }
        },
        {
            name: "unsupported evidence rule",
            config: {
                ...baseConfig,
                evidenceRules: {
                    ...baseConfig.evidenceRules,
                    extra: 1
                }
            }
        },
        {
            name: "negative evidence points",
            config: {
                ...baseConfig,
                evidenceRules: {
                    ...baseConfig.evidenceRules,
                    qualificationBasePoints: -1
                }
            }
        },
        {
            name: "invalid assessment divisor",
            config: {
                ...baseConfig,
                evidenceRules: {
                    ...baseConfig.evidenceRules,
                    assessmentScoreDivisor: 0
                }
            }
        },
        {
            name: "invalid evidence half-life",
            config: {
                ...baseConfig,
                evidenceRules: {
                    ...baseConfig.evidenceRules,
                    halfLifeYears: 0
                }
            }
        },
        {
            name: "invalid diminishing return factor",
            config: {
                ...baseConfig,
                evidenceRules: {
                    ...baseConfig.evidenceRules,
                    diminishingReturnFactor: 1.1
                }
            }
        },
        {
            name: "invalid evidence trust",
            config: {
                ...baseConfig,
                evidenceRules: {
                    ...baseConfig.evidenceRules,
                    verifiedTrust: -0.1
                }
            }
        },
        {
            name: "unsupported tie-break criterion",
            config: {
                ...baseConfig,
                tieBreakOrder: ["unsupported"]
            }
        },
        {
            name: "invalid result limit",
            config: { ...baseConfig, defaultResultLimit: 0 }
        }
    ];
    let activeConfig;
    let trainerQueryCalled = false;

    t.mock.method(
        TrainingRequirement,
        "findOne",
        () => createQuery(fixture.requirement)
    );
    t.mock.method(
        MatchingConfig,
        "findOne",
        () => createQuery(activeConfig)
    );
    t.mock.method(
        OrganizationMembership,
        "find",
        () => {
            trainerQueryCalled = true;
            return createQuery([]);
        }
    );

    for (const invalid of invalidConfigurations) {
        activeConfig = invalid.config;
        await assert.rejects(
            executeTrainerMatching({
                orgId: fixture.orgId,
                requirementId: fixture.requirementId,
                executedBy: fixture.executedBy
            }),
            (error) => {
                assert.equal(error.statusCode, 422, invalid.name);
                assert.equal(error.code, "VALIDATION_ERROR", invalid.name);
                return true;
            },
            invalid.name
        );
    }

    assert.equal(trainerQueryCalled, false);
});

test("persists ranked matching results and updates the requirement in a transaction", async (t) => {
    const fixture = createMatchingFixture();
    const config = createMatchingConfig();
    const matchRunId = new mongoose.Types.ObjectId();
    const calls = {
        transaction: 0,
        sessionEnded: false,
        savedData: null,
        requirementUpdate: null
    };
    const session = {
        withTransaction: async (callback) => {
            calls.transaction += 1;
            await callback();
        },
        endSession: async () => {
            calls.sessionEnded = true;
        }
    };

    mockMatchingQueries(t, fixture, config);
    t.mock.method(mongoose, "startSession", async () => session);
    t.mock.method(MatchRun.prototype, "save", async function () {
        calls.savedData = this.toObject();
        this._id = matchRunId;
        return this;
    });
    t.mock.method(
        TrainingRequirement,
        "findOneAndUpdate",
        (filter, update, options) => {
            calls.requirementUpdate = { filter, update, options };
            return Promise.resolve({ _id: fixture.requirementId });
        }
    );

    const result = await executeTrainerMatching({
        orgId: fixture.orgId,
        requirementId: fixture.requirementId,
        executedBy: fixture.executedBy
    });

    assert.equal(result._id.toString(), matchRunId.toString());
    assert.equal(result.outcome, "strong_found");
    assert.equal(result.stats.candidatesEvaluated, 1);
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].rank, 1);
    assert.equal(result.results[0].score, 1);
    assert.equal(result.results[0].tier, "strong");
    assert.equal(calls.transaction, 1);
    assert.equal(calls.sessionEnded, true);
    assert.equal(
        calls.savedData.requirement.toString(),
        fixture.requirementId.toString()
    );
    assert.deepEqual(calls.requirementUpdate.update.$set, {
        latestMatchRun: matchRunId,
        status: "matched",
        updatedBy: fixture.executedBy
    });
    assert.equal(calls.requirementUpdate.options.session, session);
});

test("ends the transaction session when match run persistence fails", async (t) => {
    const fixture = createMatchingFixture();
    let sessionEnded = false;
    const session = {
        withTransaction: async (callback) => callback(),
        endSession: async () => {
            sessionEnded = true;
        }
    };

    mockMatchingQueries(t, fixture);
    t.mock.method(mongoose, "startSession", async () => session);
    t.mock.method(MatchRun.prototype, "save", async () => {
        throw new Error("Simulated match run persistence failure");
    });

    await assert.rejects(
        executeTrainerMatching({
            orgId: fixture.orgId,
            requirementId: fixture.requirementId,
            executedBy: fixture.executedBy
        }),
        /Simulated match run persistence failure/
    );

    assert.equal(sessionEnded, true);
});

test("persists an empty matching result when no eligible trainers are found", async (t) => {
    const fixture = createMatchingFixture();
    const config = createMatchingConfig();
    const matchRunId = new mongoose.Types.ObjectId();

    const calls = {
        savedData: null,
        sessionEnded: false,
        requirementUpdate: null
    };

    const session = {
        withTransaction: async (callback) => callback(),
        endSession: async () => {
            calls.sessionEnded = true;
        }
    };

    t.mock.method(
        TrainingRequirement,
        "findOne",
        () => createQuery(fixture.requirement)
    );

    t.mock.method(
        MatchingConfig,
        "findOne",
        () => createQuery(config)
    );

    t.mock.method(
        OrganizationMembership,
        "find",
        () => createQuery([])
    );

    t.mock.method(
        TrainerProfile,
        "find",
        () => createQuery([])
    );

    t.mock.method(
        CompetencyEvidence,
        "find",
        () => createQuery([])
    );

    t.mock.method(
        mongoose,
        "startSession",
        async () => session
    );

    t.mock.method(
        MatchRun.prototype,
        "save",
        async function () {
            calls.savedData = this.toObject();
            this._id = matchRunId;
            return this;
        }
    );

    t.mock.method(
        TrainingRequirement,
        "findOneAndUpdate",
        (filter, update, options) => {
            calls.requirementUpdate = {
                filter,
                update,
                options
            };

            return Promise.resolve({
                _id: fixture.requirementId
            });
        }
    );

    const result = await executeTrainerMatching({
        orgId: fixture.orgId,
        requirementId: fixture.requirementId,
        executedBy: fixture.executedBy
    });

    assert.equal(result._id.toString(), matchRunId.toString());
    assert.equal(result.outcome, "none_suitable");
    assert.equal(result.stats.candidatesEvaluated, 0);
    assert.deepEqual(result.results, []);

    assert.deepEqual(calls.savedData.results, []);
    assert.equal(calls.savedData.outcome, "none_suitable");
    assert.equal(calls.sessionEnded, true);

    assert.ok(calls.requirementUpdate);
    assert.equal(
        calls.requirementUpdate.update.$set.status,
        "matched"
    );
});

test("ends the transaction session when requirement update fails", async (t) => {
    const fixture = createMatchingFixture();

    let sessionEnded = false;
    let matchRunSaved = false;

    const session = {
        withTransaction: async (callback) => callback(),
        endSession: async () => {
            sessionEnded = true;
        }
    };

    mockMatchingQueries(t, fixture);

    t.mock.method(
        mongoose,
        "startSession",
        async () => session
    );

    t.mock.method(
        MatchRun.prototype,
        "save",
        async function () {
            matchRunSaved = true;
            this._id = new mongoose.Types.ObjectId();
            return this;
        }
    );

    t.mock.method(
        TrainingRequirement,
        "findOneAndUpdate",
        async () => {
            throw new Error("Simulated requirement update failure");
        }
    );

    await assert.rejects(
        executeTrainerMatching({
            orgId: fixture.orgId,
            requirementId: fixture.requirementId,
            executedBy: fixture.executedBy
        }),
        /Simulated requirement update failure/
    );

    assert.equal(matchRunSaved, true);
    assert.equal(sessionEnded, true);
});