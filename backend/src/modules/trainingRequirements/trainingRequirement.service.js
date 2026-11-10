
import mongoose from "mongoose";

import TrainingRequirement from "./trainingRequirement.model.js";
import Competency from "../competencies/competency.model.js";
import Skill from "../skills/skill.model.js";

import { HTTP_STATUS } from "../../core/constants/index.js";

import AppError from "../../core/errors/AppError.js";

/**
 * Creates a standardized training requirement error.
 *
 * @param {string} message - Error message.
 * @param {number} statusCode - HTTP response status.
 * @param {string} code - Application error code.
 * @returns {AppError}
 */
const createTrainingRequirementError = (
    message,
    statusCode = HTTP_STATUS.BAD_REQUEST,
    code = "VALIDATION_ERROR"
) => {
    return new AppError(message, statusCode, code);
};

/**
 * Executes a training requirement operation inside a MongoDB transaction.
 *
 * Transactions ensure that related database operations either complete
 * together or are rolled back.
 *
 * Requires MongoDB transaction support through a replica set or sharded cluster.
 *
 * @param {Function} callback - Transaction operation.
 * @returns {Promise<*>}
 */
const executeRequirementTransaction = async (callback) => {
    const session = await mongoose.startSession();

    try {
        let result;

        await session.withTransaction(async () => {
            result = await callback(session);
        });

        return result;
    } finally {
        await session.endSession();
    }
};

/**
 * Escapes special regular expression characters in search input.
 *
 * This prevents user-provided search text from being interpreted
 * as a regular expression pattern.
 *
 * @param {string} value - Search text.
 * @returns {string}
 */
const escapeRegex = (value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Ensures that a training requirement contains at least one criterion.
 *
 * @param {Object} data - Training requirement data.
 * @throws {AppError} When no trainer requirement is provided.
 */
const assertRequirementHasCriteria = (data) => {
    const hasCriteria =
        (data.competencies?.length ?? 0) > 0 ||
        (data.requiredSkills?.length ?? 0) > 0 ||
        (data.qualificationKeywords?.length ?? 0) > 0 ||
        (data.requiredCertifications?.length ?? 0) > 0 ||
        (data.minimumExperienceYears ?? 0) > 0 ||
        (data.minimumTeachingYears ?? 0) > 0;

    if (!hasCriteria) {
        throw createTrainingRequirementError(
            "At least one trainer requirement must be provided."
        );
    }
};

/**
 * Validates competency and skill references against the selected organization.
 *
 * Only active competencies and skills belonging to the same organization
 * can be included in a training requirement.
 *
 * Duplicate references are normalized before checking.
 *
 * @param {Object} options
 * @param {string} options.orgId - Organization identifier.
 * @param {Array} options.competencyIds - Competency identifiers.
 * @param {Array} options.skillIds - Skill identifiers.
 * @param {mongoose.ClientSession} options.session - Transaction session.
 */
const assertOrganizationReferences = async ({
    orgId,
    competencyIds = [],
    skillIds = [],
    session
}) => {
    const uniqueCompetencyIds = [
        ...new Set(competencyIds.map(String))
    ];

    const uniqueSkillIds = [
        ...new Set(skillIds.map(String))
    ];

    // Verify that every competency belongs to this organization and is active.
    if (uniqueCompetencyIds.length > 0) {
        const competencies = await Competency.find({
            _id: { $in: uniqueCompetencyIds },
            org: orgId,
            status: "active"
        })
            .select("_id")
            .session(session)
            .lean();

        if (competencies.length !== uniqueCompetencyIds.length) {
            throw createTrainingRequirementError(
                "One or more competencies are invalid, inactive, or belong to another organization."
            );
        }
    }

    // Verify that every skill belongs to this organization and is active.
    if (uniqueSkillIds.length > 0) {
        const skills = await Skill.find({
            _id: { $in: uniqueSkillIds },
            org: orgId,
            status: "active"
        })
            .select("_id")
            .session(session)
            .lean();

        if (skills.length !== uniqueSkillIds.length) {
            throw createTrainingRequirementError(
                "One or more skills are invalid, inactive, or belong to another organization."
            );
        }
    }
};

/**
 * Validates all competency and skill references contained in requirement data.
 *
 * @param {Object} options
 * @param {string} options.orgId - Organization identifier.
 * @param {Object} options.data - Requirement data.
 * @param {mongoose.ClientSession} options.session - Transaction session.
 */
const validateRequirementReferences = async ({
    orgId,
    data,
    session
}) => {
    await assertOrganizationReferences({
        orgId,
        competencyIds: (data.competencies ?? []).map(
            (item) => item.competency
        ),
        skillIds: (data.requiredSkills ?? []).map(
            (item) => item.skill
        ),
        session
    });
};

/**
 * Finds a training requirement belonging to the selected organization.
 *
 * The organization condition prevents access to another organization's
 * training requirements.
 *
 * @param {Object} options
 * @param {string} options.requirementId - Requirement identifier.
 * @param {string} options.orgId - Organization identifier.
 * @param {mongoose.ClientSession|null} options.session - Optional session.
 * @returns {Promise<Object>}
 * @throws {AppError} When the requirement does not exist in the organization.
 */
const getRequirementByIdOrFail = async ({
    requirementId,
    orgId,
    session = null
}) => {
    let query = TrainingRequirement.findOne({
        _id: requirementId,
        org: orgId
    });

    if (session) {
        query = query.session(session);
    }

    const requirement = await query;

    if (!requirement) {
        throw createTrainingRequirementError(
            "Training requirement not found.",
            HTTP_STATUS.NOT_FOUND,
            "NOT_FOUND"
        );
    }

    return requirement;
};

/**
 * Prevents editing requirements that have entered a later workflow state.
 *
 * Matched, assigned, cancelled and archived requirements cannot be
 * edited through the ordinary update operation.
 *
 * @param {Object} requirement - Training requirement document.
 * @throws {AppError} When the requirement is not editable.
 */
const assertEditableRequirement = (requirement) => {
    if (
        ["matched", "assigned", "cancelled", "archived"].includes(
            requirement.status
        )
    ) {
        throw createTrainingRequirementError(
            "This training requirement can no longer be edited.",
            HTTP_STATUS.CONFLICT,
            "CONFLICT"
        );
    }
};

/**
 * Restricts status changes available through ordinary administrator operations.
 *
 * Matching and assignment workflows must manage their own lifecycle states.
 *
 * @param {string|undefined} status - Requested status.
 * @throws {AppError} When a workflow-controlled status is requested.
 */
const assertAllowedManualStatus = (status) => {
    if (
        status !== undefined &&
        !["draft", "ready", "cancelled"].includes(status)
    ) {
        throw createTrainingRequirementError(
            "This status can only be changed by the corresponding workflow.",
            HTTP_STATUS.BAD_REQUEST,
            "VALIDATION_ERROR"
        );
    }
};

/**
 * Converts a training requirement document into a controlled response object.
 *
 * This prevents internal Mongoose document details from being exposed.
 *
 * @param {Object} requirement - Training requirement document or plain object.
 * @returns {Object|null}
 */
const serializeTrainingRequirement = (requirement) => {
    if (!requirement) {
        return null;
    }

    const data = requirement.toObject
        ? requirement.toObject()
        : requirement;

    return {
        id: data._id,
        orgId: data.org,
        title: data.title,
        description: data.description,
        competencies: data.competencies,
        requiredSkills: data.requiredSkills,
        qualificationKeywords: data.qualificationKeywords,
        qualificationMustHave: data.qualificationMustHave,
        requiredCertifications: data.requiredCertifications,
        minimumExperienceYears: data.minimumExperienceYears,
        minimumTeachingYears: data.minimumTeachingYears,
        status: data.status,
        latestMatchRun: data.latestMatchRun,
        createdBy: data.createdBy,
        updatedBy: data.updatedBy,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
    };
};

/**
 * Creates a new training requirement for an organization.
 *
 * Organization ownership and creator identity are assigned by the server.
 * Competency and skill references are validated before creation.
 *
 * @param {Object} options
 * @param {string} options.orgId - Organization identifier.
 * @param {string} options.adminId - Creating administrator identifier.
 * @param {Object} options.data - Validated requirement data.
 * @returns {Promise<Object>}
 */
export const createTrainingRequirement = async ({
    orgId,
    adminId,
    data
}) => {
    return executeRequirementTransaction(async (session) => {
        assertAllowedManualStatus(data.status);

        assertRequirementHasCriteria(data);

        await validateRequirementReferences({
            orgId,
            data,
            session
        });

        const [requirement] = await TrainingRequirement.create(
            [
                {
                    ...data,
                    org: orgId,
                    status: data.status ?? "draft",
                    createdBy: adminId,
                    updatedBy: adminId
                }
            ],
            { session }
        );

        return serializeTrainingRequirement(requirement);
    });
};

/**
 * Retrieves paginated training requirements belonging to an organization.
 *
 * Supports filtering by lifecycle status and searching by title
 * or description.
 *
 * @param {Object} options
 * @param {string} options.orgId - Organization identifier.
 * @param {number} options.page - Page number.
 * @param {number} options.limit - Number of results per page.
 * @param {string} options.status - Optional lifecycle status.
 * @param {string} options.search - Optional search text.
 * @returns {Promise<Object>}
 */
export const listTrainingRequirements = async ({
    orgId,
    page = 1,
    limit = 20,
    status,
    search
}) => {
    const filter = { org: orgId };

    if (status) {
        filter.status = status;
    }

    if (search) {
        const safeSearch = escapeRegex(search);

        filter.$or = [
            { title: { $regex: safeSearch, $options: "i" } },
            { description: { $regex: safeSearch, $options: "i" } }
        ];
    }

    const skip = (page - 1) * limit;

    const [requirements, total] = await Promise.all([
        TrainingRequirement.find(filter)
            .sort({ updatedAt: -1, _id: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),

        TrainingRequirement.countDocuments(filter)
    ]);

    return {
        requirements: requirements.map(serializeTrainingRequirement),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

/**
 * Retrieves one training requirement belonging to an organization.
 *
 * @param {Object} options
 * @param {string} options.requirementId - Requirement identifier.
 * @param {string} options.orgId - Organization identifier.
 * @returns {Promise<Object>}
 */
export const getTrainingRequirementById = async ({
    requirementId,
    orgId
}) => {
    const requirement = await getRequirementByIdOrFail({
        requirementId,
        orgId
    });

    return serializeTrainingRequirement(requirement);
};

/**
 * Updates an existing editable training requirement.
 *
 * Existing competency and skill references are revalidated together
 * with any replacement references.
 *
 * The update preserves fields omitted from the request.
 *
 * @param {Object} options
 * @param {string} options.requirementId - Requirement identifier.
 * @param {string} options.orgId - Organization identifier.
 * @param {string} options.adminId - Updating administrator identifier.
 * @param {Object} options.data - Validated update data.
 * @returns {Promise<Object>}
 */
export const updateTrainingRequirement = async ({
    requirementId,
    orgId,
    adminId,
    data
}) => {
    return executeRequirementTransaction(async (session) => {
        assertAllowedManualStatus(data.status);

        const requirement = await getRequirementByIdOrFail({
            requirementId,
            orgId,
            session
        });

        assertEditableRequirement(requirement);

        // Merge existing criteria with submitted fields before validation.
        const updatedData = {
            ...data
        };

        if (updatedData.competencies === undefined) {
            updatedData.competencies = requirement.competencies;
        }

        if (updatedData.requiredSkills === undefined) {
            updatedData.requiredSkills = requirement.requiredSkills;
        }

        if (updatedData.minimumExperienceYears === undefined) {
            updatedData.minimumExperienceYears =
                requirement.minimumExperienceYears;
        }

        if (updatedData.minimumTeachingYears === undefined) {
            updatedData.minimumTeachingYears =
                requirement.minimumTeachingYears;
        }

        if (updatedData.qualificationKeywords === undefined) {
            updatedData.qualificationKeywords =
                requirement.qualificationKeywords;
        }

        if (updatedData.requiredCertifications === undefined) {
            updatedData.requiredCertifications =
                requirement.requiredCertifications;
        }

        assertRequirementHasCriteria(updatedData);

        await validateRequirementReferences({
            orgId,
            data: updatedData,
            session
        });

        Object.assign(requirement, data);

        requirement.updatedBy = adminId;

        await requirement.save({ session });

        return serializeTrainingRequirement(requirement);
    });
};

/**
 * Archives a training requirement belonging to an organization.
 *
 * Assigned requirements cannot be archived through this operation
 * because they may already be associated with an active assignment.
 *
 * @param {Object} options
 * @param {string} options.requirementId - Requirement identifier.
 * @param {string} options.orgId - Organization identifier.
 * @param {string} options.adminId - Archiving administrator identifier.
 * @returns {Promise<Object>}
 */
export const archiveTrainingRequirement = async ({
    requirementId,
    orgId,
    adminId
}) => {
    return executeRequirementTransaction(async (session) => {
        const requirement = await getRequirementByIdOrFail({
            requirementId,
            orgId,
            session
        });

        if (requirement.status === "assigned") {
            throw createTrainingRequirementError(
                "An assigned training requirement cannot be archived.",
                HTTP_STATUS.CONFLICT,
                "CONFLICT"
            );
        }

        if (requirement.status === "archived") {
            throw createTrainingRequirementError(
                "Training requirement is already archived.",
                HTTP_STATUS.CONFLICT,
                "CONFLICT"
            );
        }

        requirement.status = "archived";
        requirement.updatedBy = adminId;

        await requirement.save({ session });

        return serializeTrainingRequirement(requirement);
    });
};
