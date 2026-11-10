import ApiResponse from "../../core/responses/ApiResponse.js";
import asyncHandler from "../../core/utils/asyncHandler.js";

import {
    initiateCourseMaterialUpload,
    confirmCourseMaterialUpload,
    getCourseMaterial,
    listCourseMaterials,
    editCourseMaterial,
    archiveCourseMaterialRecord,
    getCourseMaterialAccessUrl
} from "./courseMaterial.service.js";


/**
 * Generates a signed Cloudinary upload request.
 *
 * The frontend uses the returned signature to upload the file
 * directly to Cloudinary without sending the file through Express.
 */
export const initiateCourseMaterialUploadHandler = asyncHandler(
    async (req, res) => {
        const result = await initiateCourseMaterialUpload({
            orgId: req.user.orgId,
            courseId: req.validated.params.courseId,
            userId: req.user.userId,
            role: req.organizationMembership.role,
            ...req.validated.body
        });

        return ApiResponse.ok(
            res,
            "Course material upload initialized successfully.",
            result
        );
    }
);


/**
 * Confirms a completed Cloudinary upload and creates the
 * corresponding course material database record.
 */
export const confirmCourseMaterialUploadHandler = asyncHandler(
    async (req, res) => {
        const result = await confirmCourseMaterialUpload({
            orgId: req.user.orgId,
            courseId: req.validated.params.courseId,
            userId: req.user.userId,
            role: req.organizationMembership.role,
            ...req.validated.body
        });

        return ApiResponse.created(
            res,
            "Course material uploaded successfully.",
            result
        );
    }
);


/**
 * Returns a paginated list of course materials.
 */
export const getCourseMaterialListHandler = asyncHandler(
    async (req, res) => {
        const result = await listCourseMaterials({
            orgId: req.user.orgId,
            courseId: req.validated.params.courseId,
            userId: req.user.userId,
            role: req.organizationMembership.role,
            ...req.validated.query
        });

        return ApiResponse.ok(
            res,
            "Course materials retrieved successfully.",
            result.data,
            result.meta
        );
    }
);


/**
 * Retrieves a single course material.
 */
export const getCourseMaterialHandler = asyncHandler(
    async (req, res) => {
        const result = await getCourseMaterial({
            orgId: req.user.orgId,
            courseId: req.validated.params.courseId,
            materialId: req.validated.params.materialId,
            userId: req.user.userId,
            role: req.organizationMembership.role
        });

        return ApiResponse.ok(
            res,
            "Course material retrieved successfully.",
            result
        );
    }
);


/**
 * Updates editable course material metadata.
 */
export const updateCourseMaterialHandler = asyncHandler(
    async (req, res) => {
        const result = await editCourseMaterial({
            orgId: req.user.orgId,
            courseId: req.validated.params.courseId,
            materialId: req.validated.params.materialId,
            userId: req.user.userId,
            role: req.organizationMembership.role,
            ...req.validated.body
        });

        return ApiResponse.ok(
            res,
            "Course material updated successfully.",
            result
        );
    }
);


/**
 * Archives a course material without deleting its stored file.
 */
export const archiveCourseMaterialHandler = asyncHandler(
    async (req, res) => {
        const result = await archiveCourseMaterialRecord({
            orgId: req.user.orgId,
            courseId: req.validated.params.courseId,
            materialId: req.validated.params.materialId,
            userId: req.user.userId,
            role: req.organizationMembership.role
        });

        return ApiResponse.ok(
            res,
            "Course material archived successfully.",
            result
        );
    }
);


/**
 * Generates a temporary authenticated URL for accessing a
 * course material stored in Cloudinary.
 *
 * The URL is generated only after course and material access
 * have been verified by the service layer.
 */
export const getCourseMaterialAccessUrlHandler = asyncHandler(
    async (req, res) => {
        const result = await getCourseMaterialAccessUrl({
            orgId: req.user.orgId,
            courseId: req.validated.params.courseId,
            materialId: req.validated.params.materialId,
            userId: req.user.userId,
            role: req.organizationMembership.role
        });

        return ApiResponse.ok(
            res,
            "Course material access URL generated successfully.",
            result
        );
    }
);