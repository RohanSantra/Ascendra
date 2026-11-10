
/**
 * @file Evidence Engine Unit Tests
 * @description Tests evidence eligibility, scoring, trust, decay,
 *              experience calculations and trainer evidence summaries.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
    isEvidenceEligible,
    getEvidenceTrustWeight,
    calculateEvidenceAgeDecay,
    mergeDateIntervals,
    calculateMergedDurationYears,
    calculateEvidenceBaseScore,
    calculateEvidenceContribution,
    calculateDiminishingReturns,
    calculateTrainerExperience,
    calculateTrainerEvidenceSummary,
    getDefaultEvidenceConfig,
    resolveCompetencyLevel,
} from "../../../src/modules/competencyEvidence/domain/evidence.engine.js";

const DEFAULT_EVIDENCE_CONFIG = getDefaultEvidenceConfig();

// --------------------------------------------------
// Test constants and helpers
// --------------------------------------------------

const NOW = new Date("2026-11-03T00:00:00.000Z");

const COMPETENCY_ID = "competency-001";
const SECOND_COMPETENCY_ID = "competency-002";
const SKILL_ID = "skill-001";
const SECOND_SKILL_ID = "skill-002";

/**
 * @name createEvidence
 * @description Creates a reusable evidence record for unit tests.
 * @param {Object} overrides - Evidence properties to override.
 * @returns {Object} Evidence record.
 */
const createEvidence = (overrides = {}) => ({
    _id: "evidence-001",
    type: "qualification",
    title: "Test Qualification",
    createdAt: NOW,
    details: {},
    competencies: [COMPETENCY_ID],
    skills: [SKILL_ID],
    verification: {
        status: "verified",
    },
    isDeleted: false,
    supersededBy: null,
    ...overrides,
});

/**
 * @name createExperienceEvidence
 * @description Creates a professional experience evidence record.
 * @param {Object} overrides - Evidence properties to override.
 * @returns {Object} Experience evidence record.
 */
const createExperienceEvidence = (overrides = {}) =>
    createEvidence({
        type: "experience",
        details: {
            startDate: new Date("2022-11-03T00:00:00.000Z"),
            endDate: NOW,
            isOngoing: false,
        },
        ...overrides,
    });

/**
 * @name createTeachingEvidence
 * @description Creates a teaching experience evidence record.
 * @param {Object} overrides - Evidence properties to override.
 * @returns {Object} Teaching evidence record.
 */
const createTeachingEvidence = (overrides = {}) =>
    createEvidence({
        type: "teaching",
        details: {
            teachingStartDate: new Date("2024-11-03T00:00:00.000Z"),
            teachingEndDate: NOW,
            isTeachingOngoing: false,
        },
        ...overrides,
    });

/**
 * @name assertApproximatelyEqual
 * @description Compares floating-point values within a tolerance.
 * @param {number} actual - Actual value.
 * @param {number} expected - Expected value.
 * @param {number} tolerance - Allowed difference.
 */
const assertApproximatelyEqual = (
    actual,
    expected,
    tolerance = 0.001,
) => {
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `Expected ${actual} to be approximately ${expected}`,
    );
};

// --------------------------------------------------
// 1. Evidence eligibility
// --------------------------------------------------

test("verified evidence should be eligible", () => {
    assert.equal(
        isEvidenceEligible(createEvidence()),
        true,
    );
});

test("self-reported evidence should be eligible", () => {
    const evidence = createEvidence({
        verification: {
            status: "self_reported",
        },
    });

    assert.equal(isEvidenceEligible(evidence), true);
});

test("rejected evidence should not be eligible", () => {
    const evidence = createEvidence({
        verification: {
            status: "rejected",
        },
    });

    assert.equal(isEvidenceEligible(evidence), false);
});

test("deleted evidence should not be eligible", () => {
    const evidence = createEvidence({
        isDeleted: true,
    });

    assert.equal(isEvidenceEligible(evidence), false);
});

test("superseded evidence should not be eligible", () => {
    const evidence = createEvidence({
        supersededBy: "evidence-002",
    });

    assert.equal(isEvidenceEligible(evidence), false);
});

test("evidence without a verification status should not be eligible", () => {
    const evidence = createEvidence({
        verification: {},
    });

    assert.equal(isEvidenceEligible(evidence), false);
});

test("null evidence should not be eligible", () => {
    assert.equal(isEvidenceEligible(null), false);
});

// --------------------------------------------------
// 2. Evidence trust weight
// --------------------------------------------------

test("verified evidence should receive full trust weight", () => {
    const evidence = createEvidence();

    assert.equal(
        getEvidenceTrustWeight(evidence),
        DEFAULT_EVIDENCE_CONFIG.trustWeights.verified,
    );
});

test("self-reported evidence should receive reduced trust weight", () => {
    const evidence = createEvidence({
        verification: {
            status: "self_reported",
        },
    });

    assert.equal(
        getEvidenceTrustWeight(evidence),
        DEFAULT_EVIDENCE_CONFIG.trustWeights.self_reported,
    );
});

test("rejected evidence should receive zero trust weight", () => {
    const evidence = createEvidence({
        verification: {
            status: "rejected",
        },
    });

    assert.equal(getEvidenceTrustWeight(evidence), 0);
});

test("custom trust weights should be respected", () => {
    const evidence = createEvidence();

    const config = {
        ...getDefaultEvidenceConfig(),
        trustWeights: {
            verified: 0.9,
            self_reported: 0.4,
        },
    };

    assert.equal(
        getEvidenceTrustWeight(evidence, config),
        0.9,
    );
});

// --------------------------------------------------
// 3. Evidence age decay
// --------------------------------------------------

test("evidence decay should equal 1 when evidence is current", () => {
    const result = calculateEvidenceAgeDecay({
        referenceDate: NOW,
        now: NOW,
        halfLifeYears: 3,
    });

    assert.equal(result, 1);
});

test("evidence decay should equal 0.5 after one half-life", () => {
    const referenceDate = new Date(
        NOW.getTime() - (3 * 365.25 * 24 * 60 * 60 * 1000),
    );

    const result = calculateEvidenceAgeDecay({
        referenceDate,
        now: NOW,
        halfLifeYears: 3,
    });

    assertApproximatelyEqual(result, 0.5);
});

test("older evidence should have lower decay than recent evidence", () => {
    const recentDate = new Date("2025-11-03T00:00:00.000Z");
    const olderDate = new Date("2020-11-03T00:00:00.000Z");

    const recentDecay = calculateEvidenceAgeDecay({
        referenceDate: recentDate,
        now: NOW,
    });

    const olderDecay = calculateEvidenceAgeDecay({
        referenceDate: olderDate,
        now: NOW,
    });

    assert.ok(recentDecay > olderDecay);
});

test("future-dated evidence should not receive an age penalty", () => {
    const futureDate = new Date("2027-11-03T00:00:00.000Z");

    const result = calculateEvidenceAgeDecay({
        referenceDate: futureDate,
        now: NOW,
        halfLifeYears: 3,
    });

    assert.equal(result, 1);
});

test("invalid reference date should return zero decay", () => {
    const result = calculateEvidenceAgeDecay({
        referenceDate: "invalid-date",
        now: NOW,
    });

    assert.equal(result, 0);
});

test("invalid half-life should return zero decay", () => {
    const result = calculateEvidenceAgeDecay({
        referenceDate: NOW,
        now: NOW,
        halfLifeYears: 0,
    });

    assert.equal(result, 0);
});

// --------------------------------------------------
// 4. Date interval merging
// --------------------------------------------------

test("overlapping intervals should merge into one interval", () => {
    const intervals = [
        {
            start: new Date("2020-01-01"),
            end: new Date("2022-01-01"),
        },
        {
            start: new Date("2021-01-01"),
            end: new Date("2023-01-01"),
        },
    ];

    const result = mergeDateIntervals(intervals, NOW);

    assert.equal(result.length, 1);

    assert.equal(
        result[0].start.getTime(),
        new Date("2020-01-01").getTime(),
    );

    assert.equal(
        result[0].end.getTime(),
        new Date("2023-01-01").getTime(),
    );
});

test("non-overlapping intervals should remain separate", () => {
    const intervals = [
        {
            start: new Date("2020-01-01"),
            end: new Date("2021-01-01"),
        },
        {
            start: new Date("2022-01-01"),
            end: new Date("2023-01-01"),
        },
    ];

    const result = mergeDateIntervals(intervals, NOW);

    assert.equal(result.length, 2);
});

test("adjacent intervals should merge", () => {
    const intervals = [
        {
            start: new Date("2020-01-01"),
            end: new Date("2021-01-01"),
        },
        {
            start: new Date("2021-01-01"),
            end: new Date("2022-01-01"),
        },
    ];

    const result = mergeDateIntervals(intervals, NOW);

    assert.equal(result.length, 1);
});

test("future interval end dates should be bounded by now", () => {
    const intervals = [
        {
            start: new Date("2025-01-01"),
            end: new Date("2028-01-01"),
        },
    ];

    const result = mergeDateIntervals(intervals, NOW);

    assert.equal(result.length, 1);
    assert.equal(result[0].end.getTime(), NOW.getTime());
});

test("ongoing intervals should use now as their end date", () => {
    const intervals = [
        {
            start: new Date("2025-01-01"),
            end: null,
        },
    ];

    const result = mergeDateIntervals(intervals, NOW);

    assert.equal(result.length, 1);
    assert.equal(result[0].end.getTime(), NOW.getTime());
});

test("invalid intervals should be excluded", () => {
    const intervals = [
        {
            start: "invalid-date",
            end: NOW,
        },
        {
            start: new Date("2025-01-01"),
            end: new Date("2024-01-01"),
        },
    ];

    const result = mergeDateIntervals(intervals, NOW);

    assert.equal(result.length, 0);
});

test("missing current date should return an empty interval array", () => {
    assert.deepEqual(mergeDateIntervals([], null), []);
});

// --------------------------------------------------
// 5. Merged duration calculation
// --------------------------------------------------

test("merged duration should not double-count overlapping periods", () => {
    const intervals = [
        {
            start: new Date("2020-01-01"),
            end: new Date("2022-01-01"),
        },
        {
            start: new Date("2021-01-01"),
            end: new Date("2023-01-01"),
        },
    ];

    const result = calculateMergedDurationYears(
        intervals,
        NOW,
    );

    assertApproximatelyEqual(result, 3.000684, 0.00001);
});

test("merged duration should add separate periods", () => {
    const intervals = [
        {
            start: new Date("2020-01-01"),
            end: new Date("2021-01-01"),
        },
        {
            start: new Date("2022-01-01"),
            end: new Date("2023-01-01"),
        },
    ];

    const result = calculateMergedDurationYears(
        intervals,
        NOW,
    );

    assertApproximatelyEqual(result, 2.002);
});

test("empty intervals should return zero duration", () => {
    assert.equal(
        calculateMergedDurationYears([], NOW),
        0,
    );
});

// --------------------------------------------------
// 6. Evidence base score
// --------------------------------------------------

test("qualification evidence should receive its configured base score", () => {
    const result = calculateEvidenceBaseScore(
        createEvidence({
            type: "qualification",
        }),
        NOW,
    );

    assert.equal(result, 2);
});

test("certification evidence should receive its configured base score", () => {
    const result = calculateEvidenceBaseScore(
        createEvidence({
            type: "certification",
        }),
        NOW,
    );

    assert.equal(result, 3);
});

test("expired certification should receive zero base score", () => {
    const result = calculateEvidenceBaseScore(
        createEvidence({
            type: "certification",
            details: {
                expiresAt: new Date("2025-01-01"),
            },
        }),
        NOW,
    );

    assert.equal(result, 0);
});

test("certification without expiry date should retain its base score", () => {
    const result = calculateEvidenceBaseScore(
        createEvidence({
            type: "certification",
            details: {},
        }),
        NOW,
    );

    assert.equal(result, 3);
});

test("professional experience score should be based on duration", () => {
    const result = calculateEvidenceBaseScore(
        createExperienceEvidence(),
        NOW,
    );

    assertApproximatelyEqual(result, 2);
});

test("professional experience score should respect its maximum score", () => {
    const result = calculateEvidenceBaseScore(
        createExperienceEvidence({
            details: {
                startDate: new Date("2010-11-03"),
                endDate: NOW,
                isOngoing: false,
            },
        }),
        NOW,
    );

    assert.equal(
        result,
        DEFAULT_EVIDENCE_CONFIG.maximumScores.experience,
    );
});

test("teaching experience score should be based on duration", () => {
    const result = calculateEvidenceBaseScore(
        createTeachingEvidence(),
        NOW,
    );

    assertApproximatelyEqual(result, 1);
});

test("teaching experience score should respect its maximum score", () => {
    const result = calculateEvidenceBaseScore(
        createTeachingEvidence({
            details: {
                teachingStartDate: new Date("2010-11-03"),
                teachingEndDate: NOW,
                isTeachingOngoing: false,
            },
        }),
        NOW,
    );

    assert.equal(
        result,
        DEFAULT_EVIDENCE_CONFIG.maximumScores.teaching,
    );
});

test("assessment score should be calculated from its percentage", () => {
    const result = calculateEvidenceBaseScore(
        createEvidence({
            type: "assessment",
            details: {
                score: 80,
                maximumScore: 100,
            },
        }),
        NOW,
    );

    assert.equal(result, 4);
});

test("assessment score should respect its maximum score", () => {
    const result = calculateEvidenceBaseScore(
        createEvidence({
            type: "assessment",
            details: {
                score: 100,
                maximumScore: 100,
            },
        }),
        NOW,
    );

    assert.equal(
        result,
        DEFAULT_EVIDENCE_CONFIG.maximumScores.assessment,
    );
});

test("invalid assessment score should return zero", () => {
    const result = calculateEvidenceBaseScore(
        createEvidence({
            type: "assessment",
            details: {
                score: 120,
                maximumScore: 100,
            },
        }),
        NOW,
    );

    assert.equal(result, 0);
});

test("unknown evidence type should return zero", () => {
    const result = calculateEvidenceBaseScore(
        createEvidence({
            type: "unknown",
        }),
        NOW,
    );

    assert.equal(result, 0);
});

test("missing evidence should return zero base score", () => {
    assert.equal(
        calculateEvidenceBaseScore(null, NOW),
        0,
    );
});

// --------------------------------------------------
// 7. Individual evidence contribution
// --------------------------------------------------

test("verified qualification should receive full contribution", () => {
    const result = calculateEvidenceContribution(
        createEvidence(),
        NOW,
    );

    assert.equal(result.eligible, true);
    assert.equal(result.baseScore, 2);
    assert.equal(result.trustWeight, 1);
    assert.equal(result.ageDecay, 1);
    assert.equal(result.score, 2);
});

test("self-reported qualification should receive reduced contribution", () => {
    const result = calculateEvidenceContribution(
        createEvidence({
            verification: {
                status: "self_reported",
            },
        }),
        NOW,
    );

    assert.equal(result.eligible, true);
    assert.equal(result.trustWeight, 0.5);
    assert.equal(result.score, 1);
});

test("old evidence should receive an age-adjusted contribution", () => {
    const referenceDate = new Date(
        NOW.getTime() - (3 * 365.25 * 24 * 60 * 60 * 1000),
    );

    const result = calculateEvidenceContribution(
        createEvidence({
            details: {
                issuedAt: referenceDate,
            },
        }),
        NOW,
    );

    assertApproximatelyEqual(result.ageDecay, 0.5);
    assertApproximatelyEqual(result.score, 1);
});

test("rejected evidence should return an ineligible contribution", () => {
    const result = calculateEvidenceContribution(
        createEvidence({
            verification: {
                status: "rejected",
            },
        }),
        NOW,
    );

    assert.deepEqual(result, {
        eligible: false,
        baseScore: 0,
        trustWeight: 0,
        ageDecay: 0,
        score: 0,
    });
});

test("expired certification should remain eligible but have zero score", () => {
    const result = calculateEvidenceContribution(
        createEvidence({
            type: "certification",
            details: {
                expiresAt: new Date("2025-01-01"),
            },
        }),
        NOW,
    );

    assert.equal(result.eligible, true);
    assert.equal(result.baseScore, 0);
    assert.equal(result.score, 0);
});

// --------------------------------------------------
// 8. Diminishing returns
// --------------------------------------------------

test("diminishing returns should apply to sorted contributions", () => {
    const result = calculateDiminishingReturns([
        10,
        5,
        2,
    ]);

    assertApproximatelyEqual(result, 14.48);
});

test("diminishing returns should sort contributions in descending order", () => {
    const result = calculateDiminishingReturns([
        2,
        10,
        5,
    ]);

    assertApproximatelyEqual(result, 14.48);
});

test("diminishing returns should ignore zero and negative scores", () => {
    const result = calculateDiminishingReturns([
        10,
        0,
        -5,
        5,
    ]);

    assertApproximatelyEqual(result, 13.5);
});

test("diminishing returns should support a custom factor", () => {
    const result = calculateDiminishingReturns(
        [10, 5],
        0.5,
    );

    assert.equal(result, 12.5);
});

test("invalid diminishing return factor should return zero", () => {
    assert.equal(
        calculateDiminishingReturns([10, 5], 1.5),
        0,
    );
});

// --------------------------------------------------
// 9. Trainer experience calculation
// --------------------------------------------------

test("trainer experience should calculate professional experience", () => {
    const result = calculateTrainerExperience({
        evidenceRecords: [
            createExperienceEvidence(),
        ],
        now: NOW,
    });

    assertApproximatelyEqual(
        result.professionalExperienceYears,
        4,
    );

    assert.equal(result.teachingExperienceYears, 0);
});

test("trainer experience should calculate teaching experience", () => {
    const result = calculateTrainerExperience({
        evidenceRecords: [
            createTeachingEvidence(),
        ],
        now: NOW,
    });

    assert.equal(result.professionalExperienceYears, 0);

    assertApproximatelyEqual(
        result.teachingExperienceYears,
        1.998631,
        0.00001,
    );
});

test("overlapping professional experience should not be double-counted", () => {
    const evidenceRecords = [
        createExperienceEvidence({
            _id: "experience-001",
            details: {
                startDate: new Date("2020-01-01"),
                endDate: new Date("2022-01-01"),
                isOngoing: false,
            },
        }),
        createExperienceEvidence({
            _id: "experience-002",
            details: {
                startDate: new Date("2021-01-01"),
                endDate: new Date("2023-01-01"),
                isOngoing: false,
            },
        }),
    ];

    const result = calculateTrainerExperience({
        evidenceRecords,
        now: NOW,
    });

    assertApproximatelyEqual(
        result.professionalExperienceYears,
        3.000684,
        0.00001,
    );
});

test("rejected experience should not contribute to trainer experience", () => {
    const result = calculateTrainerExperience({
        evidenceRecords: [
            createExperienceEvidence({
                verification: {
                    status: "rejected",
                },
            }),
        ],
        now: NOW,
    });

    assert.equal(result.professionalExperienceYears, 0);
});

test("deleted experience should not contribute to trainer experience", () => {
    const result = calculateTrainerExperience({
        evidenceRecords: [
            createExperienceEvidence({
                isDeleted: true,
            }),
        ],
        now: NOW,
    });

    assert.equal(result.professionalExperienceYears, 0);
});

// --------------------------------------------------
// 10. Default configuration
// --------------------------------------------------

test("default configuration should contain all expected settings", () => {
    assert.equal(DEFAULT_EVIDENCE_CONFIG.halfLifeYears, 3);
    assert.equal(DEFAULT_EVIDENCE_CONFIG.diminishingReturnFactor, 0.7);

    assert.deepEqual(DEFAULT_EVIDENCE_CONFIG.trustWeights, {
        verified: 1,
        self_reported: 0.5,
    });

    assert.deepEqual(DEFAULT_EVIDENCE_CONFIG.baseScores, {
        qualification: 2,
        certification: 3,
        experience: 0.5,
        teaching: 0.5,
        assessment: 5,
    });

    assert.deepEqual(DEFAULT_EVIDENCE_CONFIG.maximumScores, {
        experience: 5,
        teaching: 3,
        assessment: 5,
    });
});

test("getDefaultEvidenceConfig should return an independent configuration", () => {
    const first = getDefaultEvidenceConfig();
    const second = getDefaultEvidenceConfig();

    assert.notEqual(first, second);
    assert.notEqual(first.trustWeights, second.trustWeights);
    assert.notEqual(first.baseScores, second.baseScores);
    assert.notEqual(first.maximumScores, second.maximumScores);

    first.trustWeights.verified = 0.25;

    assert.equal(second.trustWeights.verified, 1);
    assert.equal(DEFAULT_EVIDENCE_CONFIG.trustWeights.verified, 1);
});

// --------------------------------------------------
// 11. Complete trainer evidence summary
// --------------------------------------------------

test("trainer summary should contain the complete expected structure", () => {
    const evidenceRecords = [
        createEvidence({
            _id: "evidence-001",
        }),
    ];

    const result = calculateTrainerEvidenceSummary({
        evidenceRecords,
        now: NOW,
    });

    assert.ok(result.generatedAt instanceof Date);

    assert.deepEqual(
        Object.keys(result.evidenceStats),
        [
            "total",
            "eligible",
            "verified",
            "selfReported",
            "rejected",
            "excluded",
        ],
    );

    assert.ok(result.experience);
    assert.ok(Array.isArray(result.competencies));
    assert.ok(Array.isArray(result.skills));
    assert.ok(Array.isArray(result.evidenceContributions));
});

test("trainer summary should calculate evidence statistics correctly", () => {
    const evidenceRecords = [
        createEvidence({
            _id: "evidence-001",
            verification: { status: "verified" },
        }),
        createEvidence({
            _id: "evidence-002",
            verification: { status: "self_reported" },
        }),
        createEvidence({
            _id: "evidence-003",
            verification: { status: "rejected" },
        }),
        createEvidence({
            _id: "evidence-004",
            isDeleted: true,
        }),
        createEvidence({
            _id: "evidence-005",
            supersededBy: "evidence-006",
        }),
    ];

    const result = calculateTrainerEvidenceSummary({
        evidenceRecords,
        now: NOW,
    });

    assert.deepEqual(result.evidenceStats, {
        total: 5,
        eligible: 2,
        verified: 1,
        selfReported: 1,
        rejected: 1,
        excluded: 3,
    });
});

test("trainer summary should calculate competency scores and evidence counts", () => {
    const evidenceRecords = [
        createEvidence({
            _id: "evidence-001",
            verification: { status: "verified" },
        }),
        createEvidence({
            _id: "evidence-002",
            verification: { status: "self_reported" },
        }),
    ];

    const result = calculateTrainerEvidenceSummary({
        evidenceRecords,
        now: NOW,
    });

    assert.equal(result.competencies.length, 1);

    const competency = result.competencies[0];

    assert.equal(competency.id, COMPETENCY_ID);
    assert.equal(competency.contributionsCount, 2);
    assert.equal(competency.verifiedEvidenceCount, 1);
    assert.equal(competency.selfReportedEvidenceCount, 1);

    assert.deepEqual(
        competency.evidenceIds,
        ["evidence-001", "evidence-002"],
    );

    // 2 points from verified evidence and 1 from self-reported evidence.
    // Diminishing returns: 2 + (1 * 0.7) = 2.7.
    assert.equal(competency.score, 2.7);
});

test("trainer summary should aggregate competency and skill references", () => {
    const evidenceRecords = [
        createEvidence({
            _id: "evidence-001",
            competencies: [
                COMPETENCY_ID,
                SECOND_COMPETENCY_ID,
            ],
            skills: [
                SKILL_ID,
                SECOND_SKILL_ID,
            ],
        }),
    ];

    const result = calculateTrainerEvidenceSummary({
        evidenceRecords,
        now: NOW,
    });

    assert.deepEqual(
        result.competencies.map((item) => item.id).sort(),
        [COMPETENCY_ID, SECOND_COMPETENCY_ID].sort(),
    );

    assert.deepEqual(
        result.skills.map((item) => item.id).sort(),
        [SKILL_ID, SECOND_SKILL_ID].sort(),
    );
});

test("trainer summary should calculate professional and teaching experience", () => {
    const evidenceRecords = [
        createExperienceEvidence({
            _id: "experience-001",
        }),
        createTeachingEvidence({
            _id: "teaching-001",
        }),
    ];

    const result = calculateTrainerEvidenceSummary({
        evidenceRecords,
        now: NOW,
    });

    assertApproximatelyEqual(
        result.experience.professionalExperienceYears,
        4,
    );

    assertApproximatelyEqual(
        result.experience.teachingExperienceYears,
        1.998631,
        0.00001,
    );
});

test("trainer summary should include eligible evidence contributions", () => {
    const evidenceRecords = [
        createEvidence({
            _id: "evidence-001",
        }),
        createEvidence({
            _id: "evidence-002",
            verification: {
                status: "self_reported",
            },
        }),
        createEvidence({
            _id: "evidence-003",
            verification: {
                status: "rejected",
            },
        }),
    ];

    const result = calculateTrainerEvidenceSummary({
        evidenceRecords,
        now: NOW,
    });

    assert.equal(result.evidenceContributions.length, 2);

    assert.deepEqual(
        result.evidenceContributions.map(
            (item) => item.evidenceId,
        ),
        ["evidence-001", "evidence-002"],
    );
});

test("trainer summary should exclude rejected, deleted and superseded evidence from scores", () => {
    const evidenceRecords = [
        createEvidence({
            _id: "evidence-001",
        }),
        createEvidence({
            _id: "evidence-002",
            verification: {
                status: "rejected",
            },
        }),
        createEvidence({
            _id: "evidence-003",
            isDeleted: true,
        }),
        createEvidence({
            _id: "evidence-004",
            supersededBy: "evidence-005",
        }),
    ];

    const result = calculateTrainerEvidenceSummary({
        evidenceRecords,
        now: NOW,
    });

    assert.equal(result.evidenceStats.eligible, 1);
    assert.equal(result.evidenceContributions.length, 1);
    assert.equal(result.competencies.length, 1);
    assert.equal(result.competencies[0].contributionsCount, 1);
});

test("trainer summary should throw when the reference date is invalid", () => {
    assert.throws(
        () => calculateTrainerEvidenceSummary({
            evidenceRecords: [],
            now: "invalid-date",
        }),
        {
            name: "TypeError",
            message: "A valid reference date must be provided.",
        },
    );
});

test("empty evidence should produce an empty summary", () => {
    const result = calculateTrainerEvidenceSummary({
        evidenceRecords: [],
        now: NOW,
    });

    assert.deepEqual(result.evidenceStats, {
        total: 0,
        eligible: 0,
        verified: 0,
        selfReported: 0,
        rejected: 0,
        excluded: 0,
    });

    assert.deepEqual(result.competencies, []);
    assert.deepEqual(result.skills, []);
    assert.deepEqual(result.evidenceContributions, []);

    assert.equal(
        result.experience.professionalExperienceYears,
        0,
    );

    assert.equal(
        result.experience.teachingExperienceYears,
        0,
    );
});


// --------------------------------------------------
// 12. Evidence reference and aggregation edge cases
// --------------------------------------------------

test("multiple evidence records for the same competency should aggregate correctly", () => {
    const evidenceRecords = [
        createEvidence({
            _id: "evidence-001",
        }),
        createEvidence({
            _id: "evidence-002",
        }),
        createEvidence({
            _id: "evidence-003",
        }),
    ];

    const result = calculateTrainerEvidenceSummary({
        evidenceRecords,
        now: NOW,
    });

    assert.equal(result.competencies.length, 1);
    assert.equal(result.competencies[0].contributionsCount, 3);
    assert.equal(result.competencies[0].verifiedEvidenceCount, 3);
    assert.deepEqual(
        result.competencies[0].evidenceIds,
        ["evidence-001", "evidence-002", "evidence-003"],
    );
});

test("evidence referencing multiple competencies should contribute to each competency", () => {
    const evidenceRecords = [
        createEvidence({
            competencies: [
                COMPETENCY_ID,
                SECOND_COMPETENCY_ID,
            ],
        }),
    ];

    const result = calculateTrainerEvidenceSummary({
        evidenceRecords,
        now: NOW,
    });

    assert.equal(result.competencies.length, 2);

    for (const competency of result.competencies) {
        assert.equal(competency.contributionsCount, 1);
        assert.equal(competency.score, 2);
    }
});

test("evidence without competency or skill references should not create target summaries", () => {
    const evidenceRecords = [
        createEvidence({
            competencies: [],
            skills: [],
        }),
    ];

    const result = calculateTrainerEvidenceSummary({
        evidenceRecords,
        now: NOW,
    });

    assert.deepEqual(result.competencies, []);
    assert.deepEqual(result.skills, []);

    // Evidence can still contribute to the overall evidence statistics.
    assert.equal(result.evidenceStats.eligible, 1);
    assert.equal(result.evidenceContributions.length, 1);
});

// --------------------------------------------------
// 13. Missing and malformed dates
// --------------------------------------------------

test("experience evidence with missing start date should contribute zero experience", () => {
    const result = calculateEvidenceBaseScore(
        createExperienceEvidence({
            details: {
                endDate: NOW,
                isOngoing: false,
            },
        }),
        NOW,
    );

    assert.equal(result, 0);
});

test("teaching evidence with missing teaching dates should contribute zero experience", () => {
    const result = calculateEvidenceBaseScore(
        createTeachingEvidence({
            details: {},
        }),
        NOW,
    );

    assert.equal(result, 0);
});

test("experience evidence with invalid dates should contribute zero experience", () => {
    const result = calculateEvidenceBaseScore(
        createExperienceEvidence({
            details: {
                startDate: "invalid-date",
                endDate: NOW,
                isOngoing: false,
            },
        }),
        NOW,
    );

    assert.equal(result, 0);
});

test("qualification evidence without a valid reference date should have zero contribution", () => {
    const result = calculateEvidenceContribution(
        createEvidence({
            createdAt: undefined,
            details: {
                issuedAt: "invalid-date",
            },
        }),
        NOW,
    );

    assert.equal(result.eligible, true);
    assert.equal(result.ageDecay, 0);
    assert.equal(result.score, 0);
});

test("future professional experience start date should not contribute experience", () => {
    const result = calculateEvidenceBaseScore(
        createExperienceEvidence({
            details: {
                startDate: new Date("2027-01-01"),
                endDate: NOW,
                isOngoing: false,
            },
        }),
        NOW,
    );

    assert.equal(result, 0);
});

test("future teaching experience start date should not contribute experience", () => {
    const result = calculateEvidenceBaseScore(
        createTeachingEvidence({
            details: {
                teachingStartDate: new Date("2027-01-01"),
                teachingEndDate: NOW,
                isTeachingOngoing: false,
            },
        }),
        NOW,
    );

    assert.equal(result, 0);
});

// --------------------------------------------------
// 14. Certification expiry boundaries
// --------------------------------------------------

test("certification expiring exactly on the current date should retain its base score", () => {
    const result = calculateEvidenceBaseScore(
        createEvidence({
            type: "certification",
            details: {
                expiresAt: NOW,
            },
        }),
        NOW,
    );

    assert.equal(result, 3);
});

test("certification expiring before the current date should have zero contribution", () => {
    const result = calculateEvidenceContribution(
        createEvidence({
            type: "certification",
            details: {
                issuedAt: new Date("2024-01-01"),
                expiresAt: new Date("2026-11-02"),
            },
        }),
        NOW,
    );

    assert.equal(result.eligible, true);
    assert.equal(result.baseScore, 0);
    assert.equal(result.score, 0);
});

// --------------------------------------------------
// 15. Overlapping experience with different trust levels
// --------------------------------------------------

test("overlapping verified and self-reported experience should not double-count duration", () => {
    const sharedPeriod = {
        startDate: new Date("2020-01-01"),
        endDate: new Date("2023-01-01"),
        isOngoing: false,
    };

    const evidenceRecords = [
        createExperienceEvidence({
            _id: "experience-001",
            details: sharedPeriod,
            verification: {
                status: "verified",
            },
        }),
        createExperienceEvidence({
            _id: "experience-002",
            details: sharedPeriod,
            verification: {
                status: "self_reported",
            },
        }),
    ];

    const result = calculateTrainerExperience({
        evidenceRecords,
        now: NOW,
    });

    assertApproximatelyEqual(
        result.professionalExperienceYears,
        3.000684,
        0.00001,
    );
});

test("rejected overlapping experience should not affect total experience", () => {
    const evidenceRecords = [
        createExperienceEvidence({
            _id: "experience-001",
            details: {
                startDate: new Date("2020-01-01"),
                endDate: new Date("2022-01-01"),
                isOngoing: false,
            },
        }),
        createExperienceEvidence({
            _id: "experience-002",
            details: {
                startDate: new Date("2020-01-01"),
                endDate: new Date("2025-01-01"),
                isOngoing: false,
            },
            verification: {
                status: "rejected",
            },
        }),
    ];

    const result = calculateTrainerExperience({
        evidenceRecords,
        now: NOW,
    });

    assertApproximatelyEqual(
        result.professionalExperienceYears,
        2.002,
    );
});

// --------------------------------------------------
// 16. Custom scoring configuration
// --------------------------------------------------

test("custom scoring configuration should affect competency scores", () => {
    const config = getDefaultEvidenceConfig();

    config.baseScores.qualification = 4;

    const result = calculateTrainerEvidenceSummary({
        evidenceRecords: [
            createEvidence(),
        ],
        now: NOW,
        config,
    });

    assert.equal(result.competencies[0].score, 4);
});

test("custom diminishing return factor should affect aggregated scores", () => {
    const config = getDefaultEvidenceConfig();

    config.diminishingReturnFactor = 0.5;

    const result = calculateTrainerEvidenceSummary({
        evidenceRecords: [
            createEvidence({
                _id: "evidence-001",
            }),
            createEvidence({
                _id: "evidence-002",
            }),
        ],
        now: NOW,
        config,
    });

    // 2 + (2 * 0.5) = 3
    assert.equal(result.competencies[0].score, 3);
});

// --------------------------------------------------
// 17. Calculation consistency
// --------------------------------------------------

test("competency score should remain consistent when evidence input order changes", () => {
    const firstEvidence = createEvidence({
        _id: "evidence-001",
    });

    const secondEvidence = createEvidence({
        _id: "evidence-002",
        verification: {
            status: "self_reported",
        },
    });

    const firstResult = calculateTrainerEvidenceSummary({
        evidenceRecords: [
            firstEvidence,
            secondEvidence,
        ],
        now: NOW,
    });

    const secondResult = calculateTrainerEvidenceSummary({
        evidenceRecords: [
            secondEvidence,
            firstEvidence,
        ],
        now: NOW,
    });

    assert.equal(
        firstResult.competencies[0].score,
        secondResult.competencies[0].score,
    );
});

test("competency and skill summaries should be consistently ordered by ID", () => {
    const evidenceRecords = [
        createEvidence({
            _id: "evidence-001",
            competencies: [
                SECOND_COMPETENCY_ID,
                COMPETENCY_ID,
            ],
            skills: [
                SECOND_SKILL_ID,
                SKILL_ID,
            ],
        }),
    ];

    const result = calculateTrainerEvidenceSummary({
        evidenceRecords,
        now: NOW,
    });

    assert.deepEqual(
        result.competencies.map((item) => item.id),
        [COMPETENCY_ID, SECOND_COMPETENCY_ID],
    );

    assert.deepEqual(
        result.skills.map((item) => item.id),
        [SKILL_ID, SECOND_SKILL_ID],
    );
});

// --------------------------------------------------
// Proficiency level resolver
// --------------------------------------------------

test("should assign beginner below intermediate threshold", () => {
    assert.deepEqual(
        resolveCompetencyLevel(2.999),
        {
            level: "beginner",
            levelNum: 1
        }
    );
});

test("should assign intermediate at exactly 3 points", () => {
    assert.deepEqual(
        resolveCompetencyLevel(3),
        {
            level: "intermediate",
            levelNum: 2
        }
    );
});

test("should assign advanced at exactly 6 points", () => {
    assert.deepEqual(
        resolveCompetencyLevel(6),
        {
            level: "advanced",
            levelNum: 3
        }
    );
});

test("should assign expert at exactly 9 points", () => {
    assert.deepEqual(
        resolveCompetencyLevel(9),
        {
            level: "expert",
            levelNum: 4
        }
    );
});

test("should round points to three decimals before comparison", () => {
    assert.deepEqual(
        resolveCompetencyLevel(2.9996),
        {
            level: "intermediate",
            levelNum: 2
        }
    );
});

test("should support custom proficiency thresholds", () => {
    assert.deepEqual(
        resolveCompetencyLevel(5, {
            intermediate: 2,
            advanced: 4,
            expert: 8
        }),
        {
            level: "advanced",
            levelNum: 3
        }
    );
});

test("should reject negative competency points", () => {
    assert.throws(
        () => resolveCompetencyLevel(-1),
        TypeError
    );
});

test("should reject non-finite competency points", () => {
    assert.throws(
        () => resolveCompetencyLevel(Infinity),
        TypeError
    );
});

test("should reject missing proficiency thresholds", () => {
    assert.throws(
        () => resolveCompetencyLevel(5, null),
        TypeError
    );
});

test("should reject unordered proficiency thresholds", () => {
    assert.throws(
        () => resolveCompetencyLevel(5, {
            intermediate: 6,
            advanced: 3,
            expert: 9
        }),
        TypeError
    );
});

test("should reject equal proficiency thresholds", () => {
    assert.throws(
        () => resolveCompetencyLevel(5, {
            intermediate: 3,
            advanced: 3,
            expert: 9
        }),
        TypeError
    );
});

test("should reject non-finite proficiency thresholds", () => {
    assert.throws(
        () => resolveCompetencyLevel(5, {
            intermediate: 3,
            advanced: Infinity,
            expert: 9
        }),
        TypeError
    );
});

test("golden test should calculate 3.44 points and intermediate proficiency", () => {
    const YEAR_IN_MILLISECONDS =
        365.25 * 24 * 60 * 60 * 1000;

    const oneYearAgo = new Date(
        NOW.getTime() - YEAR_IN_MILLISECONDS
    );

    const threeYearsAgo = new Date(
        NOW.getTime() - (3 * YEAR_IN_MILLISECONDS)
    );

    const fiveYearsAgo = new Date(
        NOW.getTime() - (5 * YEAR_IN_MILLISECONDS)
    );

    const evidenceRecords = [
        createEvidence({
            _id: "golden-qualification",
            type: "qualification",
            details: {
                issuedAt: NOW
            }
        }),

        createEvidence({
            _id: "golden-certification",
            type: "certification",
            details: {
                issuedAt: threeYearsAgo,
                expiresAt: null
            }
        }),

        createExperienceEvidence({
            _id: "golden-experience",
            verification: {
                status: "self_reported"
            },
            details: {
                startDate: fiveYearsAgo,
                endDate: oneYearAgo,
                isOngoing: false
            }
        })
    ];

    const result = calculateTrainerEvidenceSummary({
        evidenceRecords,
        now: NOW
    });

    assert.equal(result.competencies.length, 1);

    assertApproximatelyEqual(
        result.competencies[0].score,
        3.44,
        0.01
    );

    assert.deepEqual(
        resolveCompetencyLevel(result.competencies[0].score),
        {
            level: "intermediate",
            levelNum: 2
        }
    );
});

test("complete evidence summary should remain deterministic when input order changes", () => {
    const firstEvidence = createEvidence({
        _id: "evidence-001"
    });

    const secondEvidence = createEvidence({
        _id: "evidence-002",
        verification: {
            status: "self_reported"
        }
    });

    const thirdEvidence = createEvidence({
        _id: "evidence-003",
        type: "certification",
        details: {
            issuedAt: new Date("2025-11-03T00:00:00.000Z")
        }
    });

    const firstResult = calculateTrainerEvidenceSummary({
        evidenceRecords: [
            firstEvidence,
            secondEvidence,
            thirdEvidence
        ],
        now: NOW
    });

    const secondResult = calculateTrainerEvidenceSummary({
        evidenceRecords: [
            thirdEvidence,
            firstEvidence,
            secondEvidence
        ],
        now: NOW
    });

    assert.deepEqual(
        firstResult.competencies,
        secondResult.competencies
    );

    assert.deepEqual(
        firstResult.skills,
        secondResult.skills
    );

    assert.deepEqual(
        firstResult.evidenceContributions,
        secondResult.evidenceContributions
    );
});

test("malformed competency and skill references should not create target summaries", () => {
    const evidence = createEvidence({
        competencies: [
            {},
            null,
            ""
        ],
        skills: [
            {},
            null,
            ""
        ]
    });

    const result = calculateTrainerEvidenceSummary({
        evidenceRecords: [evidence],
        now: NOW
    });

    assert.deepEqual(result.competencies, []);
    assert.deepEqual(result.skills, []);
});

test("malformed evidence IDs should not become object strings", () => {
    const evidence = createEvidence({
        _id: {}
    });

    const result = calculateTrainerEvidenceSummary({
        evidenceRecords: [evidence],
        now: NOW
    });

    assert.equal(
        result.evidenceContributions[0].evidenceId,
        null
    );
});


// --------------------------------------------------
// 18. Individual experience and teaching contributions
// --------------------------------------------------

test("overlapping experience records should contribute individually to competency scores", () => {
    const sharedPeriod = {
        startDate: new Date("2022-11-03"),
        endDate: NOW,
        isOngoing: false,
    };

    const evidenceRecords = [
        createExperienceEvidence({
            _id: "experience-verified",
            details: sharedPeriod,
            verification: { status: "verified" },
        }),
        createExperienceEvidence({
            _id: "experience-self-reported",
            details: sharedPeriod,
            verification: { status: "self_reported" },
        }),
    ];

    const result = calculateTrainerEvidenceSummary({
        evidenceRecords,
        now: NOW,
    });

    // Each record has its own duration-based contribution.
    // The verified contribution is 2 points.
    // The self-reported contribution is 1 point.
    // Diminishing returns: 2 + (1 * 0.7) = 2.7.
    assert.equal(result.competencies[0].score, 2.7);
});

test("teaching evidence should contribute individually with its own trust weight", () => {
    const sharedPeriod = {
        teachingStartDate: new Date("2024-11-03"),
        teachingEndDate: NOW,
        isTeachingOngoing: false,
    };

    const evidenceRecords = [
        createTeachingEvidence({
            _id: "teaching-verified",
            details: sharedPeriod,
            verification: { status: "verified" },
        }),
        createTeachingEvidence({
            _id: "teaching-self-reported",
            details: sharedPeriod,
            verification: { status: "self_reported" },
        }),
    ];

    const result = calculateTrainerEvidenceSummary({
        evidenceRecords,
        now: NOW,
    });

    // Each record contributes approximately:
    // Verified: 1 point.
    // Self-reported: 0.5 points.
    // Diminishing returns: 1 + (0.5 * 0.7) = 1.35.
    assertApproximatelyEqual(
        result.competencies[0].score,
        1.35,
    );
});

test("experience evidence should apply age decay to each record individually", () => {
    const threeYearsAgo = new Date(
        NOW.getTime() -
        (3 * 365.25 * 24 * 60 * 60 * 1000),
    );

    const evidence = createExperienceEvidence({
        _id: "old-experience",
        details: {
            startDate: new Date(
                threeYearsAgo.getTime() -
                (2 * 365.25 * 24 * 60 * 60 * 1000),
            ),
            endDate: threeYearsAgo,
            isOngoing: false,
        },
    });

    const result = calculateTrainerEvidenceSummary({
        evidenceRecords: [evidence],
        now: NOW,
    });

    // Two years * 0.5 = 1 base point.
    // Three years of age gives 0.5 decay.
    assertApproximatelyEqual(
        result.competencies[0].score,
        0.5,
    );
});

// --------------------------------------------------
// 19. Trust-weighted experience statistics
// --------------------------------------------------

test("self-reported experience should count at its configured trust weight", () => {
    const evidence = createExperienceEvidence({
        _id: "self-reported-experience",
        verification: { status: "self_reported" },
    });

    const result = calculateTrainerExperience({
        evidenceRecords: [evidence],
        now: NOW,
    });

    // Four years * 0.5 trust = two weighted years.
    assertApproximatelyEqual(
        result.professionalExperienceYears,
        2,
    );
});

test("overlapping verified and self-reported periods should use the highest trust per period", () => {
    const sharedPeriod = {
        startDate: new Date("2020-01-01"),
        endDate: new Date("2023-01-01"),
        isOngoing: false,
    };

    const evidenceRecords = [
        createExperienceEvidence({
            _id: "verified-experience",
            details: sharedPeriod,
            verification: { status: "verified" },
        }),
        createExperienceEvidence({
            _id: "self-reported-experience",
            details: sharedPeriod,
            verification: { status: "self_reported" },
        }),
    ];

    const result = calculateTrainerExperience({
        evidenceRecords,
        now: NOW,
    });

    // The same period is counted once, at verified trust (1.0).
    assertApproximatelyEqual(
        result.professionalExperienceYears,
        3.000684,
        0.00001,
    );
});
