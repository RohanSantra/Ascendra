import {
    createAssessment,
    getAssessment,
    listAssessments,
    editAssessment,
    publishAssessment,
    createAssessmentVersion,
    archiveAssessment
} from "./assessment.service.js";

import ApiResponse from "../../core/responses/ApiResponse.js";
import asyncHandler from "../../core/utils/asyncHandler.js";


/**
 * Creates a new draft assessment.
 *
 * @route POST /courses/:courseId/assessments
 * @access Trainer, Organisation Admin
 */
export const createAssessmentHandler = asyncHandler(
    async (req, res) => {
        const assessment = await createAssessment({
            orgId: req.user.orgId,
            courseId: req.validated.params.courseId,
            userId: req.user.userId,
            role: req.organizationMembership.role,
            assessmentData: req.validated.body
        });

        return ApiResponse.created(
            res,
            "Assessment created successfully.",
            assessment
        );
    }
);


/**
 * Retrieves an assessment by ID.
 *
 * @route GET /assessments/:assessmentId
 * @access Trainer, Trainee, Organisation Admin
 */
export const getAssessmentHandler = asyncHandler(
    async (req, res) => {
        const assessment = await getAssessment({
            orgId: req.user.orgId,
            assessmentId: req.validated.params.assessmentId,
            userId: req.user.userId,
            role: req.organizationMembership.role
        });

        return ApiResponse.ok(
            res,
            "Assessment retrieved successfully.",
            assessment
        );
    }
);


/**
 * Retrieves assessments with optional filters and pagination.
 *
 * @route GET /assessments
 * @access Trainer, Trainee, Organisation Admin
 */
export const listAssessmentsHandler = asyncHandler(
    async (req, res) => {
        const {
            courseId
        } = req.validated.params || {};

        const {
            status,
            page,
            limit,
            sortBy,
            sortOrder
        } = req.validated.query;

        const result = await listAssessments({
            orgId: req.user.orgId,
            userId: req.user.userId,
            role: req.organizationMembership.role,
            courseId,
            filters: {
                status
            },
            pagination: {
                page,
                limit
            },
            sort: {
                sortBy,
                sortOrder
            }
        });

        return ApiResponse.ok(
            res,
            "Assessments retrieved successfully.",
            result.data,
            result.meta
        );
    }
);


/**
 * Updates a draft assessment.
 *
 * @route PATCH /assessments/:assessmentId
 * @access Trainer, Organisation Admin
 */
export const updateAssessmentHandler = asyncHandler(
    async (req, res) => {
        const assessment = await editAssessment({
            orgId: req.user.orgId,
            assessmentId: req.validated.params.assessmentId,
            userId: req.user.userId,
            role: req.organizationMembership.role,
            updates: req.validated.body
        });

        return ApiResponse.ok(
            res,
            "Assessment updated successfully.",
            assessment
        );
    }
);


/**
 * Publishes a draft assessment.
 *
 * @route PATCH /assessments/:assessmentId/publish
 * @access Trainer, Organisation Admin
 */
export const publishAssessmentHandler = asyncHandler(
    async (req, res) => {
        const assessment = await publishAssessment({
            orgId: req.user.orgId,
            assessmentId: req.validated.params.assessmentId,
            userId: req.user.userId,
            role: req.organizationMembership.role
        });

        return ApiResponse.ok(
            res,
            "Assessment published successfully.",
            assessment
        );
    }
);


/**
 * Creates a new draft version from a published assessment.
 *
 * @route POST /assessments/:assessmentId/versions
 * @access Trainer, Organisation Admin
 */
export const createAssessmentVersionHandler = asyncHandler(
    async (req, res) => {
        const assessment = await createAssessmentVersion({
            orgId: req.user.orgId,
            assessmentId: req.validated.params.assessmentId,
            userId: req.user.userId,
            role: req.organizationMembership.role
        });

        return ApiResponse.created(
            res,
            "New assessment version created successfully.",
            assessment
        );
    }
);


/**
 * Archives a published assessment.
 *
 * @route PATCH /assessments/:assessmentId/archive
 * @access Trainer, Organisation Admin
 */
export const archiveAssessmentHandler = asyncHandler(
    async (req, res) => {
        const assessment = await archiveAssessment({
            orgId: req.user.orgId,
            assessmentId: req.validated.params.assessmentId,
            userId: req.user.userId,
            role: req.organizationMembership.role
        });

        return ApiResponse.ok(
            res,
            "Assessment archived successfully.",
            assessment
        );
    }
);