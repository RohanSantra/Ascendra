
import Skill from "./skill.model.js";
import Competency from "../competencies/competency.model.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../core/constants/index.js";

import AppError from "../../core/errors/AppError.js";

import assertOrganizationReferences from "../../core/utils/organizationReferences.js";

/**
 * @name createSkillError
 * @description Creates a standardized application error.
 *
 * @param {string} message - Error message.
 * @param {number} statusCode - HTTP status code.
 * @param {string} code - Application error code.
 * @returns {AppError} Application error instance.
 */
const createSkillError = (message, statusCode, code) => {
    return new AppError(message, statusCode, code);
};

/**
 * @name generateSlug
 * @description Converts a skill name into a URL-friendly slug.
 *
 * @param {string} value - Skill name or slug.
 * @returns {string} Generated slug.
 */
const generateSlug = (value) => {
    return value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 140)
        .replace(/-+$/g, "");
};

/**
 * @name escapeRegex
 * @description Escapes special regex characters in search input.
 *
 * @param {string} value - Search input.
 * @returns {string} Escaped search value.
 */
const escapeRegex = (value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * @name serializeSkill
 * @description Converts a skill document into a safe response object.
 *
 * @param {Object} skill - Skill document or plain object.
 * @returns {Object} Serialized skill.
 */
const serializeSkill = (skill) => {
    return {
        id: skill._id.toString(),
        org: skill.org.toString(),
        name: skill.name,
        slug: skill.slug,
        description: skill.description,
        category: skill.category,
        competencies: (skill.competencies || []).map(
            (competency) => competency._id
                ? competency._id.toString()
                : competency.toString()
        ),
        status: skill.status,
        createdBy: skill.createdBy.toString(),
        updatedBy: skill.updatedBy
            ? skill.updatedBy.toString()
            : null,
        createdAt: skill.createdAt,
        updatedAt: skill.updatedAt
    };
};

/**
 * @name handleDuplicateKeyError
 * @description Converts MongoDB duplicate key errors into
 * standardized conflict errors.
 *
 * @param {Error} error - Original database error.
 * @throws {AppError} When a duplicate key is detected.
 */
const handleDuplicateKeyError = (error) => {
    if (error?.code === 11000) {
        throw createSkillError(
            "A skill with this slug already exists.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_ALREADY_EXISTS
        );
    }

    throw error;
};

/**
 * @name validateCompetencies
 * @description Validates that all competency references exist
 * within the organization and are active.
 *
 * @param {Object} params - Validation parameters.
 * @param {string} params.orgId - Organization ID.
 * @param {string[]} params.competencyIds - Competency IDs.
 * @returns {Promise<ObjectId[]>} Validated competency IDs.
 */
const validateCompetencies = async ({
    orgId,
    competencyIds = []
}) => {
    if (!competencyIds.length) {
        return [];
    }

    const validIds = await assertOrganizationReferences({
        model: Competency,
        ids: competencyIds,
        organizationId: orgId,
        resourceName: "Competency"
    });

    const activeCount = await Competency.countDocuments({
        _id: {
            $in: validIds
        },
        org: orgId,
        status: "active"
    });

    if (activeCount !== validIds.length) {
        throw createSkillError(
            "One or more competencies are archived or unavailable.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    return validIds;
};

/**
 * @name createSkill
 * @description Creates a new skill for an organization.
 *
 * @param {Object} params - Skill creation parameters.
 * @param {string} params.orgId - Organization ID.
 * @param {string} params.adminId - Administrator user ID.
 * @param {Object} params.data - Validated skill data.
 * @returns {Promise<Object>} Created skill.
 */
export const createSkill = async ({
    orgId,
    adminId,
    data
}) => {
    try {
        const slug = generateSlug(data.slug || data.name);

        if (!slug) {
            throw createSkillError(
                "A valid skill slug could not be generated.",
                HTTP_STATUS.BAD_REQUEST,
                ERROR_CODES.VALIDATION_ERROR
            );
        }


        const competencies = await validateCompetencies({
            orgId,
            competencyIds: data.competencies || []
        });

        const skill = await Skill.create({
            org: orgId,
            name: data.name,
            slug,
            description: data.description,
            category: data.category,
            competencies,
            status: "active",
            createdBy: adminId
        });

        return serializeSkill(skill);
    } catch (error) {
        handleDuplicateKeyError(error);
    }
};

/**
 * @name listSkills
 * @description Retrieves organization skills with pagination,
 * search, and optional filters.
 *
 * @param {Object} params - List parameters.
 * @param {string} params.orgId - Organization ID.
 * @param {number} params.page - Page number.
 * @param {number} params.limit - Records per page.
 * @param {string} [params.search] - Search term.
 * @param {string} [params.category] - Category filter.
 * @param {string} [params.competencyId] - Competency filter.
 * @param {string} [params.status="active"] - Status filter.
 * @returns {Promise<Object>} Skills and pagination information.
 */
export const listSkills = async ({
    orgId,
    page,
    limit,
    search,
    category,
    competencyId,
    status = "active"
}) => {
    const filter = {
        org: orgId
    };

    if (status !== "all") {
        filter.status = status;
    }

    if (category) {
        filter.category = category;
    }

    if (competencyId) {
        filter.competencies = competencyId;
    }

    if (search) {
        const searchRegex = new RegExp(
            escapeRegex(search),
            "i"
        );

        filter.$or = [
            { name: searchRegex },
            { slug: searchRegex },
            { description: searchRegex }
        ];
    }

    const skip = (page - 1) * limit;

    const [skills, total] = await Promise.all([
        Skill.find(filter)
            .sort({ name: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),

        Skill.countDocuments(filter)
    ]);

    return {
        items: skills.map(serializeSkill),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

/**
 * @name getSkillById
 * @description Retrieves a skill belonging to an organization.
 *
 * @param {Object} params - Retrieval parameters.
 * @param {string} params.skillId - Skill ID.
 * @param {string} params.orgId - Organization ID.
 * @returns {Promise<Object>} Retrieved skill.
 */
export const getSkillById = async ({
    skillId,
    orgId
}) => {
    const skill = await Skill.findOne({
        _id: skillId,
        org: orgId
    }).lean();

    if (!skill) {
        throw createSkillError(
            "Skill not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    return serializeSkill(skill);
};

/**
 * @name updateSkill
 * @description Updates an existing organization skill.
 *
 * @param {Object} params - Update parameters.
 * @param {string} params.skillId - Skill ID.
 * @param {string} params.orgId - Organization ID.
 * @param {string} params.adminId - Administrator user ID.
 * @param {Object} params.data - Validated update data.
 * @returns {Promise<Object>} Updated skill.
 */
export const updateSkill = async ({
    skillId,
    orgId,
    adminId,
    data
}) => {
    try {
        const skill = await Skill.findOne({
            _id: skillId,
            org: orgId
        });

        if (!skill) {
            throw createSkillError(
                "Skill not found.",
                HTTP_STATUS.NOT_FOUND,
                ERROR_CODES.RESOURCE_NOT_FOUND
            );
        }

        if (skill.status === "archived") {
            throw createSkillError(
                "Archived skills cannot be updated.",
                HTTP_STATUS.CONFLICT,
                ERROR_CODES.RESOURCE_CONFLICT
            );
        }

        if (data.name !== undefined) {
            skill.name = data.name;

            if (data.slug === undefined) {
                skill.slug = generateSlug(data.name);
            }
        }

        if (data.slug !== undefined) {
            skill.slug = generateSlug(data.slug);
        }

        if (!skill.slug) {
            throw createSkillError(
                "A valid skill slug could not be generated.",
                HTTP_STATUS.BAD_REQUEST,
                ERROR_CODES.VALIDATION_ERROR
            );
        }

        if (data.description !== undefined) {
            skill.description = data.description;
        }

        if (data.category !== undefined) {
            skill.category = data.category;
        }

        if (data.competencies !== undefined) {
            skill.competencies = await validateCompetencies({
                orgId,
                competencyIds: data.competencies
            });
        }

        skill.updatedBy = adminId;

        await skill.save();

        return serializeSkill(skill);
    } catch (error) {
        handleDuplicateKeyError(error);
    }
};

/**
 * @name archiveSkill
 * @description Archives a skill without permanently deleting it.
 *
 * @param {Object} params - Archive parameters.
 * @param {string} params.skillId - Skill ID.
 * @param {string} params.orgId - Organization ID.
 * @param {string} params.adminId - Administrator user ID.
 * @returns {Promise<Object>} Archived skill.
 */
export const archiveSkill = async ({
    skillId,
    orgId,
    adminId
}) => {
    const skill = await Skill.findOne({
        _id: skillId,
        org: orgId
    });

    if (!skill) {
        throw createSkillError(
            "Skill not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    if (skill.status === "archived") {
        throw createSkillError(
            "Skill is already archived.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    skill.status = "archived";
    skill.updatedBy = adminId;

    await skill.save();

    return serializeSkill(skill);
};
