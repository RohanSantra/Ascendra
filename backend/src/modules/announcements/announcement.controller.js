import {
    createOrganizationAnnouncement,
    getOrganizationAnnouncement,
    listOrganizationAnnouncements,
    editOrganizationAnnouncement,
    publishOrganizationAnnouncement,
    archiveOrganizationAnnouncement
} from "./announcement.service.js";

import ApiResponse from "../../core/responses/ApiResponse.js";
import asyncHandler from "../../core/utils/asyncHandler.js";


/**
 * Creates an announcement draft.
 *
 * @route POST /announcements
 * @description Creates a new organisation announcement.
 * @access Organisation Admin
 */
export const createAnnouncementController = asyncHandler(
    async (req, res) => {
        const announcement = await createOrganizationAnnouncement({
            orgId: req.user.orgId,
            userId: req.user.userId,
            ...req.validated.body
        });

        return ApiResponse.created(
            res,
            "Announcement created successfully.",
            announcement
        );
    }
);


/**
 * Retrieves an announcement.
 *
 * @route GET /announcements/:announcementId
 * @description Retrieves an announcement accessible to the current member.
 * @access Organisation Admin, Trainer, Trainee
 */
export const getAnnouncementController = asyncHandler(
    async (req, res) => {
        const announcement = await getOrganizationAnnouncement({
            orgId: req.user.orgId,
            announcementId: req.validated.params.announcementId,
            role: req.organizationMembership.role
        });

        return ApiResponse.ok(
            res,
            "Announcement retrieved successfully.",
            announcement
        );
    }
);


/**
 * Lists organisation announcements.
 *
 * @route GET /announcements
 * @description Retrieves announcements according to role and audience.
 * @access Organisation Admin, Trainer, Trainee
 */
export const listAnnouncementsController = asyncHandler(
    async (req, res) => {
        const result = await listOrganizationAnnouncements({
            orgId: req.user.orgId,
            role: req.organizationMembership.role,
            filters: {
                status: req.validated.query.status,
                audience: req.validated.query.audience
            },
            pagination: {
                page: req.validated.query.page,
                limit: req.validated.query.limit
            },
            sort: {
                sortBy: req.validated.query.sortBy,
                sortOrder: req.validated.query.sortOrder
            }
        });

        return ApiResponse.ok(
            res,
            "Announcements retrieved successfully.",
            result.data,
            result.meta
        );
    }
);


/**
 * Updates a draft announcement.
 *
 * @route PATCH /announcements/:announcementId
 * @description Updates announcement content or audience.
 * @access Organisation Admin
 */
export const updateAnnouncementController = asyncHandler(
    async (req, res) => {
        const announcement = await editOrganizationAnnouncement({
            orgId: req.user.orgId,
            announcementId: req.validated.params.announcementId,
            userId: req.user.userId,
            updates: req.validated.body
        });

        return ApiResponse.ok(
            res,
            "Announcement updated successfully.",
            announcement
        );
    }
);


/**
 * Publishes an announcement.
 *
 * @route PATCH /announcements/:announcementId/publish
 * @description Publishes a draft announcement.
 * @access Organisation Admin
 */
export const publishAnnouncementController = asyncHandler(
    async (req, res) => {
        const announcement = await publishOrganizationAnnouncement({
            orgId: req.user.orgId,
            announcementId: req.validated.params.announcementId,
            userId: req.user.userId
        });

        return ApiResponse.ok(
            res,
            "Announcement published successfully.",
            announcement
        );
    }
);


/**
 * Archives an announcement.
 *
 * @route PATCH /announcements/:announcementId/archive
 * @description Archives an announcement.
 * @access Organisation Admin
 */
export const archiveAnnouncementController = asyncHandler(
    async (req, res) => {
        const announcement = await archiveOrganizationAnnouncement({
            orgId: req.user.orgId,
            announcementId: req.validated.params.announcementId,
            userId: req.user.userId
        });

        return ApiResponse.ok(
            res,
            "Announcement archived successfully.",
            announcement
        );
    }
);