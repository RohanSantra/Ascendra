import { Router } from "express";

import validateRequest from "../../middleware/validate.middleware.js";

import { authenticate } from "../auth/auth.middleware.js";

import {
    loadOrganizationMembership,
    authorizeRoles
} from "../auth/authorization.middleware.js";

import {
    initiateCourseMaterialUploadSchema,
    confirmCourseMaterialUploadSchema,
    courseMaterialIdParamsSchema,
    listCourseMaterialsQuerySchema,
    updateCourseMaterialSchema
} from "./courseMaterial.validation.js";

import {
    initiateCourseMaterialUploadHandler,
    confirmCourseMaterialUploadHandler,
    getCourseMaterialListHandler,
    getCourseMaterialHandler,
    updateCourseMaterialHandler,
    archiveCourseMaterialHandler,
    getCourseMaterialAccessUrlHandler
} from "./courseMaterial.controller.js";

const router = Router();


/**
 * @route POST /courses/:courseId/materials/upload/initiate
 * @description Initializes a direct-to-Cloudinary course material upload.
 * @access Trainer, Organisation Admin
 */
router.post(
    "/:courseId/materials/upload/initiate",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainer", "admin"),
    validateRequest(
        initiateCourseMaterialUploadSchema,
        { body: true, params: true }
    ),
    initiateCourseMaterialUploadHandler
);


/**
 * @route POST /courses/:courseId/materials/upload/confirm
 * @description Verifies a completed Cloudinary upload and registers the course material.
 * @access Trainer, Organisation Admin
 */
router.post(
    "/:courseId/materials/upload/confirm",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainer", "admin"),
    validateRequest(
        confirmCourseMaterialUploadSchema,
        { body: true, params: true }
    ),
    confirmCourseMaterialUploadHandler
);


/**
 * @route GET /courses/:courseId/materials
 * @description Retrieves course materials with pagination and filtering.
 * @access Trainer, Trainee, Organisation Admin
 */
router.get(
    "/:courseId/materials",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainer", "trainee", "admin"),
    validateRequest(
        listCourseMaterialsQuerySchema,
        { params: true, query: true }
    ),
    getCourseMaterialListHandler
);


/**
 * @route GET /courses/:courseId/materials/:materialId/access
 * @description Generates a temporary authenticated URL for accessing a course material.
 * @access Trainer, Trainee, Organisation Admin
 */
router.get(
    "/:courseId/materials/:materialId/access",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainer", "trainee", "admin"),
    validateRequest(
        courseMaterialIdParamsSchema,
        { params: true }
    ),
    getCourseMaterialAccessUrlHandler
);


/**
 * @route GET /courses/:courseId/materials/:materialId
 * @description Retrieves a specific course material.
 * @access Trainer, Trainee, Organisation Admin
 */
router.get(
    "/:courseId/materials/:materialId",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainer", "trainee", "admin"),
    validateRequest(
        courseMaterialIdParamsSchema,
        { params: true }
    ),
    getCourseMaterialHandler
);


/**
 * @route PATCH /courses/:courseId/materials/:materialId
 * @description Updates course material metadata.
 * @access Trainer, Organisation Admin
 */
router.patch(
    "/:courseId/materials/:materialId",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainer", "admin"),
    validateRequest(
        updateCourseMaterialSchema,
        { body: true, params: true }
    ),
    updateCourseMaterialHandler
);


/**
 * @route PATCH /courses/:courseId/materials/:materialId/archive
 * @description Archives a course material without deleting its Cloudinary file.
 * @access Trainer, Organisation Admin
 */
router.patch(
    "/:courseId/materials/:materialId/archive",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainer", "admin"),
    validateRequest(
        courseMaterialIdParamsSchema,
        { params: true }
    ),
    archiveCourseMaterialHandler
);


export default router;