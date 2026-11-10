
import test, {
    before,
    after,
    beforeEach
} from "node:test";

import assert from "node:assert/strict";

import {
    startTestDatabase,
    clearTestDatabase,
    stopTestDatabase
} from "../../helpers/database.js";

import User from "../../../src/modules/auth/user.model.js";
import Organization from "../../../src/modules/organizations/organization.model.js";
import OrganizationMembership from "../../../src/modules/organizationMemberships/organizationMembership.model.js";
import TrainerProfile from "../../../src/modules/trainerProfiles/trainerProfile.model.js";
import Competency from "../../../src/modules/competencies/competency.model.js";
import CompetencyEvidence from "../../../src/modules/competencyEvidence/submissions/competencyEvidence.model.js";

import TrainingRequirement from "../../../src/modules/trainingRequirements/trainingRequirement.model.js";
import MatchingConfig from "../../../src/modules/matchingConfig/matchingConfig.model.js";
import MatchRun from "../../../src/modules/matchRun/matchRun.model.js";

import {
    executeTrainerMatching
} from "../../../src/modules/matching/matching.service.js";

let organization;
let admin;
let trainer;
let trainerProfile;
let competency;
let requirement;

before(async () => {
    await startTestDatabase();
});

after(async () => {
    await stopTestDatabase();
});

beforeEach(async () => {
    await clearTestDatabase();

    admin = await User.create({
        firstName: "Test",
        lastName: "Admin",
        email: "admin@example.com"
    });

    trainer = await User.create({
        firstName: "Test",
        lastName: "Trainer",
        email: "trainer@example.com"
    });

    organization = await Organization.create({
        name: "Test Organization",
        slug: "test-organization",
        createdBy: admin._id
    });

    await OrganizationMembership.create({
        org: organization._id,
        user: admin._id,
        role: "admin",
        status: "approved",
        joinedAt: new Date()
    });

    await OrganizationMembership.create({
        org: organization._id,
        user: trainer._id,
        role: "trainer",
        status: "approved",
        joinedAt: new Date()
    });

    competency = await Competency.create({
        org: organization._id,
        name: "Software Development",
        slug: "software-development",
        status: "active",
        createdBy: admin._id
    });

    trainerProfile = await TrainerProfile.create({
        org: organization._id,
        user: trainer._id,
        approval: {
            status: "approved"
        },
        availability: {
            status: "available",
            activeTrainings: 0,
            maxConcurrentTrainings: 3
        },
        competencySummary: [
            {
                competency: competency._id,
                points: 9,
                level: "expert",
                levelNum: 4,
                evidenceCount: 1,
                verifiedEvidenceCount: 1
            }
        ],
        evidenceStats: {
            total: 1,
            verified: 1,
            verifiedRatio: 1,
            latestEvidenceAt: new Date()
        },
        completion: {
            percentage: 100,
            profileCompletedAt: new Date()
        },
        experience: {
            industryYears: 5,
            teachingYears: 3
        }
    });

    await CompetencyEvidence.create({
        org: organization._id,
        user: trainer._id,
        trainerProfile: trainerProfile._id,
        type: "qualification",
        competencies: [competency._id],
        skills: [],
        title: "Bachelor of Computer Science",
        description: "Computer Science qualification",
        details: {
            qualificationName: "Bachelor of Computer Science",
            institution: "Example University",
            fieldOfStudy: "Computer Science"
        },
        verification: {
            status: "verified",
            verifiedBy: admin._id,
            verifiedAt: new Date()
        }
    });

    await MatchingConfig.create({
        org: organization._id,
        version: 1,
        isActive: true,
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
        createdBy: admin._id,
        updatedBy: admin._id
    });

    requirement = await TrainingRequirement.create({
        org: organization._id,
        title: "Software Development Trainer",
        description: "Trainer required for software development training.",
        competencies: [
            {
                competency: competency._id,
                minLevel: 3,
                weight: 1,
                mustHave: true
            }
        ],
        requiredSkills: [],
        qualificationKeywords: [],
        qualificationMustHave: false,
        requiredCertifications: [],
        minimumExperienceYears: 0,
        minimumTeachingYears: 0,
        status: "ready",
        createdBy: admin._id,
        updatedBy: admin._id
    });
});

/**
 * @name matchingParams
 * @description Returns matching parameters for the current test setup.
 */
const matchingParams = () => ({
    orgId: organization._id,
    requirementId: requirement._id,
    executedBy: admin._id
});

/* -------------------------------------------------------------------------- */
/* Successful matching                                                        */
/* -------------------------------------------------------------------------- */

test(
    "executes matching and persists the MatchRun with ranked trainers",
    async () => {
        const result = await executeTrainerMatching(matchingParams());

        assert.ok(result._id);
        assert.equal(result.org.toString(), organization._id.toString());
        assert.equal(result.requirement.toString(), requirement._id.toString());

        assert.equal(result.algorithmVersion, "1.0.0");
        assert.equal(result.outcome, "strong_found");

        assert.equal(result.stats.candidatesEvaluated, 1);
        assert.equal(result.results.length, 1);

        assert.equal(
            result.results[0].trainer.toString(),
            trainer._id.toString()
        );

        assert.equal(
            result.results[0].trainerProfile.toString(),
            trainerProfile._id.toString()
        );

        assert.equal(result.results[0].rank, 1);
        assert.equal(result.results[0].tier, "strong");
        assert.equal(result.results[0].score, 1);
        assert.equal(result.results[0].provisional, false);
        assert.equal(result.results[0].atCapacity, false);

        const savedRun = await MatchRun.findById(result._id).lean();

        assert.ok(savedRun);
        assert.equal(savedRun.results.length, 1);

        const updatedRequirement = await TrainingRequirement.findById(
            requirement._id
        ).lean();

        assert.equal(updatedRequirement.status, "matched");

        assert.equal(
            updatedRequirement.latestMatchRun.toString(),
            result._id.toString()
        );
    }
);

/* -------------------------------------------------------------------------- */
/* No eligible trainers                                                       */
/* -------------------------------------------------------------------------- */

test(
    "persists a matching run when no eligible trainers exist",
    async () => {
        await TrainerProfile.updateOne(
            { _id: trainerProfile._id },
            {
                $set: {
                    "approval.status": "suspended"
                }
            }
        );

        const result = await executeTrainerMatching(matchingParams());

        assert.ok(result._id);
        assert.equal(result.outcome, "none_suitable");
        assert.equal(result.stats.candidatesEvaluated, 0);
        assert.deepEqual(result.results, []);

        const updatedRequirement = await TrainingRequirement.findById(
            requirement._id
        ).lean();

        assert.equal(updatedRequirement.status, "matched");
        assert.equal(
            updatedRequirement.latestMatchRun.toString(),
            result._id.toString()
        );
    }
);

/* -------------------------------------------------------------------------- */
/* Organization isolation                                                     */
/* -------------------------------------------------------------------------- */

test(
    "does not allow matching a requirement from another organization",
    async () => {
        const otherOrganization = await Organization.create({
            name: "Other Organization",
            slug: "other-organization",
            createdBy: admin._id
        });

        await assert.rejects(
            executeTrainerMatching({
                orgId: otherOrganization._id,
                requirementId: requirement._id,
                executedBy: admin._id
            }),
            (error) => error.statusCode === 404
        );

        assert.equal(await MatchRun.countDocuments({}), 0);

        const unchangedRequirement = await TrainingRequirement.findById(
            requirement._id
        ).lean();

        assert.equal(unchangedRequirement.status, "ready");
        assert.equal(unchangedRequirement.latestMatchRun, null);
    }
);

/* -------------------------------------------------------------------------- */
/* Transaction rollback                                                       */
/* -------------------------------------------------------------------------- */

test(
    "rolls back matching when MatchRun persistence fails",
    async () => {
        const originalSave = MatchRun.prototype.save;

        try {
            MatchRun.prototype.save = async function () {
                throw new Error("Simulated MatchRun persistence failure");
            };

            await assert.rejects(
                executeTrainerMatching(matchingParams()),
                /Simulated MatchRun persistence failure/
            );
        } finally {
            MatchRun.prototype.save = originalSave;
        }

        assert.equal(
            await MatchRun.countDocuments({
                org: organization._id
            }),
            0
        );

        const unchangedRequirement = await TrainingRequirement.findById(
            requirement._id
        ).lean();

        assert.equal(unchangedRequirement.status, "ready");
        assert.equal(unchangedRequirement.latestMatchRun, null);
    }
);

/* -------------------------------------------------------------------------- */
/* Requirement validation                                                     */
/* -------------------------------------------------------------------------- */

test(
    "does not execute matching for a draft requirement",
    async () => {
        await TrainingRequirement.updateOne(
            { _id: requirement._id },
            {
                $set: {
                    status: "draft"
                }
            }
        );

        await assert.rejects(
            executeTrainerMatching(matchingParams()),
            (error) => error.statusCode === 404
        );

        assert.equal(await MatchRun.countDocuments({}), 0);
    }
);

/* -------------------------------------------------------------------------- */
/* Result immutability                                                        */
/* -------------------------------------------------------------------------- */

test(
    "does not modify an existing MatchRun when a later matching run executes",
    async () => {
        const firstRun = await executeTrainerMatching(matchingParams());

        const originalScore = firstRun.results[0].score;
        const originalCreatedAt = firstRun.createdAt;

        const secondRun = await executeTrainerMatching(matchingParams());

        const unchangedFirstRun = await MatchRun.findById(
            firstRun._id
        ).lean();

        assert.ok(secondRun._id);
        assert.notEqual(
            secondRun._id.toString(),
            firstRun._id.toString()
        );

        assert.equal(unchangedFirstRun.results[0].score, originalScore);

        assert.equal(
            unchangedFirstRun.createdAt.getTime(),
            originalCreatedAt.getTime()
        );

        assert.equal(
            await MatchRun.countDocuments({
                org: organization._id
            }),
            2
        );
    }
);

test(
    "rejects matching when all factor weights are zero",
    async () => {
        await MatchingConfig.updateOne(
            { org: organization._id, isActive: true },
            {
                $set: {
                    "weights.competency": 0,
                    "weights.skills": 0,
                    "weights.qualification": 0,
                    "weights.experience": 0,
                    "weights.teaching": 0,
                    "weights.certification": 0
                }
            }
        );

        await assert.rejects(
            executeTrainerMatching(matchingParams()),
            (error) =>
                error.statusCode === 422 &&
                error.message.includes("positive weight")
        );

        assert.equal(await MatchRun.countDocuments({}), 0);
    }
);

test(
    "rejects negative matching weights",
    async () => {
        await MatchingConfig.updateOne(
            { org: organization._id, isActive: true },
            {
                $set: {
                    "weights.competency": -0.5
                }
            }
        );

        await assert.rejects(
            executeTrainerMatching(matchingParams()),
            (error) =>
                error.statusCode === 422 &&
                error.message.includes("non-negative")
        );

        assert.equal(await MatchRun.countDocuments({}), 0);
    }
);

test(
    "rejects invalid matching thresholds",
    async () => {
        await MatchingConfig.updateOne(
            { org: organization._id, isActive: true },
            {
                $set: {
                    "thresholds.strong": 0.4,
                    "thresholds.partial": 0.6
                }
            }
        );

        await assert.rejects(
            executeTrainerMatching(matchingParams()),
            (error) =>
                error.statusCode === 422 &&
                error.message.includes("thresholds")
        );

        assert.equal(await MatchRun.countDocuments({}), 0);
    }
);

test(
    "rejects evidence trust values outside the valid range",
    async () => {
        await MatchingConfig.updateOne(
            { org: organization._id, isActive: true },
            {
                $set: {
                    "evidenceRules.verifiedTrust": 1.5
                }
            }
        );

        await assert.rejects(
            executeTrainerMatching(matchingParams()),
            (error) =>
                error.statusCode === 422 &&
                error.message.includes("trust")
        );

        assert.equal(await MatchRun.countDocuments({}), 0);
    }
);

test(
    "rejects duplicate tie-break criteria",
    async () => {
        await MatchingConfig.updateOne(
            { org: organization._id, isActive: true },
            {
                $set: {
                    tieBreakOrder: [
                        "verifiedRatio",
                        "verifiedRatio"
                    ]
                }
            },
            { runValidators: false }
        );

        await assert.rejects(
            executeTrainerMatching(matchingParams()),
            (error) =>
                error.statusCode === 422 &&
                error.message.includes("tie-break")
        );

        assert.equal(await MatchRun.countDocuments({}), 0);
    }
);

test(
    "rejects invalid evidence half-life",
    async () => {
        await MatchingConfig.updateOne(
            { org: organization._id, isActive: true },
            {
                $set: {
                    "evidenceRules.halfLifeYears": 0
                }
            }
        );

        await assert.rejects(
            executeTrainerMatching(matchingParams()),
            (error) =>
                error.statusCode === 422 &&
                error.message.includes("half-life")
        );

        assert.equal(await MatchRun.countDocuments({}), 0);
    }
);

test(
    "rejects an invalid matching result limit",
    async () => {
        await MatchingConfig.updateOne(
            { org: organization._id, isActive: true },
            {
                $set: {
                    defaultResultLimit: 0
                }
            },
            { runValidators: false }
        );

        await assert.rejects(
            executeTrainerMatching(matchingParams()),
            (error) =>
                error.statusCode === 422 &&
                error.message.includes("result limit")
        );

        assert.equal(await MatchRun.countDocuments({}), 0);
    }
);

test(
    "accepts a valid matching configuration",
    async () => {
        const result = await executeTrainerMatching(
            matchingParams()
        );

        assert.ok(result._id);
        assert.equal(result.outcome, "strong_found");
        assert.equal(result.results.length, 1);
    }
);

test(
    "handles concurrent matching executions without corrupting MatchRun records",
    async () => {
        const [firstRun, secondRun] = await Promise.all([
            executeTrainerMatching(matchingParams()),
            executeTrainerMatching(matchingParams())
        ]);

        assert.ok(firstRun._id);
        assert.ok(secondRun._id);

        assert.notEqual(
            firstRun._id.toString(),
            secondRun._id.toString()
        );

        const savedRuns = await MatchRun.find({
            org: organization._id,
            requirement: requirement._id
        }).lean();

        assert.equal(savedRuns.length, 2);

        for (const run of savedRuns) {
            assert.equal(run.results.length, 1);
            assert.equal(run.results[0].rank, 1);
        }

        const updatedRequirement = await TrainingRequirement.findById(
            requirement._id
        ).lean();

        assert.equal(updatedRequirement.status, "matched");

        assert.ok(
            [firstRun._id.toString(), secondRun._id.toString()].includes(
                updatedRequirement.latestMatchRun.toString()
            )
        );
    }
);