
import mongoose from "mongoose";

import {
    getTrainingRequirementForMatching,
    getActiveMatchingConfig,
    getEligibleTrainerProfiles,
    getTrainerEvidenceForMatching,
    createMatchRun,
    updateRequirementAfterMatching
} from "./matching.repository.js";

import {
    evaluateTrainerMatch,
    rankTrainerMatches
} from "./matching.engine.js";

import AppError from "../../core/errors/AppError.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../core/constants/index.js";

/**
 * @name groupEvidenceByTrainerProfile
 * @description Groups evidence records using their trainer profile ID.
 *
 * @param {Object[]} evidence - Evidence records.
 * @returns {Map<string, Object[]>} Evidence grouped by trainer profile.
 */
const groupEvidenceByTrainerProfile = (evidence) => {
    const evidenceMap = new Map();

    for (const item of evidence) {
        const trainerProfileId = String(item.trainerProfile);

        if (!evidenceMap.has(trainerProfileId)) {
            evidenceMap.set(trainerProfileId, []);
        }

        evidenceMap.get(trainerProfileId).push(item);
    }

    return evidenceMap;
};

/**
 * @name getTrainerTieBreakData
 * @description Extracts additional trainer profile values required
 * by the deterministic ranking algorithm.
 *
 * @param {Object} trainerProfile - Trainer profile.
 * @returns {Object} Ranking metadata.
 */
const getTrainerTieBreakData = (trainerProfile) => ({
    verifiedRatio: trainerProfile.evidenceStats?.verifiedRatio ?? 0,
    latestEvidenceAt: trainerProfile.evidenceStats?.latestEvidenceAt ?? null,
    activeTrainings: trainerProfile.availability?.activeTrainings ?? 0,
    profileCompletedAt:
        trainerProfile.completion?.profileCompletedAt ?? null
});

/**
 * @name validateMatchingConfiguration
 * @description Validates the active matching configuration before
 * executing trainer matching.
 *
 * @param {Object} config - Active matching configuration.
 * @throws {AppError} If the configuration is invalid.
 */
const validateMatchingConfiguration = (config) => {
    const validationError = (message) => {
        throw new AppError(
            message,
            HTTP_STATUS.UNPROCESSABLE_ENTITY,
            ERROR_CODES.VALIDATION_ERROR
        );
    };

    const hasExactKeys = (object, expectedKeys) => {
        if (
            !object ||
            typeof object !== "object" ||
            Array.isArray(object)
        ) {
            return false;
        }

        const actualKeys = Object.keys(object);

        return (
            expectedKeys.every((key) =>
                Object.hasOwn(object, key)
            ) &&
            actualKeys.length === expectedKeys.length
        );
    };

    const isFiniteNumber = (value) =>
        typeof value === "number" && Number.isFinite(value);

    const isWithinRange = (value, min, max) =>
        isFiniteNumber(value) && value >= min && value <= max;

    // Validate required configuration sections.
    if (
        !config ||
        !config.weights ||
        !config.thresholds ||
        !config.evidenceRules ||
        !Array.isArray(config.tieBreakOrder)
    ) {
        validationError(
            "The active matching configuration is incomplete."
        );
    }

    // Validate matching weights.
    const expectedWeightKeys = [
        "competency",
        "skills",
        "qualification",
        "experience",
        "teaching",
        "certification"
    ];

    if (!hasExactKeys(config.weights, expectedWeightKeys)) {
        validationError(
            "Matching weights contain missing or unsupported factors."
        );
    }

    const weightValues = Object.values(config.weights);

    if (
        weightValues.some(
            (weight) => !isFiniteNumber(weight) || weight < 0
        )
    ) {
        validationError(
            "Matching weights must be valid non-negative numbers."
        );
    }

    if (!weightValues.some((weight) => weight > 0)) {
        validationError(
            "At least one matching factor must have a positive weight."
        );
    }

    // Validate matching thresholds.
    const { strong, partial } = config.thresholds;

    if (
        !isWithinRange(partial, 0, 1) ||
        !isWithinRange(strong, 0, 1) ||
        partial > strong
    ) {
        validationError(
            "Matching thresholds are invalid."
        );
    }

    // Validate evidence rules.
    const expectedEvidenceRuleKeys = [
        "qualificationBasePoints",
        "certificationBasePoints",
        "experiencePointsPerYear",
        "experiencePointsCap",
        "teachingPointsPerYear",
        "teachingPointsCap",
        "assessmentScoreDivisor",
        "assessmentPointsCap",
        "halfLifeYears",
        "diminishingReturnFactor",
        "verifiedTrust",
        "selfReportedTrust"
    ];

    if (
        !hasExactKeys(
            config.evidenceRules,
            expectedEvidenceRuleKeys
        )
    ) {
        validationError(
            "Evidence rules contain missing or unsupported settings."
        );
    }

    const rules = config.evidenceRules;

    const nonNegativeRuleKeys = [
        "qualificationBasePoints",
        "certificationBasePoints",
        "experiencePointsPerYear",
        "experiencePointsCap",
        "teachingPointsPerYear",
        "teachingPointsCap",
        "assessmentPointsCap"
    ];

    for (const key of nonNegativeRuleKeys) {
        if (!isFiniteNumber(rules[key]) || rules[key] < 0) {
            validationError(
                `Evidence rule '${key}' must be a non-negative number.`
            );
        }
    }

    if (
        !isFiniteNumber(rules.assessmentScoreDivisor) ||
        rules.assessmentScoreDivisor <= 0
    ) {
        validationError(
            "Assessment score divisor must be greater than zero."
        );
    }

    if (
        !isFiniteNumber(rules.halfLifeYears) ||
        rules.halfLifeYears <= 0
    ) {
        validationError(
            "Evidence half-life must be greater than zero."
        );
    }

    if (!isWithinRange(rules.diminishingReturnFactor, 0, 1)) {
        validationError(
            "Evidence diminishing return factor must be between zero and one."
        );
    }

    if (
        !isWithinRange(rules.verifiedTrust, 0, 1) ||
        !isWithinRange(rules.selfReportedTrust, 0, 1)
    ) {
        validationError(
            "Evidence trust values must be between zero and one."
        );
    }

    // Validate tie-break criteria.
    const allowedTieBreakCriteria = [
        "verifiedRatio",
        "recency",
        "load",
        "profileCompletedAt"
    ];

    if (
        config.tieBreakOrder.some(
            (criterion) =>
                !allowedTieBreakCriteria.includes(criterion)
        ) ||
        new Set(config.tieBreakOrder).size !==
            config.tieBreakOrder.length
    ) {
        validationError(
            "Matching tie-break criteria are invalid or duplicated."
        );
    }

    // Validate result limit before querying and scoring trainers.
    const resultLimit = config.defaultResultLimit ?? 20;

    if (
        !Number.isInteger(resultLimit) ||
        resultLimit < 1
    ) {
        validationError(
            "The configured matching result limit is invalid."
        );
    }
};

/**
 * @name determineMatchOutcome
 * @description Determines the overall outcome of a matching execution.
 *
 * @param {Object[]} results - Ranked matching results.
 * @returns {"strong_found"|"partial_only"|"none_suitable"} Outcome.
 */
const determineMatchOutcome = (results) => {
    if (results.some((result) => result.tier === "strong")) {
        return "strong_found";
    }

    if (results.some((result) => result.tier === "partial")) {
        return "partial_only";
    }

    return "none_suitable";
};

/**
 * @name executeTrainerMatching
 * @description Executes trainer matching for a training requirement.
 *
 * Retrieves the requirement, active configuration, eligible trainers
 * and their evidence. Evaluates and ranks trainers using the matching
 * engine, then persists an immutable MatchRun and updates the
 * requirement within one MongoDB transaction.
 *
 * @param {Object} params - Matching parameters.
 * @param {string} params.orgId - Organization ID.
 * @param {string} params.requirementId - Training requirement ID.
 * @param {string} params.executedBy - User ID executing the matching.
 * @returns {Promise<Object>} Persisted matching execution.
 * @throws {AppError} If matching cannot be completed.
 */
export const executeTrainerMatching = async ({
    orgId,
    requirementId,
    executedBy
}) => {
    if (!orgId || !requirementId || !executedBy) {
        throw new AppError(
            "Organization, requirement and executing user are required.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    const totalStartTime = Date.now();

    const requirement = await getTrainingRequirementForMatching({
        orgId,
        requirementId
    });

    const config = await getActiveMatchingConfig({
        orgId
    });

    validateMatchingConfiguration(config);

    const queryStartTime = Date.now();

    const trainerProfiles = await getEligibleTrainerProfiles({
        orgId
    });

    const trainerProfileIds = trainerProfiles.map(
        (profile) => profile._id
    );

    const evidence = await getTrainerEvidenceForMatching({
        orgId,
        trainerProfileIds
    });

    const queryMs = Date.now() - queryStartTime;

    const scoringStartTime = Date.now();

    const evidenceByTrainer = groupEvidenceByTrainerProfile(evidence);

    const referenceDate = new Date();

    const evaluatedResults = trainerProfiles.map((trainerProfile) => {
        const trainerProfileId = String(trainerProfile._id);

        const trainerEvidence =
            evidenceByTrainer.get(trainerProfileId) ?? [];

        const evaluation = evaluateTrainerMatch({
            requirement,
            config,
            trainerProfile,
            evidence: trainerEvidence,
            referenceDate
        });

        return {
            ...evaluation,
            ...getTrainerTieBreakData(trainerProfile)
        };
    });

    const rankedResults = rankTrainerMatches(
        evaluatedResults,
        config.tieBreakOrder
    );

    const scoringMs = Date.now() - scoringStartTime;


    const limitedResults = rankedResults
        .slice(0, config.defaultResultLimit ?? 20)
        .map((result) => ({
            trainer: result.trainer,
            trainerProfile: result.trainerProfile,
            rank: result.rank,
            score: Number(result.score.toFixed(4)),
            tier: result.tier,
            provisional: result.provisional,
            atCapacity: result.atCapacity,
            failedMustHave: result.failedMustHave,
            breakdown: result.breakdown,
            gaps: result.gaps,
            explanation: result.explanation
        }));

    const outcome = determineMatchOutcome(rankedResults);

    const totalMs = Date.now() - totalStartTime;

    const matchRunData = {
        org: orgId,
        requirement: requirementId,

        requirementSnapshot: requirement,
        configSnapshot: config,

        algorithmVersion: config.algorithmVersion,

        stats: {
            candidatesEvaluated: trainerProfiles.length,
            queryMs,
            scoringMs,
            totalMs
        },

        outcome,
        results: limitedResults,
        executedBy
    };

    const session = await mongoose.startSession();

    let persistedMatchRun;

    try {
        await session.withTransaction(async () => {
            persistedMatchRun = await createMatchRun({
                matchRunData,
                session
            });

            await updateRequirementAfterMatching({
                orgId,
                requirementId,
                matchRunId: persistedMatchRun._id,
                updatedBy: executedBy,
                session
            });
        });
    } finally {
        await session.endSession();
    }

    return persistedMatchRun;
};
