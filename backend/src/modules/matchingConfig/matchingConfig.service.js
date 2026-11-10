
import mongoose from "mongoose";

import MatchingConfig from "./matchingConfig.model.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../core/constants/index.js";

import AppError from "../../core/errors/AppError.js";

/**
 * Creates a standardized matching configuration error.
 *
 * @param {string} message - Error message.
 * @param {number} statusCode - HTTP status code.
 * @param {string} code - Application error code.
 * @returns {AppError}
 */
const createMatchingConfigError = (
    message,
    statusCode = HTTP_STATUS.BAD_REQUEST,
    code = ERROR_CODES.VALIDATION_ERROR
) => new AppError(message, statusCode, code);

/**
 * Executes a matching configuration transaction.
 *
 * All configuration version creation and activation operations
 * use transactions to preserve version and activation consistency.
 *
 * @param {Function} callback - Transaction callback.
 * @returns {Promise<*>}
 */
const executeMatchingConfigTransaction = async (callback) => {
    const session = await mongoose.startSession();

    try {
        let result;

        await session.withTransaction(async () => {
            result = await callback(session);
        });

        return result;
    } catch (error) {
        // Convert duplicate-key conflicts into application errors.
        if (error.code === 11000) {
            throw createMatchingConfigError(
                "A matching configuration version or active configuration already exists.",
                HTTP_STATUS.CONFLICT,
                ERROR_CODES.RESOURCE_CONFLICT
            );
        }

        throw error;
    } finally {
        await session.endSession();
    }
};

/**
 * Validates the top-level fields accepted when creating
 * or updating a matching configuration version.
 *
 * Configuration ownership, version and activation fields
 * are controlled by the service, not by the client.
 *
 * @param {Object} data - Configuration input.
 * @throws {AppError} If unsupported fields are supplied.
 */
const validateConfigurationInput = (data) => {
    if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data)
    ) {
        throw createMatchingConfigError(
            "Matching configuration data must be an object."
        );
    }

    const allowedFields = [
        "weights",
        "thresholds",
        "evidenceRules",
        "proficiencyLevels",
        "tieBreakOrder",
        "defaultResultLimit",
        "algorithmVersion"
    ];

    const unsupportedFields = Object.keys(data).filter(
        (key) => !allowedFields.includes(key)
    );

    if (unsupportedFields.length > 0) {
        throw createMatchingConfigError(
            `Unsupported matching configuration fields: ${unsupportedFields.join(", ")}.`
        );
    }
};

/**
 * Validates the complete configuration after Mongoose defaults
 * have been applied.
 *
 * @param {Object} config - Matching configuration document.
 * @throws {AppError} If configuration values are inconsistent.
 */
const validateMatchingConfiguration = (config) => {
    const validationError = (message) => {
        throw createMatchingConfigError(
            message,
            HTTP_STATUS.UNPROCESSABLE_ENTITY,
            ERROR_CODES.VALIDATION_ERROR
        );
    };

    const isFiniteNumber = (value) =>
        typeof value === "number" && Number.isFinite(value);

    const isWithinRange = (value, min, max) =>
        isFiniteNumber(value) && value >= min && value <= max;

    /**
     * Validate scoring weights.
     */
    const expectedWeightKeys = [
        "competency",
        "skills",
        "qualification",
        "experience",
        "teaching",
        "certification"
    ];

    const weights = config.weights?.toObject
        ? config.weights.toObject()
        : config.weights;

    if (
        !weights ||
        expectedWeightKeys.some(
            (key) => !Object.hasOwn(weights, key)
        )
    ) {
        validationError(
            "Matching configuration must contain all scoring weights."
        );
    }

    if (
        Object.keys(weights).some(
            (key) => !expectedWeightKeys.includes(key)
        )
    ) {
        validationError(
            "Matching configuration contains unsupported scoring weights."
        );
    }

    const weightValues = Object.values(weights);

    if (
        weightValues.some(
            (weight) =>
                !isFiniteNumber(weight) || weight < 0
        )
    ) {
        validationError(
            "Matching weights must be finite non-negative numbers."
        );
    }

    if (!weightValues.some((weight) => weight > 0)) {
        validationError(
            "At least one matching factor must have a positive weight."
        );
    }

    /**
     * Validate matching thresholds.
     *
     * The strong threshold must be strictly greater than
     * the partial threshold.
     */
    const { strong, partial } = config.thresholds ?? {};

    if (
        !isWithinRange(strong, 0, 1) ||
        !isWithinRange(partial, 0, 1) ||
        strong <= partial
    ) {
        validationError(
            "The strong matching threshold must be greater than the partial threshold."
        );
    }

    /**
     * Validate evidence scoring rules.
     */
    const evidenceRules = config.evidenceRules ?? {};

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
        if (
            !isFiniteNumber(evidenceRules[key]) ||
            evidenceRules[key] < 0
        ) {
            validationError(
                `Evidence rule '${key}' must be a finite non-negative number.`
            );
        }
    }

    if (
        !isFiniteNumber(evidenceRules.assessmentScoreDivisor) ||
        evidenceRules.assessmentScoreDivisor <= 0
    ) {
        validationError(
            "Assessment score divisor must be greater than zero."
        );
    }

    if (
        !isFiniteNumber(evidenceRules.halfLifeYears) ||
        evidenceRules.halfLifeYears <= 0
    ) {
        validationError(
            "Evidence half-life must be greater than zero."
        );
    }

    if (
        !isWithinRange(
            evidenceRules.diminishingReturnFactor,
            0,
            1
        )
    ) {
        validationError(
            "Evidence diminishing return factor must be between zero and one."
        );
    }

    if (
        !isWithinRange(evidenceRules.verifiedTrust, 0, 1) ||
        !isWithinRange(evidenceRules.selfReportedTrust, 0, 1)
    ) {
        validationError(
            "Evidence trust values must be between zero and one."
        );
    }

    /**
     * Validate competency proficiency boundaries.
     *
     * Each proficiency level must have a strictly higher
     * minimum point requirement than the previous level.
     */
    const proficiencyLevels = config.proficiencyLevels ?? {};

    const proficiencyValues = [
        proficiencyLevels.beginner,
        proficiencyLevels.intermediate,
        proficiencyLevels.advanced,
        proficiencyLevels.expert
    ];

    if (
        proficiencyValues.some(
            (value) =>
                !isFiniteNumber(value) || value < 0
        )
    ) {
        validationError(
            "All proficiency levels must contain finite non-negative point values."
        );
    }

    for (let index = 1; index < proficiencyValues.length; index++) {
        if (proficiencyValues[index] <= proficiencyValues[index - 1]) {
            validationError(
                "Proficiency thresholds must increase from beginner to expert."
            );
        }
    }

    /**
     * Validate deterministic tie-breaking criteria.
     */
    const allowedTieBreakCriteria = [
        "verifiedRatio",
        "recency",
        "load",
        "profileCompletedAt"
    ];

    if (!Array.isArray(config.tieBreakOrder)) {
        validationError(
            "Matching tie-break order must be an array."
        );
    }

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

    /**
     * Validate the maximum number of matching results.
     */
    if (
        !Number.isInteger(config.defaultResultLimit) ||
        config.defaultResultLimit < 1 ||
        config.defaultResultLimit > 100
    ) {
        validationError(
            "Matching result limit must be an integer between 1 and 100."
        );
    }

    /**
     * Validate the matching algorithm version.
     */
    if (
        typeof config.algorithmVersion !== "string" ||
        !config.algorithmVersion.trim()
    ) {
        validationError(
            "A valid matching algorithm version is required."
        );
    }
};

/**
 * Creates a validated Mongoose matching configuration document.
 *
 * Mongoose applies the model's default values before the
 * cross-field configuration checks are performed.
 *
 * @param {Object} params - Configuration parameters.
 * @param {string} params.orgId - Organization ID.
 * @param {number} params.version - Configuration version.
 * @param {string} params.adminId - Administrator ID.
 * @param {Object} params.data - Configuration settings.
 * @param {Object} [params.session] - MongoDB session.
 * @returns {Promise<MatchingConfig>}
 */
const buildMatchingConfigDocument = async ({
    orgId,
    version,
    adminId,
    data,
    session
}) => {
    validateConfigurationInput(data);

    const matchingConfig = new MatchingConfig({
        org: orgId,
        version,
        isActive: false,
        ...data,
        createdBy: adminId,
        updatedBy: null
    });

    await matchingConfig.validate({
        ...(session ? { session } : {})
    });

    validateMatchingConfiguration(matchingConfig.toObject());

    return matchingConfig;
};

/**
 * Serializes a matching configuration document.
 *
 * @param {Object} config - Matching configuration.
 * @returns {Object|null}
 */
const serializeMatchingConfig = (config) => {
    if (!config) return null;

    const data = config.toObject
        ? config.toObject()
        : config;

    return {
        id: String(data._id),
        orgId: String(data.org),
        version: data.version,
        isActive: data.isActive,
        weights: data.weights,
        thresholds: data.thresholds,
        evidenceRules: data.evidenceRules,
        proficiencyLevels: data.proficiencyLevels,
        tieBreakOrder: data.tieBreakOrder,
        defaultResultLimit: data.defaultResultLimit,
        algorithmVersion: data.algorithmVersion,
        createdBy: data.createdBy,
        updatedBy: data.updatedBy,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
    };
};

/**
 * Retrieves the active matching configuration for an organization.
 *
 * @param {Object} params - Retrieval parameters.
 * @param {string} params.orgId - Organization ID.
 * @returns {Promise<Object>}
 * @throws {AppError} If no active configuration exists.
 */
export const getActiveMatchingConfig = async ({ orgId }) => {
    const matchingConfig = await MatchingConfig.findOne({
        org: orgId,
        isActive: true
    }).lean();

    if (!matchingConfig) {
        throw createMatchingConfigError(
            "Active matching configuration not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    return serializeMatchingConfig(matchingConfig);
};

/**
 * Lists configuration versions belonging to an organization.
 *
 * @param {Object} params - Listing parameters.
 * @param {string} params.orgId - Organization ID.
 * @param {number} [params.page=1] - Page number.
 * @param {number} [params.limit=20] - Page size.
 * @returns {Promise<Object>}
 */
export const listMatchingConfigVersions = async ({
    orgId,
    page = 1,
    limit = 20
}) => {
    const skip = (page - 1) * limit;

    const [configs, total] = await Promise.all([
        MatchingConfig.find({ org: orgId })
            .sort({ version: -1, _id: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),

        MatchingConfig.countDocuments({ org: orgId })
    ]);

    return {
        configurations: configs.map(serializeMatchingConfig),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

/**
 * Creates the initial matching configuration for an organization.
 *
 * Only one initial configuration can be created. It becomes
 * the organization's first active configuration, using version 1.
 *
 * @param {Object} params - Creation parameters.
 * @param {string} params.orgId - Organization ID.
 * @param {string} params.adminId - Administrator ID.
 * @param {Object} [params.data={}] - Initial configuration settings.
 * @returns {Promise<Object>}
 * @throws {AppError} If a configuration already exists.
 */
export const createInitialMatchingConfig = async ({
    orgId,
    adminId,
    data = {}
}) => {
    return executeMatchingConfigTransaction(async (session) => {
        const existingConfig = await MatchingConfig.findOne({
            org: orgId
        }).session(session).lean();

        if (existingConfig) {
            throw createMatchingConfigError(
                "A matching configuration has already been created for this organization.",
                HTTP_STATUS.CONFLICT,
                ERROR_CODES.RESOURCE_CONFLICT
            );
        }

        const matchingConfig = await buildMatchingConfigDocument({
            orgId,
            version: 1,
            adminId,
            data,
            session
        });

        matchingConfig.isActive = true;

        await matchingConfig.save({ session });

        return serializeMatchingConfig(matchingConfig);
    });
};

/**
 * Creates a new inactive matching configuration version.
 *
 * Existing versions are never overwritten. Unspecified settings
 * are inherited from the latest configuration version.
 *
 * The new version must be activated separately.
 *
 * @param {Object} params - Creation parameters.
 * @param {string} params.orgId - Organization ID.
 * @param {string} params.adminId - Administrator ID.
 * @param {Object} params.data - Settings to override.
 * @returns {Promise<Object>}
 */
export const createMatchingConfigVersion = async ({
    orgId,
    adminId,
    data
}) => {
    return executeMatchingConfigTransaction(async (session) => {
        validateConfigurationInput(data);

        const latestConfig = await MatchingConfig.findOne({
            org: orgId
        })
            .sort({ version: -1 })
            .session(session)
            .lean();
            
        if (!latestConfig) {
            throw createMatchingConfigError(
                "Create the initial matching configuration before creating additional versions.",
                HTTP_STATUS.CONFLICT,
                ERROR_CODES.RESOURCE_CONFLICT
            );
        }

        const nextVersion = latestConfig
            ? latestConfig.version + 1
            : 1;

        const inheritedSettings = latestConfig
            ? {
                weights: latestConfig.weights,
                thresholds: latestConfig.thresholds,
                evidenceRules: latestConfig.evidenceRules,
                proficiencyLevels: latestConfig.proficiencyLevels,
                tieBreakOrder: latestConfig.tieBreakOrder,
                defaultResultLimit: latestConfig.defaultResultLimit,
                algorithmVersion: latestConfig.algorithmVersion
            }
            : {};

        const mergedData = {
            ...inheritedSettings,
            ...data,
            weights: {
                ...inheritedSettings.weights,
                ...data.weights
            },
            thresholds: {
                ...inheritedSettings.thresholds,
                ...data.thresholds
            },
            evidenceRules: {
                ...inheritedSettings.evidenceRules,
                ...data.evidenceRules
            },
            proficiencyLevels: {
                ...inheritedSettings.proficiencyLevels,
                ...data.proficiencyLevels
            }
        };

        const matchingConfig = await buildMatchingConfigDocument({
            orgId,
            version: nextVersion,
            adminId,
            data: mergedData,
            session
        });

        await matchingConfig.save({ session });

        return serializeMatchingConfig(matchingConfig);
    });
};

/**
 * Activates a previously created matching configuration version.
 *
 * The previous active configuration is deactivated in the same
 * transaction before the selected version is activated.
 *
 * Configuration scoring settings are never modified here.
 *
 * @param {Object} params - Activation parameters.
 * @param {string} params.orgId - Organization ID.
 * @param {string} params.configId - Configuration document ID.
 * @param {string} params.adminId - Administrator ID.
 * @returns {Promise<Object>}
 * @throws {AppError} If the requested version does not exist.
 */
export const activateMatchingConfigVersion = async ({
    orgId,
    configId,
    adminId
}) => {
    return executeMatchingConfigTransaction(async (session) => {
        const targetConfig = await MatchingConfig.findOne({
            _id: configId,
            org: orgId
        }).session(session);

        if (!targetConfig) {
            throw createMatchingConfigError(
                "Matching configuration version not found.",
                HTTP_STATUS.NOT_FOUND,
                ERROR_CODES.RESOURCE_NOT_FOUND
            );
        }

        // Avoid unnecessary writes when the requested version is active.
        if (targetConfig.isActive) {
            return serializeMatchingConfig(targetConfig);
        }

        // Deactivate the current version before activating another.
        await MatchingConfig.updateOne(
            {
                org: orgId,
                isActive: true
            },
            {
                $set: {
                    isActive: false,
                    updatedBy: adminId
                }
            },
            { session }
        );

        targetConfig.isActive = true;
        targetConfig.updatedBy = adminId;

        await targetConfig.save({ session });

        return serializeMatchingConfig(targetConfig);
    });
};
