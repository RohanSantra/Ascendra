/**
 * Pure business logic for deterministic trainer matching.
 * This module has no database, framework or infrastructure dependencies.
 * @module matching.engine
 */

const MATCH_FACTORS = [
    "competency",
    "skills",
    "qualification",
    "experience",
    "teaching",
    "certification"
];

const EVIDENCE_STATUSES = {
    VERIFIED: "verified",
    SELF_REPORTED: "self_reported"
};

const EVIDENCE_TYPES = {
    QUALIFICATION: "qualification",
    CERTIFICATION: "certification"
};

const DEFAULT_SUGGESTIONS = {
    competency: "Improve the required competency proficiency level.",
    skill: "Submit supporting evidence for this skill.",
    qualification: "Submit a relevant qualification.",
    certification: "Submit a valid certification.",
    experience: "Gain additional relevant industry experience.",
    teaching: "Gain additional teaching experience."
};

/**
 * Converts a MongoDB ObjectId or string identifier into a string.
 *
 * @param {object|string|null} value
 * @returns {string|null}
 */
const getId = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === "object" && value._id) {
        return String(value._id);
    }
    return String(value);
};

/**
 * Normalizes text for case-insensitive matching.
 *
 * @param {string} value
 * @returns {string}
 */
const normalizeText = (value) =>
    String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

/**
 * Checks whether an evidence record can contribute to matching.
 *
 * @param {object} evidence
 * @param {Date} referenceDate
 * @returns {boolean}
 */
const isEvidenceEligible = (evidence, referenceDate) => {
    if (!evidence || typeof evidence !== "object" || evidence.isDeleted) {
        return false;
    }

    if (evidence.supersededBy) return false;

    if (
        !(referenceDate instanceof Date) ||
        Number.isNaN(referenceDate.getTime())
    ) {
        return false;
    }

    const status = evidence.verification?.status;
    if (
        status !== EVIDENCE_STATUSES.VERIFIED &&
        status !== EVIDENCE_STATUSES.SELF_REPORTED
    ) {
        return false;
    }
    if (evidence.type === EVIDENCE_TYPES.CERTIFICATION) {
        const expiryDate = evidence.details?.expiresAt;

        if (expiryDate !== null && expiryDate !== undefined) {
            const expiryTimestamp =
                expiryDate instanceof Date ||
                typeof expiryDate === "string" ||
                typeof expiryDate === "number"
                    ? new Date(expiryDate).getTime()
                    : Number.NaN;

            if (
                Number.isNaN(expiryTimestamp) ||
                expiryTimestamp <= referenceDate.getTime()
            ) {
                return false;
            }
        }
    }
    return true;
};

/**
 * Returns the configured trust factor for an evidence record.
 *
 * @param {object} evidence
 * @param {object} evidenceRules
 * @returns {number}
 */
const getEvidenceTrust = (evidence, evidenceRules) => {
    const status = evidence.verification?.status;
    if (status === EVIDENCE_STATUSES.VERIFIED) {
        return evidenceRules.verifiedTrust;
    }
    if (status === EVIDENCE_STATUSES.SELF_REPORTED) {
        return evidenceRules.selfReportedTrust;
    }
    return 0;
};

/**
 * Checks whether evidence references a particular competency.
 *
 * @param {object} evidence
 * @param {string} competencyId
 * @returns {boolean}
 */
const hasCompetencyEvidence = (evidence, competencyId) =>
    (evidence.competencies ?? []).some(
        (competency) => getId(competency) === competencyId
    );

/**
 * Checks whether evidence references a particular skill.
 *
 * @param {object} evidence
 * @param {string} skillId
 * @returns {boolean}
 */
const hasSkillEvidence = (evidence, skillId) =>
    (evidence.skills ?? []).some((skill) => getId(skill) === skillId);

/**
 * Finds the best eligible evidence trust score for a skill.
 *
 * @param {string} skillId
 * @param {object[]} evidence
 * @param {object} evidenceRules
 * @param {Date} referenceDate
 * @returns {{score:number, provisional:boolean, matched:boolean}}
 */
const calculateSkillEvidenceScore = (
    skillId,
    evidence,
    evidenceRules,
    referenceDate
) => {
    const matchingEvidence = evidence.filter(
        (item) =>
            hasSkillEvidence(item, skillId) &&
            isEvidenceEligible(item, referenceDate)
    );
    const scores = matchingEvidence.map((item) =>
        getEvidenceTrust(item, evidenceRules)
    );
    const score = scores.length ? Math.max(...scores) : 0;
    return {
        score,
        matched: scores.length > 0,
        provisional:
            score > 0 &&
            matchingEvidence.some(
                (item) =>
                    item.verification?.status ===
                    EVIDENCE_STATUSES.SELF_REPORTED
            ) &&
            !matchingEvidence.some(
                (item) =>
                    item.verification?.status === EVIDENCE_STATUSES.VERIFIED
            )
    };
};

/**
 * Calculates competency matching using the trainer's derived proficiency.
 *
 * @param {object[]} requiredCompetencies
 * @param {object[]} trainerCompetencies
 * @param {object[]} evidence
 * @param {object} evidenceRules
 * @param {Date} referenceDate
 * @returns {object}
 */
const calculateCompetencyScore = (
    requiredCompetencies,
    trainerCompetencies,
    evidence,
    evidenceRules,
    referenceDate
) => {
    let totalWeight = 0;
    let earnedWeight = 0;
    let provisional = false;
    const gaps = [];
    const failedMustHave = [];
    for (const requirement of requiredCompetencies) {
        const competencyId = getId(requirement.competency);
        const trainerCompetency = trainerCompetencies.find(
            (item) => getId(item.competency) === competencyId
        );
        const trainerLevel = trainerCompetency?.levelNum ?? 0;
        const requiredLevel = requirement.minLevel ?? 1;
        const weight = requirement.weight ?? 1;

        if (
            !Number.isFinite(trainerLevel) ||
            trainerLevel < 0 ||
            !Number.isFinite(requiredLevel) ||
            requiredLevel <= 0 ||
            !Number.isFinite(weight) ||
            weight < 0
        ) {
            throw new TypeError("Competency scoring values are invalid.");
        }
        const score = Math.min(1, trainerLevel / requiredLevel);
        totalWeight += weight;
        earnedWeight += score * weight;
        const relatedEvidence = evidence.filter(
            (item) =>
                hasCompetencyEvidence(item, competencyId) &&
                isEvidenceEligible(item, referenceDate)
        );
        const hasVerifiedEvidence = relatedEvidence.some(
            (item) => item.verification?.status === EVIDENCE_STATUSES.VERIFIED
        );
        const hasSelfReportedEvidence = relatedEvidence.some(
            (item) =>
                item.verification?.status === EVIDENCE_STATUSES.SELF_REPORTED
        );
        if (!hasVerifiedEvidence && hasSelfReportedEvidence) {
            provisional = true;
        }
        const meetsRequiredLevel = trainerLevel >= requiredLevel;
        if (
            !meetsRequiredLevel ||
            (requirement.mustHave && !hasVerifiedEvidence)
        ) {
            const label =
                trainerCompetency?.competency?.name ??
                requirement.competency?.name ??
                "Required competency";
            gaps.push({
                category: "competency",
                label,
                have: String(trainerLevel),
                need: String(requiredLevel),
                mustHave: requirement.mustHave,
                suggestion: DEFAULT_SUGGESTIONS.competency
            });
            if (requirement.mustHave) {
                failedMustHave.push(`competency:${competencyId}`);
            }
        }
    }
    return {
        score: totalWeight > 0 ? earnedWeight / totalWeight : null,
        provisional,
        gaps,
        failedMustHave
    };
};

/**
 * Calculates skill matching using supporting evidence.
 *
 * @param {object[]} requiredSkills
 * @param {object[]} trainerSkills
 * @param {object[]} evidence
 * @param {object} evidenceRules
 * @param {Date} referenceDate
 * @returns {object}
 */
const calculateSkillsScore = (
    requiredSkills,
    trainerSkills,
    evidence,
    evidenceRules,
    referenceDate
) => {
    if (!requiredSkills.length) {
        return {
            score: null,
            provisional: false,
            gaps: [],
            failedMustHave: []
        };
    }
    let totalScore = 0;
    let provisional = false;
    const gaps = [];
    const failedMustHave = [];
    for (const requirement of requiredSkills) {
        const skillId = getId(requirement.skill);
        const result = calculateSkillEvidenceScore(
            skillId,
            evidence,
            evidenceRules,
            referenceDate
        );
        totalScore += result.score;
        provisional ||= result.provisional;
        const trainerSkill = trainerSkills.find(
            (item) => getId(item.skill) === skillId
        );
        const hasVerifiedEvidence = evidence.some(
            (item) =>
                hasSkillEvidence(item, skillId) &&
                isEvidenceEligible(item, referenceDate) &&
                item.verification?.status === EVIDENCE_STATUSES.VERIFIED
        );
        const mandatoryEvidenceMissing =
            requirement.mustHave && !hasVerifiedEvidence;
        if (!result.matched || mandatoryEvidenceMissing) {
            const label =
                requirement.skill?.name ??
                trainerSkill?.skill?.name ??
                "Required skill";
            gaps.push({
                category: "skill",
                label,
                have: result.matched ? "Self-reported evidence only" : null,
                need: "Verified supporting evidence",
                mustHave: requirement.mustHave,
                suggestion: DEFAULT_SUGGESTIONS.skill
            });
        }
        if (mandatoryEvidenceMissing) {
            failedMustHave.push(`skill:${skillId}`);
        }
    }
    return {
        score: totalScore / requiredSkills.length,
        provisional,
        gaps,
        failedMustHave
    };
};

/**
 * Calculates qualification keyword matching.
 *
 * @param {string[]} keywords
 * @param {object[]} evidence
 * @param {object} evidenceRules
 * @param {Date} referenceDate
 * @returns {object}
 */
const calculateQualificationScore = (
    keywords,
    evidence,
    evidenceRules,
    referenceDate
) => {
    if (!keywords.length) {
        return {
            score: null,
            provisional: false,
            gaps: [],
            failedMustHave: [],
            allKeywordsVerified: false
        };
    }
    const qualifications = evidence.filter(
        (item) =>
            item.type === EVIDENCE_TYPES.QUALIFICATION &&
            isEvidenceEligible(item, referenceDate)
    );
    let totalScore = 0;
    let provisional = false;
    const gaps = [];
    const failedMustHave = [];
    let allKeywordsVerified = keywords.length > 0;
    for (const keyword of keywords) {
        const normalizedKeyword = normalizeText(keyword);
        const matches = qualifications.filter((item) => {
            if (!normalizedKeyword) return false;

            const details = item.details ?? {};
            const searchableText = [
                details.qualificationName,
                details.institution,
                details.fieldOfStudy,
                item.title,
                item.description
            ]
                .map(normalizeText)
                .join(" ");
            return searchableText.includes(normalizedKeyword);
        });
        const score = matches.length
            ? Math.max(
                  ...matches.map((item) =>
                      getEvidenceTrust(item, evidenceRules)
                  )
              )
            : 0;
        totalScore += score;
        const hasVerifiedMatch = matches.some(
            (item) => item.verification?.status === EVIDENCE_STATUSES.VERIFIED
        );
        if (!hasVerifiedMatch) {
            allKeywordsVerified = false;
        }
        if (score > 0 && !hasVerifiedMatch) {
            provisional = true;
        }
        if (score === 0) {
            gaps.push({
                category: "qualification",
                label: keyword || "Required qualification",
                have: null,
                need: keyword || "A non-empty qualification keyword",
                mustHave: false,
                suggestion: DEFAULT_SUGGESTIONS.qualification
            });
        }
    }
    return {
        score: totalScore / keywords.length,
        provisional,
        gaps,
        failedMustHave,
        allKeywordsVerified
    };
};

/**
 * Calculates required certification matching.
 *
 * @param {object[]} requirements
 * @param {object[]} evidence
 * @param {object} evidenceRules
 * @param {Date} referenceDate
 * @returns {object}
 */
const calculateCertificationScore = (
    requirements,
    evidence,
    evidenceRules,
    referenceDate
) => {
    if (!requirements.length) {
        return {
            score: null,
            provisional: false,
            gaps: [],
            failedMustHave: []
        };
    }
    const certifications = evidence.filter(
        (item) =>
            item.type === EVIDENCE_TYPES.CERTIFICATION &&
            isEvidenceEligible(item, referenceDate)
    );
    let totalScore = 0;
    let provisional = false;
    const gaps = [];
    const failedMustHave = [];
    for (const requirement of requirements) {
        const requiredName = normalizeText(requirement.name);
        const matches = requiredName
            ? certifications.filter((item) => {
                  const certificateName = normalizeText(
                      item.details?.certificateName
                  );
                  return certificateName === requiredName;
              })
            : [];
        const score = matches.length
            ? Math.max(
                  ...matches.map((item) =>
                      getEvidenceTrust(item, evidenceRules)
                  )
              )
            : 0;
        totalScore += score;
        const hasVerifiedMatch = matches.some(
            (item) => item.verification?.status === EVIDENCE_STATUSES.VERIFIED
        );
        if (score > 0 && !hasVerifiedMatch) {
            provisional = true;
        }
        const mandatoryEvidenceMissing =
            requirement.mustHave && !hasVerifiedMatch;
        if (matches.length === 0 || mandatoryEvidenceMissing) {
            gaps.push({
                category: "certification",
                label: requirement.name || "Required certification",
                have: hasVerifiedMatch
                    ? "Verified evidence"
                    : score > 0
                      ? "Self-reported evidence only"
                      : null,
                need: requirement.name || "Required certification",
                mustHave: requirement.mustHave,
                suggestion: DEFAULT_SUGGESTIONS.certification
            });
        }
        if (requirement.mustHave && !hasVerifiedMatch) {
            failedMustHave.push(`certification:${requiredName}`);
        }
    }
    return {
        score: totalScore / requirements.length,
        provisional,
        gaps,
        failedMustHave
    };
};

/**
 * Calculates experience or teaching experience matching.
 *
 * @param {number} actualYears
 * @param {number} requiredYears
 * @returns {number|null}
 */
const calculateDurationScore = (actualYears, requiredYears) => {
    if (!Number.isFinite(actualYears) || !Number.isFinite(requiredYears)) {
        throw new TypeError("Experience values must be finite numbers.");
    }

    if (requiredYears <= 0) return null;
    return Math.min(1, Math.max(0, actualYears / requiredYears));
};

/**
 * Normalizes applicable matching weights.
 *
 * @param {object} weights
 * @param {object} breakdown
 * @returns {object}
 */
const calculateWeightedScore = (weights, breakdown) => {
    if (!weights || typeof weights !== "object" || !breakdown) {
        throw new TypeError("Weights and score breakdown are required.");
    }

    let totalWeight = 0;
    let weightedScore = 0;
    for (const factor of MATCH_FACTORS) {
        const score = breakdown[factor];
        const weight = weights[factor];

        if (!Number.isFinite(weight) || weight < 0) {
            throw new TypeError(
                `Matching weight '${factor}' must be a non-negative finite number.`
            );
        }

        if (score === null || score === undefined) continue;
        if (weight <= 0) continue;

        if (!Number.isFinite(score) || score < 0 || score > 1) {
            throw new TypeError(
                `Matching score '${factor}' must be between zero and one.`
            );
        }

        totalWeight += weight;
        weightedScore += score * weight;
    }
    if (totalWeight <= 0) {
        throw new Error(
            "No applicable matching factors have positive weights."
        );
    }
    return weightedScore / totalWeight;
};

/**
 * Evaluates one trainer against a training requirement.
 *
 * @param {object} params
 * @param {object} params.requirement
 * @param {object} params.config
 * @param {object} params.trainerProfile
 * @param {object[]} params.evidence
 * @param {Date} [params.referenceDate]
 * @returns {object}
 */
const evaluateTrainerMatch = (params = {}) => {
    if (!params || typeof params !== "object" || Array.isArray(params)) {
        throw new TypeError("Matching input must be an object.");
    }

    const {
        requirement,
        config,
        trainerProfile,
        evidence = [],
        referenceDate = new Date()
    } = params;

    if (!requirement || !config || !trainerProfile) {
        throw new TypeError(
            "Requirement, configuration and trainer profile are required."
        );
    }
    if (!Array.isArray(evidence)) {
        throw new TypeError("Evidence must be an array.");
    }

    if (
        !(referenceDate instanceof Date) ||
        Number.isNaN(referenceDate.getTime())
    ) {
        throw new TypeError("Reference date must be a valid Date.");
    }

    if (!config.weights || !config.thresholds || !config.evidenceRules) {
        throw new TypeError("Matching configuration is incomplete.");
    }

    const eligibleEvidence = evidence.filter((item) =>
        isEvidenceEligible(item, referenceDate)
    );
    const competencyResult = calculateCompetencyScore(
        requirement.competencies ?? [],
        trainerProfile.competencySummary ?? [],
        eligibleEvidence,
        config.evidenceRules,
        referenceDate
    );
    const skillsResult = calculateSkillsScore(
        requirement.requiredSkills ?? [],
        trainerProfile.skills ?? [],
        eligibleEvidence,
        config.evidenceRules,
        referenceDate
    );
    const qualificationResult = calculateQualificationScore(
        requirement.qualificationKeywords ?? [],
        eligibleEvidence,
        config.evidenceRules,
        referenceDate
    );
    const certificationResult = calculateCertificationScore(
        requirement.requiredCertifications ?? [],
        eligibleEvidence,
        config.evidenceRules,
        referenceDate
    );
    const industryYears = trainerProfile.experience?.industryYears ?? 0;
    const teachingYears = trainerProfile.experience?.teachingYears ?? 0;
    const experienceScore = calculateDurationScore(
        industryYears,
        requirement.minimumExperienceYears ?? 0
    );
    const teachingScore = calculateDurationScore(
        teachingYears,
        requirement.minimumTeachingYears ?? 0
    );
    const breakdown = {
        competency: competencyResult.score,
        skills: skillsResult.score,
        qualification: qualificationResult.score,
        experience: experienceScore,
        teaching: teachingScore,
        certification: certificationResult.score
    };
    const score = calculateWeightedScore(config.weights, breakdown);
    const failedMustHave = [
        ...competencyResult.failedMustHave,
        ...skillsResult.failedMustHave,
        ...certificationResult.failedMustHave
    ];
    const qualificationMustHave = requirement.qualificationMustHave === true;
    if (qualificationMustHave && !qualificationResult.allKeywordsVerified) {
        failedMustHave.push("qualification:mandatory");
    }
    if (
        requirement.minimumExperienceYears > 0 &&
        industryYears < requirement.minimumExperienceYears
    ) {
        failedMustHave.push("experience:minimum");
    }
    if (
        requirement.minimumTeachingYears > 0 &&
        teachingYears < requirement.minimumTeachingYears
    ) {
        failedMustHave.push("teaching:minimum");
    }
    const meetsMandatoryRequirements = failedMustHave.length === 0;
    const thresholds = config.thresholds;
    let tier = "none";
    if (meetsMandatoryRequirements) {
        if (score >= thresholds.strong) {
            tier = "strong";
        } else if (score >= thresholds.partial) {
            tier = "partial";
        }
    }
    const gaps = [
        ...competencyResult.gaps,
        ...skillsResult.gaps,
        ...qualificationResult.gaps.map((gap) => ({
            ...gap,
            mustHave: qualificationMustHave
        })),
        ...certificationResult.gaps
    ];
    if (
        qualificationMustHave &&
        !qualificationResult.allKeywordsVerified &&
        qualificationResult.gaps.length === 0
    ) {
        gaps.push({
            category: "qualification",
            label: "Required qualification",
            have: "Unverified or incomplete evidence",
            need: (requirement.qualificationKeywords ?? []).join(", "),
            mustHave: true,
            suggestion: DEFAULT_SUGGESTIONS.qualification
        });
    }
    if (experienceScore !== null && experienceScore < 1) {
        gaps.push({
            category: "experience",
            label: "Industry experience",
            have: `${industryYears} years`,
            need: `${requirement.minimumExperienceYears} years`,
            mustHave: true,
            suggestion: DEFAULT_SUGGESTIONS.experience
        });
    }
    if (teachingScore !== null && teachingScore < 1) {
        gaps.push({
            category: "teaching",
            label: "Teaching experience",
            have: `${teachingYears} years`,
            need: `${requirement.minimumTeachingYears} years`,
            mustHave: true,
            suggestion: DEFAULT_SUGGESTIONS.teaching
        });
    }
    const provisional =
        competencyResult.provisional ||
        skillsResult.provisional ||
        qualificationResult.provisional ||
        certificationResult.provisional;
    const availability = trainerProfile.availability ?? {};
    // Capacity is advisory during matching. The assignment operation must
    // enforce this limit atomically when a trainer is actually assigned.
    const atCapacity =
        availability.activeTrainings >= availability.maxConcurrentTrainings;
    const explanation = [];
    explanation.push(`Matching score: ${(score * 100).toFixed(2)}%.`);
    explanation.push(
        meetsMandatoryRequirements
            ? "All mandatory requirements are satisfied."
            : `Failed mandatory requirements: ${failedMustHave.join(", ")}.`
    );
    if (provisional) {
        explanation.push(
            "This result is provisional because some supporting evidence is self-reported."
        );
    }
    if (atCapacity) {
        explanation.push(
            "The trainer has reached their concurrent training capacity."
        );
    }
    return {
        trainer: getId(trainerProfile.user),
        trainerProfile: getId(trainerProfile._id),
        score,
        tier,
        provisional,
        atCapacity,
        failedMustHave,
        breakdown,
        gaps,
        explanation,
        meetsMandatoryRequirements
    };
};

/**
 * Sorts trainer matching results deterministically.
 *
 * @param {object[]} results
 * @param {string[]} tieBreakOrder
 * @returns {object[]}
 */
const rankTrainerMatches = (results, tieBreakOrder = []) => {
    if (!Array.isArray(results) || !Array.isArray(tieBreakOrder)) {
        throw new TypeError("Results and tie-break criteria must be arrays.");
    }

    const allowedCriteria = new Set([
        "verifiedRatio",
        "recency",
        "load",
        "profileCompletedAt"
    ]);

    if (
        tieBreakOrder.some((criterion) => !allowedCriteria.has(criterion)) ||
        new Set(tieBreakOrder).size !== tieBreakOrder.length
    ) {
        throw new TypeError("Tie-break criteria are invalid or duplicated.");
    }

    for (const result of results) {
        if (
            !result ||
            typeof result !== "object" ||
            typeof result.meetsMandatoryRequirements !== "boolean" ||
            !Number.isFinite(result.score) ||
            result.score < 0 ||
            result.score > 1
        ) {
            throw new TypeError("Matching results contain invalid scores.");
        }
    }

    const sortedResults = [...results];
    const getTieBreakValue = (result, criterion) => {
        switch (criterion) {
            case "verifiedRatio":
                return Number.isFinite(result.verifiedRatio) &&
                    result.verifiedRatio >= 0 &&
                    result.verifiedRatio <= 1
                    ? result.verifiedRatio
                    : 0;
            case "recency":
                return getValidTimestamp(result.latestEvidenceAt);
            case "load":
                return Number.isFinite(result.activeTrainings) &&
                    result.activeTrainings >= 0
                    ? result.activeTrainings
                    : 0;
            case "profileCompletedAt":
                return getValidTimestamp(result.profileCompletedAt);
            default:
                return 0;
        }
    };
    sortedResults.sort((a, b) => {
        if (a.meetsMandatoryRequirements !== b.meetsMandatoryRequirements) {
            return (
                Number(b.meetsMandatoryRequirements) -
                Number(a.meetsMandatoryRequirements)
            );
        }
        if (a.score !== b.score) {
            return b.score - a.score;
        }
        for (const criterion of tieBreakOrder) {
            const aValue = getTieBreakValue(a, criterion);
            const bValue = getTieBreakValue(b, criterion);
            if (aValue !== bValue) {
                return criterion === "load" ? aValue - bValue : bValue - aValue;
            }
        }
        return String(a.trainerProfile ?? "").localeCompare(
            String(b.trainerProfile ?? "")
        );
    });
    return sortedResults.map((result, index) => ({
        ...result,
        rank: index + 1
    }));
};

const getValidTimestamp = (value) => {
    if (value === null || value === undefined) return 0;

    if (
        !(value instanceof Date) &&
        typeof value !== "string" &&
        typeof value !== "number"
    ) {
        return 0;
    }

    const timestamp = new Date(value).getTime();

    return Number.isFinite(timestamp) ? timestamp : 0;
};

export {
    MATCH_FACTORS,
    isEvidenceEligible,
    getEvidenceTrust,
    calculateSkillEvidenceScore,
    calculateCompetencyScore,
    calculateSkillsScore,
    calculateQualificationScore,
    calculateCertificationScore,
    calculateDurationScore,
    calculateWeightedScore,
    evaluateTrainerMatch,
    rankTrainerMatches
};
