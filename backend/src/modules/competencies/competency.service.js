import Competency from "./competency.model.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../core/constants/index.js";

import AppError from "../../core/errors/AppError.js";

/**
 * Creates a controlled competency error.
 *
 * @name createCompetencyError
 * @param {string} message - Error message.
 * @param {number} statusCode - HTTP status code.
 * @param {string} code - Application error code.
 * @returns {AppError} Controlled application error.
 */
const createCompetencyError = (message, statusCode, code) => {
    return new AppError(message, statusCode, code);
};

/**
 * Converts a competency name into a URL-friendly slug.
 *
 * @name generateSlug
 * @param {string} value - Competency name.
 * @returns {string} Generated slug.
 */
const generateSlug = (value) => {
    return value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 140)
        .replace(/-+$/g, "");
};

/**
 * Escapes special regular expression characters.
 *
 * @name escapeRegex
 * @param {string} value - Search value.
 * @returns {string} Escaped regular expression value.
 */
const escapeRegex = (value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Serializes a competency into a safe response object.
 *
 * @name serializeCompetency
 * @param {Object} competency - Competency document.
 * @returns {Object} Public competency information.
 */
const serializeCompetency = (competency) => {
    return {
        id: competency._id.toString(),
        org: competency.org.toString(),
        name: competency.name,
        slug: competency.slug,
        description: competency.description ?? "",
        category: competency.category ?? "",
        status: competency.status,
        createdBy: competency.createdBy.toString(),
        updatedBy: competency.updatedBy?.toString() ?? null,
        createdAt: competency.createdAt,
        updatedAt: competency.updatedAt
    };
};

/**
 * Handles MongoDB duplicate-key errors.
 *
 * @name handleDuplicateKeyError
 * @param {Error} error - Database error.
 * @throws {AppError} When a duplicate slug exists.
 */
const handleDuplicateKeyError = (error) => {
    if (error?.code === 11000) {
        throw createCompetencyError(
            "A competency with this slug already exists.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_ALREADY_EXISTS
        );
    }

    throw error;
};

/**
 * Creates a competency within an organization.
 *
 * @name createCompetency
 * @param {Object} input - Competency creation data.
 * @param {string} input.orgId - Organization ID.
 * @param {string} input.adminId - Admin user ID.
 * @param {Object} input.data - Competency fields.
 * @returns {Promise<Object>} Created competency.
 */
export const createCompetency = async ({
    orgId,
    adminId,
    data
}) => {
    const slug = generateSlug(data.slug || data.name);

    if (!slug) {
        throw createCompetencyError(
            "A valid competency slug could not be generated.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.INVALID_REQUEST
        );
    }

    try {
        const competency = await Competency.create({
            org: orgId,
            name: data.name,
            slug,
            description: data.description,
            category: data.category,
            status: "active",
            createdBy: adminId
        });

        return serializeCompetency(competency);
    } catch (error) {
        handleDuplicateKeyError(error);
    }
};

/**
 * Lists competencies belonging to an organization.
 *
 * @name listCompetencies
 * @param {Object} input - Listing options.
 * @param {string} input.orgId - Organization ID.
 * @param {number} input.page - Page number.
 * @param {number} input.limit - Records per page.
 * @param {string} [input.search] - Search term.
 * @param {string} [input.category] - Category filter.
 * @param {string} [input.status] - Status filter.
 * @returns {Promise<Object>} Competency list and pagination.
 */
export const listCompetencies = async ({
    orgId,
    page,
    limit,
    search,
    category,
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

    if (search) {
        const searchRegex = new RegExp(escapeRegex(search), "i");

        filter.$or = [
            { name: searchRegex },
            { description: searchRegex },
            { slug: searchRegex }
        ];
    }

    const skip = (page - 1) * limit;

    const [competencies, total] = await Promise.all([
        Competency.find(filter)
            .sort({ name: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),

        Competency.countDocuments(filter)
    ]);

    return {
        items: competencies.map(serializeCompetency),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNextPage: page * limit < total,
            hasPreviousPage: page > 1
        }
    };
};

/**
 * Retrieves one competency within an organization.
 *
 * @name getCompetencyById
 * @param {Object} input - Retrieval options.
 * @param {string} input.competencyId - Competency ID.
 * @param {string} input.orgId - Organization ID.
 * @returns {Promise<Object>} Competency details.
 */
export const getCompetencyById = async ({
    competencyId,
    orgId
}) => {
    const competency = await Competency.findOne({
        _id: competencyId,
        org: orgId
    }).lean();

    if (!competency) {
        throw createCompetencyError(
            "Competency was not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    return serializeCompetency(competency);
};

/**
 * Updates an existing competency.
 *
 * @name updateCompetency
 * @param {Object} input - Update options.
 * @param {string} input.competencyId - Competency ID.
 * @param {string} input.orgId - Organization ID.
 * @param {string} input.adminId - Admin user ID.
 * @param {Object} input.data - Fields to update.
 * @returns {Promise<Object>} Updated competency.
 */
export const updateCompetency = async ({
    competencyId,
    orgId,
    adminId,
    data
}) => {
    const competency = await Competency.findOne({
        _id: competencyId,
        org: orgId
    });

    if (!competency) {
        throw createCompetencyError(
            "Competency was not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    if (competency.status === "archived") {
        throw createCompetencyError(
            "Archived competencies cannot be updated.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.INVALID_REQUEST
        );
    }

    if (data.name !== undefined) {
        competency.name = data.name;
    }

    if (data.slug !== undefined) {
        competency.slug = generateSlug(data.slug);
    } else if (data.name !== undefined) {
        competency.slug = generateSlug(data.name);
    }

    if (!competency.slug) {
        throw createCompetencyError(
            "A valid competency slug could not be generated.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.INVALID_REQUEST
        );
    }

    if (data.description !== undefined) {
        competency.description = data.description;
    }

    if (data.category !== undefined) {
        competency.category = data.category;
    }

    competency.updatedBy = adminId;

    try {
        await competency.save();

        return serializeCompetency(competency);
    } catch (error) {
        handleDuplicateKeyError(error);
    }
};

/**
 * Archives a competency without permanently deleting it.
 *
 * @name archiveCompetency
 * @param {Object} input - Archive options.
 * @param {string} input.competencyId - Competency ID.
 * @param {string} input.orgId - Organization ID.
 * @param {string} input.adminId - Admin user ID.
 * @returns {Promise<Object>} Archived competency.
 */
export const archiveCompetency = async ({
    competencyId,
    orgId,
    adminId
}) => {
    const competency = await Competency.findOne({
        _id: competencyId,
        org: orgId
    });

    if (!competency) {
        throw createCompetencyError(
            "Competency was not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    if (competency.status === "archived") {
        throw createCompetencyError(
            "Competency is already archived.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.INVALID_REQUEST
        );
    }

    competency.status = "archived";
    competency.updatedBy = adminId;

    await competency.save();

    return serializeCompetency(competency);
};