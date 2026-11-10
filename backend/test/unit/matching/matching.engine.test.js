import test from "node:test";
import assert from "node:assert/strict";

import {
    isEvidenceEligible,
    getEvidenceTrust,
    calculateSkillEvidenceScore,
    calculateCompetencyScore,
    calculateDurationScore,
    calculateWeightedScore,
    evaluateTrainerMatch,
    rankTrainerMatches
} from "../../../src/modules/matching/matching.engine.js";

const referenceDate = new Date("2026-11-03T00:00:00.000Z");

const evidenceRules = {
    verifiedTrust: 1,
    selfReportedTrust: 0.5,
    halfLifeYears: 3,
    diminishingReturnFactor: 0.7
};

const config = {
    weights: {
        competency: 0.3,
        skills: 0.25,
        qualification: 0.15,
        experience: 0.15,
        teaching: 0.1,
        certification: 0.05
    },
    thresholds: {
        strong: 0.8,
        partial: 0.5
    },
    evidenceRules
};

const createEvidence = (overrides = {}) => ({
    _id: "evidence-1",
    type: "qualification",
    title: "Bachelor of Computer Science",
    description: "",
    details: {
        qualificationName: "Bachelor of Computer Science",
        institution: "Test University",
        fieldOfStudy: "Computer Science"
    },
    competencies: [],
    skills: [],
    verification: {
        status: "verified"
    },
    isDeleted: false,
    supersededBy: null,
    ...overrides
});

const createTrainerProfile = (overrides = {}) => ({
    _id: "profile-1",
    user: "trainer-1",
    competencySummary: [],
    skills: [],
    evidenceStats: {
        total: 2,
        verified: 2,
        verifiedRatio: 1,
        latestEvidenceAt: referenceDate
    },
    experience: {
        industryYears: 5,
        teachingYears: 3
    },
    availability: {
        status: "available",
        activeTrainings: 1,
        maxConcurrentTrainings: 3
    },
    completion: {
        profileCompletedAt: new Date("2026-01-01")
    },
    ...overrides
});

const createRequirement = (overrides = {}) => ({
    competencies: [],
    requiredSkills: [],
    qualificationKeywords: [],
    qualificationMustHave: false,
    requiredCertifications: [],
    minimumExperienceYears: 0,
    minimumTeachingYears: 0,
    ...overrides
});

const createConfig = (overrides = {}) => ({
    ...config,
    ...overrides
});

/* -------------------------------------------------------------------------- */
/* Evidence eligibility                                                       */
/* -------------------------------------------------------------------------- */

test("accepts verified evidence", () => {
    assert.equal(isEvidenceEligible(createEvidence(), referenceDate), true);
});

test("accepts self-reported evidence", () => {
    assert.equal(
        isEvidenceEligible(
            createEvidence({
                verification: { status: "self_reported" }
            }),
            referenceDate
        ),
        true
    );
});

test("rejects rejected evidence", () => {
    assert.equal(
        isEvidenceEligible(
            createEvidence({
                verification: { status: "rejected" }
            }),
            referenceDate
        ),
        false
    );
});

test("rejects deleted evidence", () => {
    assert.equal(
        isEvidenceEligible(createEvidence({ isDeleted: true }), referenceDate),
        false
    );
});

test("rejects superseded evidence", () => {
    assert.equal(
        isEvidenceEligible(
            createEvidence({ supersededBy: "replacement-evidence" }),
            referenceDate
        ),
        false
    );
});

test("rejects expired certification evidence", () => {
    assert.equal(
        isEvidenceEligible(
            createEvidence({
                type: "certification",
                details: {
                    certificateName: "AWS Certified Developer",
                    expiresAt: new Date("2026-01-01")
                }
            }),
            referenceDate
        ),
        false
    );
});

test("accepts certification evidence that has not expired", () => {
    assert.equal(
        isEvidenceEligible(
            createEvidence({
                type: "certification",
                details: {
                    certificateName: "AWS Certified Developer",
                    expiresAt: new Date("2027-01-01")
                }
            }),
            referenceDate
        ),
        true
    );
});

/* -------------------------------------------------------------------------- */
/* Evidence trust                                                             */
/* -------------------------------------------------------------------------- */

test("assigns full trust to verified evidence", () => {
    assert.equal(getEvidenceTrust(createEvidence(), evidenceRules), 1);
});

test("assigns reduced trust to self-reported evidence", () => {
    assert.equal(
        getEvidenceTrust(
            createEvidence({
                verification: { status: "self_reported" }
            }),
            evidenceRules
        ),
        0.5
    );
});

test("assigns zero trust to rejected evidence", () => {
    assert.equal(
        getEvidenceTrust(
            createEvidence({
                verification: { status: "rejected" }
            }),
            evidenceRules
        ),
        0
    );
});

/* -------------------------------------------------------------------------- */
/* Skill scoring                                                              */
/* -------------------------------------------------------------------------- */

test("calculates full skill evidence score for verified evidence", () => {
    const result = calculateSkillEvidenceScore(
        "skill-1",
        [createEvidence({ skills: ["skill-1"] })],
        evidenceRules,
        referenceDate
    );

    assert.equal(result.score, 1);
    assert.equal(result.matched, true);
    assert.equal(result.provisional, false);
});

test("calculates reduced skill evidence score for self-reported evidence", () => {
    const result = calculateSkillEvidenceScore(
        "skill-1",
        [
            createEvidence({
                skills: ["skill-1"],
                verification: { status: "self_reported" }
            })
        ],
        evidenceRules,
        referenceDate
    );

    assert.equal(result.score, 0.5);
    assert.equal(result.matched, true);
    assert.equal(result.provisional, true);
});

test("returns zero when no supporting skill evidence exists", () => {
    const result = calculateSkillEvidenceScore(
        "skill-1",
        [],
        evidenceRules,
        referenceDate
    );

    assert.equal(result.score, 0);
    assert.equal(result.matched, false);
    assert.equal(result.provisional, false);
});

test("uses the strongest eligible evidence for a skill", () => {
    const evidence = [
        createEvidence({
            skills: ["skill-1"],
            verification: { status: "self_reported" }
        }),
        createEvidence({
            _id: "evidence-2",
            skills: ["skill-1"],
            verification: { status: "verified" }
        })
    ];

    const result = calculateSkillEvidenceScore(
        "skill-1",
        evidence,
        evidenceRules,
        referenceDate
    );

    assert.equal(result.score, 1);
    assert.equal(result.provisional, false);
});

/* -------------------------------------------------------------------------- */
/* Competency scoring                                                         */
/* -------------------------------------------------------------------------- */

test("calculates full competency score when required level and verified evidence are present", () => {
    const result = calculateCompetencyScore(
        [
            {
                competency: "competency-1",
                minLevel: 3,
                weight: 1,
                mustHave: true
            }
        ],
        [
            {
                competency: "competency-1",
                levelNum: 3
            }
        ],
        [
            createEvidence({
                type: "experience",
                competencies: ["competency-1"],
                verification: { status: "verified" }
            })
        ],
        evidenceRules,
        referenceDate
    );

    assert.equal(result.score, 1);
    assert.equal(result.gaps.length, 0);
    assert.equal(result.failedMustHave.length, 0);
});

test("calculates partial competency score when required level is not met", () => {
    const result = calculateCompetencyScore(
        [
            {
                competency: "competency-1",
                minLevel: 4,
                weight: 1,
                mustHave: false
            }
        ],
        [
            {
                competency: "competency-1",
                levelNum: 2
            }
        ],
        [],
        evidenceRules,
        referenceDate
    );

    assert.equal(result.score, 0.5);
    assert.equal(result.gaps.length, 1);
    assert.equal(result.failedMustHave.length, 0);
});

test("fails a mandatory competency when the required level is not met", () => {
    const result = calculateCompetencyScore(
        [
            {
                competency: "competency-1",
                minLevel: 4,
                weight: 1,
                mustHave: true
            }
        ],
        [
            {
                competency: "competency-1",
                levelNum: 2
            }
        ],
        [],
        evidenceRules,
        referenceDate
    );

    assert.equal(result.failedMustHave.length, 1);
    assert.equal(result.failedMustHave[0], "competency:competency-1");
});

test("fails a mandatory competency when only self-reported evidence exists", () => {
    const result = calculateCompetencyScore(
        [
            {
                competency: "competency-1",
                minLevel: 3,
                weight: 1,
                mustHave: true
            }
        ],
        [
            {
                competency: "competency-1",
                levelNum: 3
            }
        ],
        [
            createEvidence({
                type: "experience",
                competencies: ["competency-1"],
                verification: { status: "self_reported" }
            })
        ],
        evidenceRules,
        referenceDate
    );

    assert.equal(result.score, 1);
    assert.equal(result.provisional, true);
    assert.equal(result.failedMustHave.length, 1);
});

test("returns null competency score when no competencies are required", () => {
    const result = calculateCompetencyScore(
        [],
        [],
        [],
        evidenceRules,
        referenceDate
    );

    assert.equal(result.score, null);
});

/* -------------------------------------------------------------------------- */
/* Duration scoring                                                           */
/* -------------------------------------------------------------------------- */

test("calculates full duration score when minimum is met", () => {
    assert.equal(calculateDurationScore(5, 3), 1);
});

test("calculates partial duration score when minimum is not met", () => {
    assert.equal(calculateDurationScore(2, 4), 0.5);
});

test("returns zero when no experience is available", () => {
    assert.equal(calculateDurationScore(0, 3), 0);
});

test("excludes duration factor when no minimum is required", () => {
    assert.equal(calculateDurationScore(5, 0), null);
});

/* -------------------------------------------------------------------------- */
/* Weighted scoring                                                           */
/* -------------------------------------------------------------------------- */

test("normalizes applicable matching weights", () => {
    const score = calculateWeightedScore(
        {
            competency: 0.3,
            skills: 0.25,
            qualification: 0.15,
            experience: 0.15,
            teaching: 0.1,
            certification: 0.05
        },
        {
            competency: 1,
            skills: 0.5,
            qualification: null,
            experience: null,
            teaching: null,
            certification: null
        }
    );

    assert.ok(Math.abs(score - 0.7727272727) < 0.000001);
});

test("throws when no applicable positive-weight factors exist", () => {
    assert.throws(
        () =>
            calculateWeightedScore(
                {
                    competency: 0,
                    skills: 0,
                    qualification: 0,
                    experience: 0,
                    teaching: 0,
                    certification: 0
                },
                {
                    competency: null,
                    skills: null,
                    qualification: null,
                    experience: null,
                    teaching: null,
                    certification: null
                }
            ),
        /No applicable matching factors/
    );
});

/* -------------------------------------------------------------------------- */
/* Complete trainer evaluation                                                */
/* -------------------------------------------------------------------------- */

test("evaluates a trainer who satisfies all requirements", () => {
    const trainerProfile = createTrainerProfile({
        competencySummary: [
            {
                competency: "competency-1",
                levelNum: 4
            }
        ]
    });

    const requirement = createRequirement({
        competencies: [
            {
                competency: "competency-1",
                minLevel: 3,
                weight: 1,
                mustHave: true
            }
        ],
        minimumExperienceYears: 3,
        minimumTeachingYears: 2
    });

    const evidence = [
        createEvidence({
            type: "experience",
            competencies: ["competency-1"],
            verification: { status: "verified" }
        })
    ];

    const result = evaluateTrainerMatch({
        requirement,
        config: createConfig(),
        trainerProfile,
        evidence,
        referenceDate
    });

    assert.equal(result.score, 1);
    assert.equal(result.tier, "strong");
    assert.equal(result.meetsMandatoryRequirements, true);
    assert.equal(result.failedMustHave.length, 0);
});

test("classifies a trainer as none when a mandatory competency requirement fails", () => {
    const trainerProfile = createTrainerProfile({
        competencySummary: [
            {
                competency: "competency-1",
                levelNum: 2
            }
        ]
    });

    const requirement = createRequirement({
        competencies: [
            {
                competency: "competency-1",
                minLevel: 4,
                weight: 1,
                mustHave: true
            }
        ]
    });

    const result = evaluateTrainerMatch({
        requirement,
        config: createConfig(),
        trainerProfile,
        evidence: [],
        referenceDate
    });

    assert.equal(result.tier, "none");
    assert.equal(result.meetsMandatoryRequirements, false);
    assert.ok(result.failedMustHave.length > 0);
});

test("marks a result provisional when self-reported evidence contributes", () => {
    const result = evaluateTrainerMatch({
        requirement: createRequirement({
            qualificationKeywords: ["Computer Science"]
        }),
        config: createConfig(),
        trainerProfile: createTrainerProfile(),
        evidence: [
            createEvidence({
                verification: { status: "self_reported" }
            })
        ],
        referenceDate
    });

    assert.equal(result.provisional, true);
});

test("does not allow self-reported evidence to satisfy mandatory qualification", () => {
    const result = evaluateTrainerMatch({
        requirement: createRequirement({
            qualificationKeywords: ["Computer Science"],
            qualificationMustHave: true
        }),
        config: createConfig(),
        trainerProfile: createTrainerProfile(),
        evidence: [
            createEvidence({
                verification: { status: "self_reported" }
            })
        ],
        referenceDate
    });

    assert.equal(result.meetsMandatoryRequirements, false);
    assert.ok(result.failedMustHave.includes("qualification:mandatory"));
});

test("does not allow self-reported evidence to satisfy mandatory skill", () => {
    const result = evaluateTrainerMatch({
        requirement: createRequirement({
            requiredSkills: [
                {
                    skill: "skill-1",
                    mustHave: true
                }
            ]
        }),
        config: createConfig(),
        trainerProfile: createTrainerProfile(),
        evidence: [
            createEvidence({
                skills: ["skill-1"],
                verification: { status: "self_reported" }
            })
        ],
        referenceDate
    });

    assert.equal(result.meetsMandatoryRequirements, false);
    assert.ok(result.failedMustHave.includes("skill:skill-1"));
});

test("allows verified evidence to satisfy mandatory skill", () => {
    const result = evaluateTrainerMatch({
        requirement: createRequirement({
            requiredSkills: [
                {
                    skill: "skill-1",
                    mustHave: true
                }
            ]
        }),
        config: createConfig(),
        trainerProfile: createTrainerProfile(),
        evidence: [
            createEvidence({
                skills: ["skill-1"],
                verification: { status: "verified" }
            })
        ],
        referenceDate
    });

    assert.equal(result.meetsMandatoryRequirements, true);
    assert.equal(result.failedMustHave.length, 0);
});

test("does not allow self-reported evidence to satisfy mandatory certification", () => {
    const result = evaluateTrainerMatch({
        requirement: createRequirement({
            requiredCertifications: [
                {
                    name: "AWS Certified Developer",
                    mustHave: true
                }
            ]
        }),
        config: createConfig(),
        trainerProfile: createTrainerProfile(),
        evidence: [
            createEvidence({
                type: "certification",
                details: {
                    certificateName: "AWS Certified Developer",
                    expiresAt: new Date("2027-01-01")
                },
                verification: { status: "self_reported" }
            })
        ],
        referenceDate
    });

    assert.equal(result.meetsMandatoryRequirements, false);
    assert.ok(
        result.failedMustHave.includes("certification:aws certified developer")
    );
});

test("allows verified valid evidence to satisfy mandatory certification", () => {
    const result = evaluateTrainerMatch({
        requirement: createRequirement({
            requiredCertifications: [
                {
                    name: "AWS Certified Developer",
                    mustHave: true
                }
            ]
        }),
        config: createConfig(),
        trainerProfile: createTrainerProfile(),
        evidence: [
            createEvidence({
                type: "certification",
                details: {
                    certificateName: "AWS Certified Developer",
                    expiresAt: new Date("2027-01-01")
                },
                verification: { status: "verified" }
            })
        ],
        referenceDate
    });

    assert.equal(result.meetsMandatoryRequirements, true);
    assert.equal(result.failedMustHave.length, 0);
});

test("does not allow expired certification to satisfy a mandatory requirement", () => {
    const result = evaluateTrainerMatch({
        requirement: createRequirement({
            requiredCertifications: [
                {
                    name: "AWS Certified Developer",
                    mustHave: true
                }
            ]
        }),
        config: createConfig(),
        trainerProfile: createTrainerProfile(),
        evidence: [
            createEvidence({
                type: "certification",
                details: {
                    certificateName: "AWS Certified Developer",
                    expiresAt: new Date("2026-01-01")
                }
            })
        ],
        referenceDate
    });

    assert.equal(result.meetsMandatoryRequirements, false);
    assert.ok(result.failedMustHave.length > 0);
});

test("flags trainers who have reached their capacity", () => {
    const trainerProfile = createTrainerProfile({
        availability: {
            status: "available",
            activeTrainings: 3,
            maxConcurrentTrainings: 3
        }
    });

    const result = evaluateTrainerMatch({
        requirement: createRequirement({
            minimumExperienceYears: 2
        }),
        config: createConfig(),
        trainerProfile,
        evidence: [],
        referenceDate
    });

    assert.equal(result.atCapacity, true);
});

/* -------------------------------------------------------------------------- */
/* Ranking                                                                    */
/* -------------------------------------------------------------------------- */

test("ranks trainers by mandatory eligibility before score", () => {
    const ranked = rankTrainerMatches([
        {
            trainer: "trainer-1",
            trainerProfile: "profile-1",
            score: 0.95,
            meetsMandatoryRequirements: false
        },
        {
            trainer: "trainer-2",
            trainerProfile: "profile-2",
            score: 0.8,
            meetsMandatoryRequirements: true
        }
    ]);

    assert.equal(ranked[0].trainer, "trainer-2");
    assert.equal(ranked[1].trainer, "trainer-1");
});

test("ranks trainers by score when mandatory eligibility is equal", () => {
    const ranked = rankTrainerMatches([
        {
            trainer: "trainer-1",
            trainerProfile: "profile-1",
            score: 0.7,
            meetsMandatoryRequirements: true
        },
        {
            trainer: "trainer-2",
            trainerProfile: "profile-2",
            score: 0.9,
            meetsMandatoryRequirements: true
        }
    ]);

    assert.equal(ranked[0].trainer, "trainer-2");
    assert.equal(ranked[1].trainer, "trainer-1");
});

test("uses verified evidence ratio as a tie-breaker", () => {
    const ranked = rankTrainerMatches(
        [
            {
                trainer: "trainer-1",
                trainerProfile: "profile-1",
                score: 0.8,
                meetsMandatoryRequirements: true,
                verifiedRatio: 0.5
            },
            {
                trainer: "trainer-2",
                trainerProfile: "profile-2",
                score: 0.8,
                meetsMandatoryRequirements: true,
                verifiedRatio: 1
            }
        ],
        ["verifiedRatio"]
    );

    assert.equal(ranked[0].trainer, "trainer-2");
});

test("assigns sequential ranks after sorting", () => {
    const ranked = rankTrainerMatches([
        {
            trainer: "trainer-1",
            trainerProfile: "profile-1",
            score: 0.7,
            meetsMandatoryRequirements: true
        },
        {
            trainer: "trainer-2",
            trainerProfile: "profile-2",
            score: 0.9,
            meetsMandatoryRequirements: true
        }
    ]);

    assert.equal(ranked[0].rank, 1);
    assert.equal(ranked[1].rank, 2);
});

// --------------------------------------------------------------------------
// Mandatory criteria edge cases
// --------------------------------------------------------------------------

test("requires every mandatory competency to be satisfied", () => {
    const result = evaluateTrainerMatch({
        requirement: createRequirement({
            competencies: [
                {
                    competency: "competency-1",
                    minLevel: 3,
                    weight: 1,
                    mustHave: true
                },
                {
                    competency: "competency-2",
                    minLevel: 3,
                    weight: 1,
                    mustHave: true
                }
            ]
        }),
        config: createConfig(),
        trainerProfile: createTrainerProfile({
            competencySummary: [
                { competency: "competency-1", levelNum: 4 },
                { competency: "competency-2", levelNum: 4 }
            ]
        }),
        evidence: [
            createEvidence({
                type: "experience",
                competencies: ["competency-1"],
                verification: { status: "verified" }
            })
        ],
        referenceDate
    });

    assert.equal(result.meetsMandatoryRequirements, false);
    assert.ok(result.failedMustHave.includes("competency:competency-2"));
});

test("does not give an absent optional competency a beginner score", () => {
    const result = calculateCompetencyScore(
        [
            {
                competency: "competency-1",
                minLevel: 4,
                weight: 1,
                mustHave: false
            }
        ],
        [],
        [],
        evidenceRules,
        referenceDate
    );

    assert.equal(result.score, 0);
    assert.equal(result.failedMustHave.length, 0);
});

test("requires verified evidence for every mandatory skill", () => {
    const result = evaluateTrainerMatch({
        requirement: createRequirement({
            requiredSkills: [
                { skill: "skill-1", mustHave: true },
                { skill: "skill-2", mustHave: true }
            ]
        }),
        config: createConfig(),
        trainerProfile: createTrainerProfile(),
        evidence: [
            createEvidence({
                skills: ["skill-1"],
                verification: { status: "verified" }
            }),
            createEvidence({
                _id: "evidence-2",
                skills: ["skill-2"],
                verification: { status: "self_reported" }
            })
        ],
        referenceDate
    });

    assert.equal(result.meetsMandatoryRequirements, false);
    assert.ok(result.failedMustHave.includes("skill:skill-2"));
});

test("requires every mandatory qualification keyword to be verified", () => {
    const result = evaluateTrainerMatch({
        requirement: createRequirement({
            qualificationKeywords: [
                "Computer Science",
                "Information Technology"
            ],
            qualificationMustHave: true
        }),
        config: createConfig(),
        trainerProfile: createTrainerProfile(),
        evidence: [
            createEvidence({
                details: {
                    qualificationName: "Bachelor of Computer Science"
                },
                verification: { status: "verified" }
            })
        ],
        referenceDate
    });

    assert.equal(result.meetsMandatoryRequirements, false);
    assert.ok(result.failedMustHave.includes("qualification:mandatory"));
});

test("verified mandatory qualification passes even when verified trust is below one", () => {
    const result = evaluateTrainerMatch({
        requirement: createRequirement({
            qualificationKeywords: ["Computer Science"],
            qualificationMustHave: true
        }),
        config: createConfig({
            weights: {
                competency: 0,
                skills: 0,
                qualification: 1,
                experience: 0,
                teaching: 0,
                certification: 0
            },
            evidenceRules: {
                ...evidenceRules,
                verifiedTrust: 0.8
            }
        }),
        trainerProfile: createTrainerProfile(),
        evidence: [
            createEvidence({
                verification: { status: "verified" }
            })
        ],
        referenceDate
    });

    assert.equal(result.meetsMandatoryRequirements, true);
    assert.equal(result.failedMustHave.length, 0);
});

test("requires every mandatory certification to be valid and verified", () => {
    const result = evaluateTrainerMatch({
        requirement: createRequirement({
            requiredCertifications: [
                {
                    name: "AWS Certified Developer",
                    mustHave: true
                },
                {
                    name: "Azure Administrator",
                    mustHave: true
                }
            ]
        }),
        config: createConfig(),
        trainerProfile: createTrainerProfile(),
        evidence: [
            createEvidence({
                type: "certification",
                details: {
                    certificateName: "AWS Certified Developer",
                    expiresAt: new Date("2027-01-01")
                },
                verification: { status: "verified" }
            })
        ],
        referenceDate
    });

    assert.equal(result.meetsMandatoryRequirements, false);
    assert.ok(
        result.failedMustHave.includes("certification:azure administrator")
    );
});

test("does not classify a high-scoring trainer as eligible when a mandatory skill fails", () => {
    const result = evaluateTrainerMatch({
        requirement: createRequirement({
            requiredSkills: [{ skill: "skill-1", mustHave: true }],
            minimumExperienceYears: 5
        }),
        config: createConfig({
            weights: {
                competency: 0,
                skills: 0,
                qualification: 0,
                experience: 1,
                teaching: 0,
                certification: 0
            }
        }),
        trainerProfile: createTrainerProfile({
            experience: {
                industryYears: 10,
                teachingYears: 0
            }
        }),
        evidence: [],
        referenceDate
    });

    assert.equal(result.score, 1);
    assert.equal(result.meetsMandatoryRequirements, false);
    assert.equal(result.tier, "none");
});

test("does not fail optional qualification criteria", () => {
    const result = evaluateTrainerMatch({
        requirement: createRequirement({
            qualificationKeywords: ["Computer Science"],
            qualificationMustHave: false
        }),
        config: createConfig(),
        trainerProfile: createTrainerProfile(),
        evidence: [],
        referenceDate
    });

    // Optional qualification must not fail mandatory eligibility.
    assert.equal(result.meetsMandatoryRequirements, true);

    // Missing optional evidence contributes zero to the score.
    assert.equal(result.score, 0);

    // A zero score cannot qualify as a partial or strong match.
    assert.equal(result.tier, "none");

    assert.equal(result.failedMustHave.length, 0);
});

test("does not fail a trainer when no mandatory criteria are configured", () => {
    const result = evaluateTrainerMatch({
        requirement: createRequirement({
            qualificationKeywords: ["Computer Science"]
        }),
        config: createConfig(),
        trainerProfile: createTrainerProfile(),
        evidence: [
            createEvidence({
                verification: { status: "verified" }
            })
        ],
        referenceDate
    });

    assert.equal(result.meetsMandatoryRequirements, true);
    assert.equal(result.failedMustHave.length, 0);
});

test("treats certification as expired on its expiry date", () => {
    const evidence = createEvidence({
        type: "certification",
        details: {
            certificateName: "AWS Certified Developer",
            expiresAt: referenceDate
        }
    });

    assert.equal(isEvidenceEligible(evidence, referenceDate), false);
});

// --------------------------------------------------------------------------
// Deterministic tie-break ordering
// --------------------------------------------------------------------------

test("uses all configured tie-break criteria in the specified order", () => {
    const ranked = rankTrainerMatches(
        [
            {
                trainer: "trainer-1",
                trainerProfile: "profile-1",
                score: 0.8,
                meetsMandatoryRequirements: true,
                verifiedRatio: 0.9,
                latestEvidenceAt: new Date("2026-01-01"),
                activeTrainings: 1,
                profileCompletedAt: new Date("2026-01-01")
            },
            {
                trainer: "trainer-2",
                trainerProfile: "profile-2",
                score: 0.8,
                meetsMandatoryRequirements: true,
                verifiedRatio: 0.9,
                latestEvidenceAt: new Date("2026-10-01"),
                activeTrainings: 2,
                profileCompletedAt: new Date("2026-10-01")
            }
        ],
        ["verifiedRatio", "recency", "load", "profileCompletedAt"]
    );

    assert.equal(ranked[0].trainer, "trainer-2");
});

test("prefers a trainer with lower training load", () => {
    const ranked = rankTrainerMatches(
        [
            {
                trainer: "trainer-1",
                trainerProfile: "profile-1",
                score: 0.8,
                meetsMandatoryRequirements: true,
                activeTrainings: 3
            },
            {
                trainer: "trainer-2",
                trainerProfile: "profile-2",
                score: 0.8,
                meetsMandatoryRequirements: true,
                activeTrainings: 1
            }
        ],
        ["load"]
    );

    assert.equal(ranked[0].trainer, "trainer-2");
});

test("prefers a recently completed trainer profile", () => {
    const ranked = rankTrainerMatches(
        [
            {
                trainer: "trainer-1",
                trainerProfile: "profile-1",
                score: 0.8,
                meetsMandatoryRequirements: true,
                profileCompletedAt: new Date("2025-01-01")
            },
            {
                trainer: "trainer-2",
                trainerProfile: "profile-2",
                score: 0.8,
                meetsMandatoryRequirements: true,
                profileCompletedAt: new Date("2026-10-01")
            }
        ],
        ["profileCompletedAt"]
    );

    assert.equal(ranked[0].trainer, "trainer-2");
});

test("uses trainer profile ID as a deterministic final fallback", () => {
    const ranked = rankTrainerMatches([
        {
            trainer: "trainer-2",
            trainerProfile: "profile-2",
            score: 0.8,
            meetsMandatoryRequirements: true
        },
        {
            trainer: "trainer-1",
            trainerProfile: "profile-1",
            score: 0.8,
            meetsMandatoryRequirements: true
        }
    ]);

    assert.equal(ranked[0].trainer, "trainer-1");
    assert.equal(ranked[1].trainer, "trainer-2");
});

// --------------------------------------------------------------------------
// Trainer capacity
// --------------------------------------------------------------------------

test("flags a trainer at exact concurrent training capacity", () => {
    const result = evaluateTrainerMatch({
        requirement: createRequirement({
            minimumExperienceYears: 2
        }),
        config: createConfig(),
        trainerProfile: createTrainerProfile({
            availability: {
                status: "available",
                activeTrainings: 3,
                maxConcurrentTrainings: 3
            }
        }),
        evidence: [],
        referenceDate
    });

    assert.equal(result.atCapacity, true);
    assert.equal(result.tier, "strong");
});

test("does not flag a trainer below concurrent training capacity", () => {
    const result = evaluateTrainerMatch({
        requirement: createRequirement({
            minimumExperienceYears: 2
        }),
        config: createConfig(),
        trainerProfile: createTrainerProfile({
            availability: {
                status: "available",
                activeTrainings: 1,
                maxConcurrentTrainings: 3
            }
        }),
        evidence: [],
        referenceDate
    });

    assert.equal(result.atCapacity, false);
});

test("flags a trainer whose maximum concurrent training capacity is zero", () => {
    const result = evaluateTrainerMatch({
        requirement: createRequirement({
            minimumExperienceYears: 2
        }),
        config: createConfig(),
        trainerProfile: createTrainerProfile({
            availability: {
                status: "available",
                activeTrainings: 0,
                maxConcurrentTrainings: 0
            }
        }),
        evidence: [],
        referenceDate
    });

    assert.equal(result.atCapacity, true);
});

test("rejects certification evidence with an invalid expiry date", () => {
    assert.equal(
        isEvidenceEligible(
            createEvidence({
                type: "certification",
                details: {
                    certificateName: "AWS Certified Developer",
                    expiresAt: "not-a-date"
                }
            }),
            referenceDate
        ),
        false
    );
});

test("rejects evidence evaluation with an invalid reference date", () => {
    assert.equal(
        isEvidenceEligible(createEvidence(), new Date("not-a-date")),
        false
    );

    assert.throws(
        () =>
            evaluateTrainerMatch({
                requirement: createRequirement(),
                config: createConfig(),
                trainerProfile: createTrainerProfile(),
                referenceDate: new Date("not-a-date")
            }),
        /Reference date must be a valid Date/
    );
});

test("does not let an empty qualification keyword match every qualification", () => {
    const result = evaluateTrainerMatch({
        requirement: createRequirement({
            qualificationKeywords: [""]
        }),
        config: createConfig(),
        trainerProfile: createTrainerProfile(),
        evidence: [createEvidence()],
        referenceDate
    });

    assert.equal(result.breakdown.qualification, 0);
    assert.equal(result.provisional, false);
});

test("rejects non-finite experience values", () => {
    assert.throws(
        () => calculateDurationScore(Number.NaN, 2),
        /Experience values must be finite numbers/
    );
});

test("rejects invalid scores and weights before calculating a weighted result", () => {
    assert.throws(
        () =>
            calculateWeightedScore(
                {
                    competency: 1,
                    skills: 0,
                    qualification: 0,
                    experience: 0,
                    teaching: 0,
                    certification: 0
                },
                {
                    competency: Number.NaN
                }
            ),
        /Matching score 'competency' must be between zero and one/
    );

    assert.throws(
        () =>
            calculateWeightedScore(
                {
                    competency: Number.NaN,
                    skills: 0,
                    qualification: 0,
                    experience: 0,
                    teaching: 0,
                    certification: 0
                },
                {
                    competency: 1
                }
            ),
        /Matching weight 'competency' must be a non-negative finite number/
    );
});

test("handles empty ranking input and rejects invalid ranking criteria", () => {
    assert.deepEqual(rankTrainerMatches([]), []);

    assert.throws(
        () => rankTrainerMatches([], ["unknown"]),
        /Tie-break criteria are invalid or duplicated/
    );

    assert.throws(
        () =>
            rankTrainerMatches([
                {
                    score: Number.NaN,
                    meetsMandatoryRequirements: true
                }
            ]),
        /Matching results contain invalid scores/
    );
});
