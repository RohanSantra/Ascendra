import mongoose from "mongoose";

import {
    createAnnouncement,
    getAnnouncementById,
    getAnnouncements,
    updateAnnouncement
} from "./announcement.repository.js";

import {
    createAnnouncementNotifications
} from "../notifications/notification.service.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../core/constants/index.js";

import AppError from "../../core/errors/AppError.js";


/**
 * Creates an announcement-related application error.
 *
 * @param {string} message - Error message.
 * @param {number} statusCode - HTTP status code.
 * @param {string} code - Application error code.
 * @returns {AppError} Application error.
 */
const createAnnouncementError = (
    message,
    statusCode,
    code
) => {
    return new AppError(message, statusCode, code);
};


/**
 * Validates a MongoDB ObjectId.
 *
 * @param {string} value - Identifier to validate.
 * @returns {boolean} Whether the identifier is valid.
 */
const isValidObjectId = (value) => {
    return mongoose.Types.ObjectId.isValid(value);
};


/**
 * Validates announcement reference identifiers.
 *
 * @param {Object} params - Identifiers to validate.
 * @param {string} params.orgId - Organisation identifier.
 * @param {string} [params.announcementId] - Announcement identifier.
 * @param {string} [params.userId] - User identifier.
 */
const validateAnnouncementReferences = ({
    orgId,
    announcementId,
    userId
}) => {
    if (
        !isValidObjectId(orgId) ||
        (announcementId && !isValidObjectId(announcementId)) ||
        (userId && !isValidObjectId(userId))
    ) {
        throw createAnnouncementError(
            "Invalid announcement reference.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }
};


/**
 * Creates an announcement as a draft.
 *
 * @param {Object} params - Creation parameters.
 * @param {string} params.orgId - Organisation identifier.
 * @param {string} params.userId - Authenticated administrator identifier.
 * @param {string} params.title - Announcement title.
 * @param {string} params.message - Announcement message.
 * @param {string} [params.audience] - Intended audience.
 * @returns {Promise<Object>} Created announcement.
 */
export const createOrganizationAnnouncement = async ({
    orgId,
    userId,
    title,
    message,
    audience = "everyone"
}) => {
    validateAnnouncementReferences({
        orgId,
        userId
    });

    return createAnnouncement({
        org: orgId,
        title,
        message,
        audience,
        status: "draft",
        createdBy: userId
    });
};


/**
 * Retrieves an announcement within an organisation.
 *
 * Administrators can retrieve announcements in any lifecycle state.
 * Trainers and trainees can retrieve only published announcements
 * intended for their audience.
 *
 * @param {Object} params - Retrieval parameters.
 * @param {string} params.orgId - Organisation identifier.
 * @param {string} params.announcementId - Announcement identifier.
 * @param {string} params.role - Organisation membership role.
 * @returns {Promise<Object>} Announcement record.
 */
export const getOrganizationAnnouncement = async ({
    orgId,
    announcementId,
    role
}) => {
    validateAnnouncementReferences({
        orgId,
        announcementId
    });

    const announcement = await getAnnouncementById({
        orgId,
        announcementId
    });

    if (!announcement) {
        throw createAnnouncementError(
            "Announcement not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    if (role !== "admin") {
        const allowedAudiences = role === "trainer"
            ? ["everyone", "trainers"]
            : ["everyone", "trainees"];

        if (
            announcement.status !== "published" ||
            !allowedAudiences.includes(announcement.audience) ||
            (
                announcement.expiresAt &&
                announcement.expiresAt <= new Date()
            )
        ) {
            throw createAnnouncementError(
                "Announcement not found.",
                HTTP_STATUS.NOT_FOUND,
                ERROR_CODES.RESOURCE_NOT_FOUND
            );
        }
    }

    return announcement;
};


/**
 * Lists announcements within an organisation.
 *
 * Administrators can filter all announcement lifecycle states.
 * Trainers and trainees only receive published announcements
 * intended for their audience.
 *
 * @param {Object} params - Listing parameters.
 * @param {string} params.orgId - Organisation identifier.
 * @param {string} params.role - Organisation membership role.
 * @param {Object} params.filters - Validated listing filters.
 * @param {Object} params.pagination - Pagination settings.
 * @param {Object} params.sort - Sorting settings.
 * @returns {Promise<Object>} Announcement records and metadata.
 */
export const listOrganizationAnnouncements = async ({
    orgId,
    role,
    filters = {},
    pagination = {},
    sort = {}
}) => {
    validateAnnouncementReferences({ orgId });

    const safeFilters = {
        ...filters
    };

    if (role !== "admin") {
        const allowedAudiences = role === "trainer"
            ? ["everyone", "trainers"]
            : ["everyone", "trainees"];

        safeFilters.status = "published";
        safeFilters.audience = {
            $in: allowedAudiences
        };
    }

    return getAnnouncements({
        orgId,
        filters: safeFilters,
        pagination,
        sort
    });
};


/**
 * Updates a draft announcement.
 *
 * Published and archived announcements cannot be edited
 * through this operation.
 *
 * @param {Object} params - Update parameters.
 * @param {string} params.orgId - Organisation identifier.
 * @param {string} params.announcementId - Announcement identifier.
 * @param {string} params.userId - Authenticated administrator identifier.
 * @param {Object} params.updates - Validated update fields.
 * @returns {Promise<Object>} Updated announcement.
 */
export const editOrganizationAnnouncement = async ({
    orgId,
    announcementId,
    userId,
    updates
}) => {
    validateAnnouncementReferences({
        orgId,
        announcementId,
        userId
    });

    const announcement = await getAnnouncementById({
        orgId,
        announcementId
    });

    if (!announcement) {
        throw createAnnouncementError(
            "Announcement not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    if (announcement.status !== "draft") {
        throw createAnnouncementError(
            "Only draft announcements can be edited.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    const updatedAnnouncement = await updateAnnouncement({
        orgId,
        announcementId,
        updates: {
            ...updates,
            updatedBy: userId
        }
    });

    if (!updatedAnnouncement) {
        throw createAnnouncementError(
            "Announcement could not be updated.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    return updatedAnnouncement;
};


/**
 * Publishes a draft announcement.
 *
 * @param {Object} params - Publishing parameters.
 * @param {string} params.orgId - Organisation identifier.
 * @param {string} params.announcementId - Announcement identifier.
 * @param {string} params.userId - Authenticated administrator identifier.
 * @returns {Promise<Object>} Published announcement.
 */
export const publishOrganizationAnnouncement = async ({
    orgId,
    announcementId,
    userId
}) => {
    validateAnnouncementReferences({
        orgId,
        announcementId,
        userId
    });

    const announcement = await getAnnouncementById({
        orgId,
        announcementId
    });

    if (!announcement) {
        throw createAnnouncementError(
            "Announcement not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    if (announcement.status !== "draft") {
        throw createAnnouncementError(
            "Only draft announcements can be published.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    const publishedAnnouncement = await updateAnnouncement({
        orgId,
        announcementId,
        updates: {
            status: "published",
            publishedAt: new Date(),
            updatedBy: userId
        }
    });

    if (!publishedAnnouncement) {
        throw createAnnouncementError(
            "Announcement could not be published.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    // Notify eligible organisation members about the published announcement.
    // Notification failure must not undo an already successful publication.
    try {
        await createAnnouncementNotifications({
            orgId,
            actorId: userId,
            announcementId,
            title: publishedAnnouncement.title,
            message: publishedAnnouncement.message,
            audience: publishedAnnouncement.audience
        });
    } catch (error) {
        console.error(
            "Failed to create announcement notifications:",
            error
        );
    }

    return publishedAnnouncement;
};


/**
 * Archives an announcement.
 *
 * @param {Object} params - Archiving parameters.
 * @param {string} params.orgId - Organisation identifier.
 * @param {string} params.announcementId - Announcement identifier.
 * @param {string} params.userId - Authenticated administrator identifier.
 * @returns {Promise<Object>} Archived announcement.
 */
export const archiveOrganizationAnnouncement = async ({
    orgId,
    announcementId,
    userId
}) => {
    validateAnnouncementReferences({
        orgId,
        announcementId,
        userId
    });

    const announcement = await getAnnouncementById({
        orgId,
        announcementId
    });

    if (!announcement) {
        throw createAnnouncementError(
            "Announcement not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    if (announcement.status === "archived") {
        throw createAnnouncementError(
            "Announcement is already archived.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    const archivedAnnouncement = await updateAnnouncement({
        orgId,
        announcementId,
        updates: {
            status: "archived",
            updatedBy: userId
        }
    });

    if (!archivedAnnouncement) {
        throw createAnnouncementError(
            "Announcement could not be archived.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_CONFLICT
        );
    }

    return archivedAnnouncement;
};