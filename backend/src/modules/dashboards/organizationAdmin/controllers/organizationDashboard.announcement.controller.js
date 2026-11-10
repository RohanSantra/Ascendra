import {
    getOrganizationAnnouncementReport
} from "../services/organizationDashboard.announcement.service.js";

import ApiResponse from "../../../../core/responses/ApiResponse.js";

import asyncHandler from "../../../../core/utils/asyncHandler.js";


/**
 * Retrieves detailed announcement reporting for the current organisation.
 *
 * @route GET /organization-admin/reports/announcements
 * @access Organisation Admin
 */
export const getOrganizationAnnouncementReportController = asyncHandler(
    async (req, res) => {
        const periodMonths = req.validated.query.periodMonths;

        const endDate = new Date();

        const startDate = new Date(
            Date.UTC(
                endDate.getUTCFullYear(),
                endDate.getUTCMonth() - periodMonths + 1,
                1
            )
        );

        const report = await getOrganizationAnnouncementReport({
            orgId: req.user.orgId,
            startDate,
            endDate
        });

        return ApiResponse.ok(
            res,
            "Announcement report retrieved successfully.",
            report
        );
    }
);