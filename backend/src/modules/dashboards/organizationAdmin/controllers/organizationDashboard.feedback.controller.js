import {
    getOrganizationFeedbackReport
} from "../services/organizationDashboard.feedback.service.js";

import ApiResponse from "../../../../core/responses/ApiResponse.js";

import asyncHandler from "../../../../core/utils/asyncHandler.js";


/**
 * Retrieves detailed feedback reporting for the current organisation.
 *
 * @route GET /organization-admin/reports/feedback
 * @access Organisation Admin
 */
export const getOrganizationFeedbackReportController = asyncHandler(
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

        const report = await getOrganizationFeedbackReport({
            orgId: req.user.orgId,
            startDate,
            endDate
        });

        return ApiResponse.ok(
            res,
            "Feedback report retrieved successfully.",
            report
        );
    }
);