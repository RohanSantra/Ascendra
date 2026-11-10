import {
    getOrganizationEvidenceReport
} from "../services/organizationDashboard.evidence.service.js";

import ApiResponse from "../../../../core/responses/ApiResponse.js";
import asyncHandler from "../../../../core/utils/asyncHandler.js";


/**
 * Retrieves competency evidence verification reports.
 *
 * @route GET /organization-admin/reports/evidence
 * @description Retrieves evidence verification statistics and submission trends.
 * @access Organisation Admin
 */
export const getOrganizationEvidenceReportController = asyncHandler(
    async (req, res) => {
        const { periodMonths } = req.validated.query;

        const report = await getOrganizationEvidenceReport({
            orgId: req.user.orgId,
            periodMonths
        });

        return ApiResponse.ok(
            res,
            "Competency evidence report retrieved successfully.",
            report
        );
    }
);