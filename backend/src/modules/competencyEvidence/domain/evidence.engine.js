
/**
 * @name EvidenceEngine
 * @description Pure calculation engine for trainer competency evidence.
 *
 * This module does not access databases, application state,
 * environment variables or external services.
 *
 * All time-dependent calculations receive the current date
 * explicitly through the `now` parameter.
 */

const DEFAULT_EVIDENCE_CONFIG = Object.freeze({
    halfLifeYears: 3,
    diminishingReturnFactor: 0.7,

    trustWeights: Object.freeze({
        verified: 1,
        self_reported: 0.5
    }),

    baseScores: Object.freeze({
        qualification: 2,
        certification: 3,
        experience: 0.5,
        teaching: 0.5,
        assessment: 5
    }),

    maximumScores: Object.freeze({
        experience: 5,
        teaching: 3,
        assessment: 5
    }),

    proficiencyThresholds: Object.freeze({
        intermediate: 3,
        advanced: 6,
        expert: 9
    })
});

/**
 * @name DAY_IN_MILLISECONDS
 * @description Number of milliseconds in one day.
 */
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

/**
 * @name getValidDate
 * @description Converts a date value into a valid Date object.
 *
 * @param {Date|string|number} value - Date value.
 * @returns {Date|null} Valid date or null.
 */
const getValidDate = (value) => {
    if (!value) {
        return null;
    }

    const date = value instanceof Date
        ? new Date(value.getTime())
        : new Date(value);

    return Number.isNaN(date.getTime())
        ? null
        : date;
};

/**
 * @name getEvidenceReferenceId
 * @description Safely extracts an ID from a string, ObjectId,
 * or populated reference.
 *
 * @param {Object|string} reference - Reference value.
 * @returns {string|null} Valid reference ID or null.
 */
const getEvidenceReferenceId = (reference) => {
    if (typeof reference === "string") {
        const id = reference.trim();

        return id || null;
    }

    if (!reference || typeof reference !== "object") {
        return null;
    }

    // Handle populated references.
    if (
        reference._id !== undefined &&
        reference._id !== reference
    ) {
        return getEvidenceReferenceId(reference._id);
    }

    // Handle BSON/Mongoose ObjectId instances.
    if (typeof reference.toHexString === "function") {
        try {
            const id = reference.toHexString().trim();

            return id || null;
        } catch {
            return null;
        }
    }

    // Support other ID objects with a custom toString method.
    if (
        typeof reference.toString === "function" &&
        reference.toString !== Object.prototype.toString
    ) {
        try {
            const id = reference.toString().trim();

            return id && id !== "[object Object]"
                ? id
                : null;
        } catch {
            return null;
        }
    }

    return null;
};

/**
 * @name getEvidenceId
 * @description Safely extracts the evidence record ID.
 *
 * @param {Object} evidence - Evidence record.
 * @returns {string|null} Evidence ID or null.
 */
const getEvidenceId = (evidence) => {
    return getEvidenceReferenceId(evidence?._id);
};


/**
 * @name isEvidenceEligible
 * @description Determines whether evidence can contribute
 * to competency calculations.
 *
 * Rejected, deleted and superseded evidence is excluded.
 *
 * @param {Object} evidence - Evidence record.
 * @returns {boolean} Eligibility result.
 */
export const isEvidenceEligible = (evidence) => {
    if (!evidence || evidence.isDeleted) {
        return false;
    }

    if (evidence.supersededBy) {
        return false;
    }

    const status = evidence.verification?.status;

    return (
        status === "verified" ||
        status === "self_reported"
    );
};

/**
 * @name getEvidenceTrustWeight
 * @description Retrieves the trust weight for an evidence record.
 *
 * @param {Object} evidence - Evidence record.
 * @param {Object} config - Evidence configuration.
 * @returns {number} Trust weight.
 */
export const getEvidenceTrustWeight = (
    evidence,
    config = DEFAULT_EVIDENCE_CONFIG
) => {
    const status = evidence?.verification?.status;

    return config.trustWeights[status] || 0;
};

/**
 * @name calculateEvidenceAgeDecay
 * @description Calculates exponential evidence age decay.
 *
 * Formula:
 * 0.5 ^ (age in years / half-life in years)
 *
 * @param {Object} params - Decay parameters.
 * @param {Date|string} params.referenceDate - Evidence date.
 * @param {Date|string} params.now - Current reference date.
 * @param {number} [params.halfLifeYears=3] - Evidence half-life.
 * @returns {number} Decay multiplier.
 */
export const calculateEvidenceAgeDecay = ({
    referenceDate,
    now,
    halfLifeYears = 3
}) => {
    const evidenceDate = getValidDate(referenceDate);
    const currentDate = getValidDate(now);

    if (
        !evidenceDate ||
        !currentDate ||
        !Number.isFinite(halfLifeYears) ||
        halfLifeYears <= 0
    ) {
        return 0;
    }

    const ageInMilliseconds =
        currentDate.getTime() - evidenceDate.getTime();

    // Future-dated evidence is not penalized.
    const ageInYears = Math.max(
        0,
        ageInMilliseconds / (365.25 * DAY_IN_MILLISECONDS)
    );

    return Math.pow(
        0.5,
        ageInYears / halfLifeYears
    );
};

/**
 * @name mergeDateIntervals
 * @description Merges overlapping date intervals.
 *
 * @param {Array<Object>} intervals - Date intervals.
 * @param {Date|string} now - Current reference date.
 * @returns {Array<Object>} Merged intervals.
 */
export const mergeDateIntervals = (
    intervals = [],
    now
) => {
    const currentDate = getValidDate(now);

    if (!currentDate) {
        return [];
    }

    const normalizedIntervals = intervals
        .map((interval) => {
            const start = getValidDate(interval.start);
            const end = interval.end
                ? getValidDate(interval.end)
                : currentDate;

            if (!start || !end) {
                return null;
            }

            const boundedEnd = new Date(
                Math.min(
                    end.getTime(),
                    currentDate.getTime()
                )
            );

            if (start > boundedEnd) {
                return null;
            }

            return {
                start,
                end: boundedEnd
            };
        })
        .filter(Boolean)
        .sort(
            (a, b) => a.start.getTime() - b.start.getTime()
        );

    if (!normalizedIntervals.length) {
        return [];
    }

    const merged = [
        {
            start: normalizedIntervals[0].start,
            end: normalizedIntervals[0].end
        }
    ];

    for (let index = 1; index < normalizedIntervals.length; index += 1) {
        const current = normalizedIntervals[index];
        const previous = merged[merged.length - 1];

        if (current.start <= previous.end) {
            if (current.end > previous.end) {
                previous.end = current.end;
            }
        } else {
            merged.push({
                start: current.start,
                end: current.end
            });
        }
    }

    return merged;
};

/**
 * @name calculateMergedDurationYears
 * @description Calculates total duration after merging overlapping
 * date intervals.
 *
 * @param {Array<Object>} intervals - Date intervals.
 * @param {Date|string} now - Current reference date.
 * @returns {number} Total duration in years.
 */
export const calculateMergedDurationYears = (
    intervals = [],
    now
) => {
    const mergedIntervals = mergeDateIntervals(
        intervals,
        now
    );

    const totalMilliseconds = mergedIntervals.reduce(
        (total, interval) => {
            return total + (
                interval.end.getTime() -
                interval.start.getTime()
            );
        },
        0
    );

    return totalMilliseconds /
        (365.25 * DAY_IN_MILLISECONDS);
};

/**
 * @name calculateTrustWeightedDurationYears
 * @description Calculates duration without double-counting overlapping
 * intervals, applying the highest trust weight to each time segment.
 *
 * @param {Object[]} intervals - Date intervals with trust weights.
 * @param {Date|string} now - Current reference date.
 * @returns {number} Trust-weighted duration in years.
 */
const calculateTrustWeightedDurationYears = (
    intervals = [],
    now
) => {
    const currentDate = getValidDate(now);

    if (!currentDate || !intervals.length) {
        return 0;
    }

    const normalizedIntervals = intervals
        .map((interval) => {
            const start = getValidDate(interval.start);
            const rawEnd = interval.end
                ? getValidDate(interval.end)
                : currentDate;

            const trustWeight = interval.trustWeight;

            if (
                !start ||
                !rawEnd ||
                !Number.isFinite(trustWeight) ||
                trustWeight <= 0
            ) {
                return null;
            }

            const end = new Date(
                Math.min(
                    rawEnd.getTime(),
                    currentDate.getTime()
                )
            );

            if (start >= end) {
                return null;
            }

            return {
                start,
                end,
                trustWeight,
            };
        })
        .filter(Boolean);

    if (!normalizedIntervals.length) {
        return 0;
    }

    const boundaries = [
        ...new Set(
            normalizedIntervals.flatMap((interval) => [
                interval.start.getTime(),
                interval.end.getTime(),
            ])
        ),
    ].sort((a, b) => a - b);

    let weightedMilliseconds = 0;

    for (let index = 0; index < boundaries.length - 1; index += 1) {
        const segmentStart = boundaries[index];
        const segmentEnd = boundaries[index + 1];

        const highestTrustWeight = normalizedIntervals.reduce(
            (highest, interval) => {
                const coversSegment =
                    interval.start.getTime() <= segmentStart &&
                    interval.end.getTime() >= segmentEnd;

                return coversSegment
                    ? Math.max(highest, interval.trustWeight)
                    : highest;
            },
            0
        );

        weightedMilliseconds +=
            (segmentEnd - segmentStart) * highestTrustWeight;
    }

    return weightedMilliseconds /
        (365.25 * DAY_IN_MILLISECONDS);
};

/**
 * @name getEvidencePeriod
 * @description Retrieves the applicable date interval for
 * professional or teaching experience.
 *
 * @param {Object} evidence - Evidence record.
 * @param {Date|string} now - Current reference date.
 * @returns {Object|null} Experience interval.
 */
const getEvidencePeriod = (evidence, now) => {
    const details = evidence.details || {};

    if (evidence.type === "experience") {
        return {
            start: details.startDate,
            end: details.isOngoing
                ? now
                : details.endDate
        };
    }

    if (evidence.type === "teaching") {
        return {
            start: details.teachingStartDate,
            end: details.isTeachingOngoing
                ? now
                : details.teachingEndDate
        };
    }

    return null;
};

/**
 * @name calculateEvidenceBaseScore
 * @description Calculates the base contribution for an
 * individual evidence record before trust and age adjustments.
 *
 * @param {Object} evidence - Evidence record.
 * @param {Date|string} now - Current reference date.
 * @param {Object} config - Evidence configuration.
 * @returns {number} Base contribution.
 */
export const calculateEvidenceBaseScore = (
    evidence,
    now,
    config = DEFAULT_EVIDENCE_CONFIG
) => {
    if (!evidence || !config.baseScores) {
        return 0;
    }

    const details = evidence.details || {};

    switch (evidence.type) {
        case "qualification":
            return config.baseScores.qualification;

        case "certification": {
            const expiresAt = getValidDate(details.expiresAt);
            const currentDate = getValidDate(now);

            if (
                expiresAt &&
                currentDate &&
                expiresAt < currentDate
            ) {
                return 0;
            }

            return config.baseScores.certification;
        }

        case "experience": {
            const period = getEvidencePeriod(evidence, now);

            if (!period) {
                return 0;
            }

            const years = calculateMergedDurationYears(
                [period],
                now
            );

            return Math.min(
                years * config.baseScores.experience,
                config.maximumScores.experience
            );
        }

        case "teaching": {
            const period = getEvidencePeriod(evidence, now);

            if (!period) {
                return 0;
            }

            const years = calculateMergedDurationYears(
                [period],
                now
            );

            return Math.min(
                years * config.baseScores.teaching,
                config.maximumScores.teaching
            );
        }

        case "assessment": {
            const score = details.score;
            const maximumScore = details.maximumScore;

            if (
                !Number.isFinite(score) ||
                !Number.isFinite(maximumScore) ||
                maximumScore <= 0 ||
                score < 0 ||
                score > maximumScore
            ) {
                return 0;
            }

            const percentage = (score / maximumScore) * 100;

            return Math.min(
                percentage / 20,
                config.maximumScores.assessment
            );
        }

        default:
            return 0;
    }
};

/**
 * @name calculateEvidenceContribution
 * @description Calculates the effective contribution of one
 * evidence record after trust and age adjustments.
 *
 * @param {Object} evidence - Evidence record.
 * @param {Date|string} now - Current reference date.
 * @param {Object} config - Evidence configuration.
 * @returns {Object} Contribution breakdown.
 */
export const calculateEvidenceContribution = (
    evidence,
    now,
    config = DEFAULT_EVIDENCE_CONFIG
) => {
    if (!isEvidenceEligible(evidence)) {
        return {
            eligible: false,
            baseScore: 0,
            trustWeight: 0,
            ageDecay: 0,
            score: 0
        };
    }

    const referenceDate =
        evidence.type === "certification"
            ? evidence.details?.issuedAt || evidence.createdAt
            : evidence.type === "qualification"
                ? evidence.details?.issuedAt || evidence.createdAt
                : evidence.type === "assessment"
                    ? evidence.details?.takenAt || evidence.createdAt
                    : getEvidencePeriod(evidence, now)?.end ||
                    evidence.createdAt;

    const baseScore = calculateEvidenceBaseScore(
        evidence,
        now,
        config
    );

    const trustWeight = getEvidenceTrustWeight(
        evidence,
        config
    );

    const ageDecay = calculateEvidenceAgeDecay({
        referenceDate,
        now,
        halfLifeYears: config.halfLifeYears
    });

    const score = baseScore * trustWeight * ageDecay;

    return {
        eligible: true,
        evidenceId: getEvidenceId(evidence),
        type: evidence.type,
        baseScore,
        trustWeight,
        ageDecay,
        score
    };
};

/**
 * @name calculateDiminishingReturns
 * @description Applies diminishing returns to ordered contributions.
 *
 * Each subsequent contribution is multiplied by the configured
 * diminishing-return factor raised to its position.
 *
 * @param {number[]} scores - Contribution scores.
 * @param {number} [factor=0.7] - Diminishing-return factor.
 * @returns {number} Adjusted total score.
 */
export const calculateDiminishingReturns = (
    scores = [],
    factor = DEFAULT_EVIDENCE_CONFIG.diminishingReturnFactor
) => {
    if (
        !Number.isFinite(factor) ||
        factor < 0 ||
        factor > 1
    ) {
        return 0;
    }

    const sortedScores = [...scores]
        .filter((score) => Number.isFinite(score) && score > 0)
        .sort((a, b) => b - a);

    return sortedScores.reduce(
        (total, score, index) => {
            return total + score * Math.pow(factor, index);
        },
        0
    );
};

/**
 * @name calculateTrainerExperience
 * @description Calculates trust-weighted professional and teaching
 * experience without double-counting overlapping periods.
 *
 * @param {Object} params - Calculation parameters.
 * @param {Object[]} params.evidenceRecords - Evidence records.
 * @param {Date|string} params.now - Current reference date.
 * @param {Object} [params.config] - Evidence configuration.
 * @returns {Object} Experience summary.
 */
export const calculateTrainerExperience = ({
    evidenceRecords = [],
    now,
    config = DEFAULT_EVIDENCE_CONFIG,
}) => {
    const calculateExperience = (type) => {
        const intervals = evidenceRecords
            .filter(
                (evidence) =>
                    evidence.type === type &&
                    isEvidenceEligible(evidence)
            )
            .map((evidence) => {
                const period = getEvidencePeriod(evidence, now);

                if (!period) {
                    return null;
                }

                return {
                    ...period,
                    trustWeight: getEvidenceTrustWeight(
                        evidence,
                        config
                    ),
                };
            })
            .filter(Boolean);

        return calculateTrustWeightedDurationYears(
            intervals,
            now
        );
    };

    return {
        professionalExperienceYears:
            calculateExperience("experience"),

        teachingExperienceYears:
            calculateExperience("teaching"),
    };
};

/**
 * @name calculateTargetSummary
 * @description Calculates a competency or skill score from
 * its associated evidence records.
 *
 * @param {Object[]} evidenceRecords - Relevant evidence records.
 * @param {string} targetId - Competency or skill ID.
 * @param {string} targetType - Target reference field.
 * @param {Date|string} now - Current reference date.
 * @param {Object} config - Evidence configuration.
 * @returns {Object} Target score summary.
 */
const calculateTargetSummary = (
    evidenceRecords,
    targetId,
    targetType,
    now,
    config
) => {
    const matchingEvidence = evidenceRecords.filter(
        (evidence) => {
            const references = evidence[targetType] || [];

            return references.some(
                (reference) =>
                    getEvidenceReferenceId(reference) === targetId
            );
        }
    );

    const eligibleEvidence = matchingEvidence.filter(
        isEvidenceEligible
    );

    // Calculate every evidence record independently.
    const contributions = eligibleEvidence
        .map((evidence) =>
            calculateEvidenceContribution(
                evidence,
                now,
                config
            )
        )
        .filter((contribution) => contribution.score > 0);

    const totalScore = calculateDiminishingReturns(
        contributions.map((contribution) => contribution.score),
        config.diminishingReturnFactor
    );

    return {
        id: targetId,

        score: Number(totalScore.toFixed(4)),

        contributionsCount: eligibleEvidence.length,

        verifiedEvidenceCount: eligibleEvidence.filter(
            (evidence) =>
                evidence.verification.status === "verified"
        ).length,

        selfReportedEvidenceCount: eligibleEvidence.filter(
            (evidence) =>
                evidence.verification.status === "self_reported"
        ).length,

        evidenceIds: eligibleEvidence.map(getEvidenceId),
    };
};

/**
 * @name buildTargetSummaries
 * @description Builds evidence summaries for competencies or skills.
 *
 * @param {Object} params - Summary parameters.
 * @param {Object[]} params.evidenceRecords - Evidence records.
 * @param {string} params.referenceField - Competency or skill field.
 * @param {Date|string} params.now - Current reference date.
 * @param {Object} params.config - Evidence configuration.
 * @returns {Object[]} Target summaries.
 */
const buildTargetSummaries = ({
    evidenceRecords,
    referenceField,
    now,
    config
}) => {
    const targetIds = new Set();

    for (const evidence of evidenceRecords) {
        if (!isEvidenceEligible(evidence)) {
            continue;
        }

        for (const reference of evidence[referenceField] || []) {
            const id = getEvidenceReferenceId(reference);

            if (id) {
                targetIds.add(id);
            }
        }
    }

    return [...targetIds]
        .sort()
        .map((targetId) => {
            return calculateTargetSummary(
                evidenceRecords,
                targetId,
                referenceField,
                now,
                config
            );
        });
};

/**
 * @name calculateTrainerEvidenceSummary
 * @description Builds deterministic competency and skill summaries
 * from eligible evidence records.
 *
 * @param {Object} params - Calculation parameters.
 * @param {Object[]} params.evidenceRecords - Trainer evidence records.
 * @param {Date|string} params.now - Current reference date.
 * @param {Object} [params.config] - Evidence configuration.
 * @returns {Object} Trainer evidence summary.
 */
export const calculateTrainerEvidenceSummary = ({
    evidenceRecords = [],
    now,
    config = DEFAULT_EVIDENCE_CONFIG
}) => {
    const currentDate = getValidDate(now);

    if (!currentDate) {
        throw new TypeError(
            "A valid reference date must be provided."
        );
    }

    const eligibleEvidence = evidenceRecords
        .filter(isEvidenceEligible)
        .sort((a, b) => {
            const idA = getEvidenceId(a) || "";
            const idB = getEvidenceId(b) || "";

            if (idA < idB) {
                return -1;
            }

            if (idA > idB) {
                return 1;
            }

            return 0;
        });

    const latestEvidenceAt = evidenceRecords.reduce((latest, evidence) => {
        const createdAt = evidence.createdAt
            ? new Date(evidence.createdAt)
            : null;

        if (!createdAt || Number.isNaN(createdAt.getTime())) {
            return latest;
        }

        if (!latest || createdAt > latest) {
            return createdAt;
        }

        return latest;
    }, null);

    const evidenceContributions = eligibleEvidence.map(
        (evidence) => calculateEvidenceContribution(
            evidence,
            currentDate,
            config
        )
    );

    const experience = calculateTrainerExperience({
        evidenceRecords: eligibleEvidence,
        now: currentDate,
        config
    });

    const competencies = buildTargetSummaries({
        evidenceRecords: eligibleEvidence,
        referenceField: "competencies",
        now: currentDate,
        config
    });

    const skills = buildTargetSummaries({
        evidenceRecords: eligibleEvidence,
        referenceField: "skills",
        now: currentDate,
        config
    });

    return {
        generatedAt: currentDate,
        latestEvidenceAt,
        evidenceStats: {
            total: evidenceRecords.length,
            eligible: eligibleEvidence.length,

            verified: eligibleEvidence.filter(
                (evidence) =>
                    evidence.verification.status === "verified"
            ).length,

            selfReported: eligibleEvidence.filter(
                (evidence) =>
                    evidence.verification.status === "self_reported"
            ).length,

            rejected: evidenceRecords.filter(
                (evidence) =>
                    evidence.verification?.status === "rejected"
            ).length,

            excluded: evidenceRecords.length - eligibleEvidence.length
        },

        experience,

        competencies,

        skills,

        evidenceContributions
    };
};

/**
 * @name getDefaultEvidenceConfig
 * @description Returns a fresh copy of the default evidence configuration.
 *
 * @returns {Object} Evidence configuration.
 */
export const getDefaultEvidenceConfig = () => {
    return {
        halfLifeYears: DEFAULT_EVIDENCE_CONFIG.halfLifeYears,

        diminishingReturnFactor:
            DEFAULT_EVIDENCE_CONFIG.diminishingReturnFactor,

        trustWeights: {
            ...DEFAULT_EVIDENCE_CONFIG.trustWeights
        },

        baseScores: {
            ...DEFAULT_EVIDENCE_CONFIG.baseScores
        },

        maximumScores: {
            ...DEFAULT_EVIDENCE_CONFIG.maximumScores
        },

        proficiencyThresholds: {
            ...DEFAULT_EVIDENCE_CONFIG.proficiencyThresholds
        }
    };
};

/**
 * @name resolveCompetencyLevel
 * @description Converts competency points into a proficiency level
 * using configurable score thresholds.
 *
 * Scores are rounded to three decimal places before comparison.
 *
 * @param {number} points - Calculated competency points.
 * @param {Object} [thresholds] - Proficiency thresholds.
 * @param {number} [thresholds.intermediate=3] - Intermediate threshold.
 * @param {number} [thresholds.advanced=6] - Advanced threshold.
 * @param {number} [thresholds.expert=9] - Expert threshold.
 * @returns {{level: string, levelNum: number}} Proficiency level.
 * @throws {TypeError} If points or thresholds are invalid.
 */
export const resolveCompetencyLevel = (
    points,
    thresholds = DEFAULT_EVIDENCE_CONFIG.proficiencyThresholds
) => {
    if (!Number.isFinite(points) || points < 0) {
        throw new TypeError(
            "Competency points must be a finite non-negative number."
        );
    }

    if (
        !thresholds ||
        typeof thresholds !== "object" ||
        Array.isArray(thresholds)
    ) {
        throw new TypeError(
            "Valid proficiency thresholds must be provided."
        );
    }

    const {
        intermediate,
        advanced,
        expert
    } = thresholds;

    const validThresholds = [
        intermediate,
        advanced,
        expert
    ].every(
        (threshold) =>
            Number.isFinite(threshold) && threshold > 0
    );

    if (
        !validThresholds ||
        !(intermediate < advanced && advanced < expert)
    ) {
        throw new TypeError(
            "Proficiency thresholds must be positive and strictly increasing."
        );
    }

    const normalizedPoints = Number(points.toFixed(3));

    if (normalizedPoints >= expert) {
        return {
            level: "expert",
            levelNum: 4
        };
    }

    if (normalizedPoints >= advanced) {
        return {
            level: "advanced",
            levelNum: 3
        };
    }

    if (normalizedPoints >= intermediate) {
        return {
            level: "intermediate",
            levelNum: 2
        };
    }

    return {
        level: "beginner",
        levelNum: 1
    };
};


