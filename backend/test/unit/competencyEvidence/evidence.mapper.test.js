
/**
 * @file Evidence Mapper Unit Tests
 * @description Tests normalization of evidence documents
 * before they are passed to the evidence calculation engine.
 */

import test from "node:test";
import assert from "node:assert/strict";


import {
    mapEvidenceDocumentToEngineInput,
    mapEvidenceDocumentsToEngineInput,
    mapEvidenceSummaryToTrainerProfile
} from "../../../src/modules/competencyEvidence/domain/evidence.mapper.js";

const NOW = new Date("2026-11-03T00:00:00.000Z");

const createEvidence = (overrides = {}) => ({
    _id: "evidence-001",
    org: "organization-001",
    user: "user-001",
    trainerProfile: "trainer-001",
    type: "qualification",
    title: "Bachelor of Technology",
    description: "Computer Science qualification",
    competencies: ["competency-001"],
    skills: ["skill-001"],
    details: {
        qualificationName: "B.Tech",
        institution: "Example University",
        issuedAt: NOW
    },
    verification: {
        status: "verified",
        verifiedBy: "admin-001",
        verifiedAt: NOW
    },
    file: {
        originalName: "degree.pdf",
        storageProvider: "local",
        storageKey: "uploads/degree.pdf"
    },
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    supersededBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
});

test("should map all calculation-relevant evidence fields", () => {
    const evidence = createEvidence();

    const result = mapEvidenceDocumentToEngineInput(evidence);

    assert.deepStrictEqual(result, {
        _id: "evidence-001",
        type: "qualification",
        competencies: ["competency-001"],
        skills: ["skill-001"],
        details: evidence.details,
        verification: {
            status: "verified"
        },
        isDeleted: false,
        supersededBy: null,
        createdAt: NOW
    });
});

test("should preserve populated competency and skill references", () => {
    const competency = {
        _id: "competency-001",
        name: "Communication"
    };

    const skill = {
        _id: "skill-001",
        name: "Public Speaking"
    };

    const result = mapEvidenceDocumentToEngineInput(
        createEvidence({
            competencies: [competency],
            skills: [skill]
        })
    );

    assert.strictEqual(result.competencies[0], competency);
    assert.strictEqual(result.skills[0], skill);
});

test("should preserve evidence details without modifying them", () => {
    const details = {
        organizationName: "Example Company",
        designation: "Trainer",
        startDate: new Date("2022-01-01T00:00:00.000Z"),
        endDate: NOW,
        isOngoing: false
    };

    const result = mapEvidenceDocumentToEngineInput(
        createEvidence({
            type: "experience",
            details
        })
    );

    assert.strictEqual(result.details, details);
});

test("should apply defaults for missing optional fields", () => {
    const result = mapEvidenceDocumentToEngineInput({
        type: "qualification"
    });

    assert.deepStrictEqual(result, {
        _id: null,
        type: "qualification",
        competencies: [],
        skills: [],
        details: {},
        verification: {
            status: null
        },
        isDeleted: false,
        supersededBy: null,
        createdAt: null
    });
});

test("should normalize missing verification information", () => {
    const result = mapEvidenceDocumentToEngineInput(
        createEvidence({
            verification: null
        })
    );

    assert.deepStrictEqual(result.verification, {
        status: null
    });
});

test("should exclude unrelated database and file metadata", () => {
    const result = mapEvidenceDocumentToEngineInput(createEvidence());

    assert.equal("org" in result, false);
    assert.equal("user" in result, false);
    assert.equal("trainerProfile" in result, false);
    assert.equal("file" in result, false);
    assert.equal("updatedAt" in result, false);
});

test("should reject null evidence documents", () => {
    assert.throws(
        () => mapEvidenceDocumentToEngineInput(null),
        TypeError
    );
});

test("should reject array evidence documents", () => {
    assert.throws(
        () => mapEvidenceDocumentToEngineInput([]),
        TypeError
    );
});

test("should map multiple evidence documents", () => {
    const evidenceDocuments = [
        createEvidence({ _id: "evidence-001" }),
        createEvidence({
            _id: "evidence-002",
            type: "certification"
        })
    ];

    const result = mapEvidenceDocumentsToEngineInput(
        evidenceDocuments
    );

    assert.equal(result.length, 2);
    assert.equal(result[0]._id, "evidence-001");
    assert.equal(result[1]._id, "evidence-002");
});

test("should return an empty array when no evidence is provided", () => {
    assert.deepStrictEqual(
        mapEvidenceDocumentsToEngineInput(),
        []
    );
});

test("should reject non-array evidence collections", () => {
    assert.throws(
        () => mapEvidenceDocumentsToEngineInput({}),
        TypeError
    );
});


const createEvidenceSummary = (overrides = {}) => ({
    generatedAt: NOW,

    evidenceStats: {
        total: 5,
        eligible: 4,
        verified: 3,
        selfReported: 1,
        rejected: 1,
        excluded: 1
    },

    experience: {
        professionalExperienceYears: 4.5,
        teachingExperienceYears: 2
    },

    competencies: [
        {
            id: "competency-001",
            score: 9,
            contributionsCount: 3,
            verifiedEvidenceCount: 2,
            selfReportedEvidenceCount: 1,
            evidenceIds: [
                "evidence-001",
                "evidence-002",
                "evidence-003"
            ]
        }
    ],

    skills: [
        {
            id: "skill-001",
            score: 6,
            contributionsCount: 2,
            verifiedEvidenceCount: 1,
            selfReportedEvidenceCount: 1,
            evidenceIds: ["evidence-001", "evidence-002"]
        },
        {
            id: "skill-002",
            score: 1,
            contributionsCount: 1,
            verifiedEvidenceCount: 0,
            selfReportedEvidenceCount: 1,
            evidenceIds: ["evidence-003"]
        }
    ],

    evidenceContributions: [],

    ...overrides
});

test("should map competency summaries to TrainerProfile structure", () => {
    const result = mapEvidenceSummaryToTrainerProfile(
        createEvidenceSummary()
    );

    assert.deepStrictEqual(result.competencySummary, [
        {
            competency: "competency-001",
            points: 9,
            level: "expert",
            levelNum: 4,
            evidenceCount: 3,
            verifiedEvidenceCount: 2
        }
    ]);
});

test("should map skills to TrainerProfile structure", () => {
    const result = mapEvidenceSummaryToTrainerProfile(
        createEvidenceSummary()
    );

    assert.deepStrictEqual(result.skills, [
        {
            skill: "skill-001",
            verified: true,
            evidenceCount: 2
        },
        {
            skill: "skill-002",
            verified: false,
            evidenceCount: 1
        }
    ]);
});

test("should map experience statistics", () => {
    const result = mapEvidenceSummaryToTrainerProfile(
        createEvidenceSummary()
    );

    assert.deepStrictEqual(result.experience, {
        industryYears: 4.5,
        teachingYears: 2
    });
});

test("should calculate verified evidence ratio", () => {
    const result = mapEvidenceSummaryToTrainerProfile(
        createEvidenceSummary()
    );

    assert.deepStrictEqual(result.evidenceStats, {
        total: 5,
        verified: 3,
        verifiedRatio: 0.6,
        latestEvidenceAt: null
    });
});

test("should use generatedAt as competencyRecomputedAt", () => {
    const result = mapEvidenceSummaryToTrainerProfile(
        createEvidenceSummary()
    );

    assert.strictEqual(
        result.competencyRecomputedAt,
        NOW
    );
});

test("should return zero verified ratio when there is no evidence", () => {
    const result = mapEvidenceSummaryToTrainerProfile(
        createEvidenceSummary({
            evidenceStats: {
                total: 0,
                eligible: 0,
                verified: 0,
                selfReported: 0,
                rejected: 0,
                excluded: 0
            }
        })
    );

    assert.equal(result.evidenceStats.verifiedRatio, 0);
});

test("should support custom proficiency thresholds", () => {
    const result = mapEvidenceSummaryToTrainerProfile(
        createEvidenceSummary(),
        {
            proficiencyThresholds: {
                intermediate: 2,
                advanced: 5,
                expert: 8
            }
        }
    );

    assert.equal(result.competencySummary[0].level, "expert");
    assert.equal(result.competencySummary[0].levelNum, 4);
});

test("should reject missing evidence summary", () => {
    assert.throws(
        () => mapEvidenceSummaryToTrainerProfile(null),
        TypeError
    );
});

test("should reject incomplete evidence summary", () => {
    assert.throws(
        () => mapEvidenceSummaryToTrainerProfile({
            generatedAt: NOW,
            competencies: []
        }),
        TypeError
    );
});
