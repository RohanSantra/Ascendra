import mongoose from "mongoose";

import {
    createCourseMaterial as insertCourseMaterial,
    getCourseMaterialById,
    getCourseMaterials,
    updateCourseMaterial,
    archiveCourseMaterial
} from "./courseMaterial.repository.js";

import {
    createCourseMaterialUploadSignature,
    verifyCourseMaterialUpload,
    createCourseMaterialAccessUrl
} from "./courseMaterial.storage.js";

import {
    getCourse
} from "../courses/course.service.js";

import {
    createCourseMaterialUploadIntent,
    getPendingCourseMaterialUploadIntent,
    consumeCourseMaterialUploadIntent
} from "./courseMaterialUploadIntent.repository.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../core/constants/index.js";

import AppError from "../../core/errors/AppError.js";


/**
 * Creates a standardized course material error.
 *
 * @param {string} message - Error message.
 * @param {number} statusCode - HTTP status code.
 * @param {string} code - Application error code.
 * @returns {AppError} Standardized application error.
 */
const createCourseMaterialError = (
    message,
    statusCode = HTTP_STATUS.BAD_REQUEST,
    code = ERROR_CODES.VALIDATION_ERROR
) => {
    return new AppError(message, statusCode, code);
};


/**
 * Validates a MongoDB identifier.
 *
 * @param {string} id - Identifier to validate.
 * @returns {boolean} Whether the identifier is valid.
 */
const isValidObjectId = (id) => {
    return mongoose.isValidObjectId(id);
};


/**
 * Ensures that a course exists and that the requesting user
 * has permission to access it.
 *
 * Course-level authorization is delegated to the course service.
 *
 * @param {Object} options - Access parameters.
 * @param {string} options.orgId - Organisation ID.
 * @param {string} options.courseId - Course ID.
 * @param {string} options.userId - Requesting user ID.
 * @param {string} options.role - Organisation membership role.
 * @returns {Promise<Object>} Authorized course.
 */
const ensureCourseAccess = async ({
    orgId,
    courseId,
    userId,
    role
}) => {
    if (
        !isValidObjectId(orgId) ||
        !isValidObjectId(courseId) ||
        !isValidObjectId(userId)
    ) {
        throw createCourseMaterialError(
            "Invalid organisation, course or user identifier."
        );
    }

    const course = await getCourse({
        orgId,
        courseId,
        userId,
        role
    });

    if (!course) {
        throw createCourseMaterialError(
            "Course not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    return course;
};


/**
 * Ensures that the requesting user is allowed to manage
 * course materials.
 *
 * Only trainers and organisation administrators may upload,
 * update or archive course materials.
 *
 * Course ownership for trainers is checked separately
 * by ensureCourseAccess().
 *
 * @param {string} role - Organisation membership role.
 * @returns {void}
 * @throws {AppError} When the user cannot manage materials.
 */
const ensureCourseMaterialManagementAccess = (role) => {
    if (!["trainer", "admin"].includes(role)) {
        throw createCourseMaterialError(
            "You are not authorized to manage course materials.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.FORBIDDEN
        );
    }
};


/**
 * Determines the expected material classification from its extension.
 *
 * @param {string} originalName - Original filename.
 * @returns {string} Material classification.
 */
const getMaterialTypeFromFilename = (originalName) => {
    if (typeof originalName !== "string" || !originalName.trim()) {
        return "other";
    }

    const extension = originalName
        .split(".")
        .pop()
        .toLowerCase();

    const materialTypes = {
        pdf: "pdf",
        doc: "document",
        docx: "document",
        ppt: "presentation",
        pptx: "presentation",
        mp4: "video",
        webm: "video",
        mov: "video",
        avi: "video"
    };

    return materialTypes[extension] || "other";
};


/**
 * Initiates a direct Cloudinary upload.
 *
 * No file binary passes through the Express server.
 *
 * The backend verifies course permissions, generates a signed
 * upload request and persists a short-lived upload intent.
 *
 * The upload intent binds the authorized upload to its:
 * - Organisation
 * - Course
 * - Uploader
 * - Cloudinary public ID
 * - Resource type
 * - Original filename
 * - MIME type
 * - Expected file size
 *
 * @param {Object} options - Upload parameters.
 * @param {string} options.orgId - Organisation ID.
 * @param {string} options.courseId - Course ID.
 * @param {string} options.userId - Requesting user ID.
 * @param {string} options.role - Organisation membership role.
 * @param {string} options.originalName - Original filename.
 * @param {string} options.mimeType - File MIME type.
 * @param {number} options.size - File size in bytes.
 * @returns {Promise<Object>} Signed upload configuration and file metadata.
 */
export const initiateCourseMaterialUpload = async ({
    orgId,
    courseId,
    userId,
    role,
    originalName,
    mimeType,
    size
}) => {
    await ensureCourseAccess({
        orgId,
        courseId,
        userId,
        role
    });

    ensureCourseMaterialManagementAccess(role);

    if (
        typeof originalName !== "string" ||
        !originalName.trim() ||
        originalName.trim().length > 255
    ) {
        throw createCourseMaterialError(
            "A valid original filename is required."
        );
    }

    const normalizedOriginalName = originalName.trim();

    /**
     * Generate the signed Cloudinary upload configuration.
     *
     * This function also validates the requested file extension,
     * MIME type and maximum permitted file size.
     */
    const uploadSignature = createCourseMaterialUploadSignature({
        orgId,
        courseId,
        originalName: normalizedOriginalName,
        mimeType,
        size
    });

    /**
     * Persist the server-authorized upload.
     *
     * An upload intent expires after 15 minutes.
     */
    const expiresAt = new Date(
        Date.now() + 15 * 60 * 1000
    );

    await createCourseMaterialUploadIntent({
        org: orgId,
        course: courseId,
        uploadedBy: userId,
        publicId: uploadSignature.publicId,
        resourceType: uploadSignature.resourceType,
        originalName: normalizedOriginalName,
        mimeType,
        size,
        status: "pending",
        expiresAt
    });

    return {
        upload: {
            ...uploadSignature,
            expiresAt
        },
        file: {
            originalName: normalizedOriginalName,
            mimeType,
            size,
            materialType: getMaterialTypeFromFilename(
                normalizedOriginalName
            )
        }
    };
};


/**
 * Confirms a direct Cloudinary upload and creates its MongoDB record.
 *
 * Confirmation is allowed only when a valid, unexpired upload intent
 * exists for the requesting user and the specified course.
 *
 * The uploaded Cloudinary resource is independently retrieved and
 * verified before its metadata is stored.
 *
 * Upload-intent consumption and course material creation are performed
 * inside one MongoDB transaction. This prevents concurrent requests
 * from successfully registering the same upload intent more than once.
 *
 * @param {Object} options - Upload confirmation parameters.
 * @param {string} options.orgId - Organisation ID.
 * @param {string} options.courseId - Course ID.
 * @param {string} options.userId - Requesting user ID.
 * @param {string} options.role - Organisation membership role.
 * @param {string} options.publicId - Cloudinary public ID.
 * @param {string} options.resourceType - Cloudinary resource type.
 * @param {string} options.originalName - Original filename.
 * @param {string} options.mimeType - File MIME type.
 * @param {number} options.size - File size in bytes.
 * @param {string} options.title - Material title.
 * @param {string} [options.description] - Material description.
 * @param {string} options.materialType - Material classification.
 * @param {number} [options.displayOrder=0] - Display order.
 * @returns {Promise<Object>} Created course material.
 */
export const confirmCourseMaterialUpload = async ({
    orgId,
    courseId,
    userId,
    role,
    publicId,
    resourceType,
    originalName,
    mimeType,
    size,
    title,
    description = "",
    materialType,
    displayOrder = 0
}) => {
    await ensureCourseAccess({
        orgId,
        courseId,
        userId,
        role
    });

    ensureCourseMaterialManagementAccess(role);

    /**
     * Validate the submitted metadata before accessing Cloudinary.
     */
    if (
        typeof title !== "string" ||
        title.trim().length < 2 ||
        title.trim().length > 200
    ) {
        throw createCourseMaterialError(
            "Course material title must contain between 2 and 200 characters."
        );
    }

    if (
        typeof description !== "string" ||
        description.length > 1500
    ) {
        throw createCourseMaterialError(
            "Course material description cannot exceed 1500 characters."
        );
    }

    if (
        !Number.isSafeInteger(displayOrder) ||
        displayOrder < 0
    ) {
        throw createCourseMaterialError(
            "Display order must be a non-negative integer."
        );
    }

    if (
        typeof originalName !== "string" ||
        !originalName.trim()
    ) {
        throw createCourseMaterialError(
            "A valid original filename is required."
        );
    }

    /**
     * Retrieve the upload intent issued to this exact user,
     * organisation and course.
     */
    const intent = await getPendingCourseMaterialUploadIntent({
        orgId,
        courseId,
        userId,
        publicId
    });

    if (!intent) {
        throw createCourseMaterialError(
            "Upload intent is invalid, expired, or already used.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    /**
     * Ensure browser-submitted metadata matches the original
     * server-authorized upload request.
     */
    if (
        intent.originalName !== originalName.trim() ||
        intent.mimeType !== mimeType ||
        intent.size !== size ||
        intent.resourceType !== resourceType
    ) {
        throw createCourseMaterialError(
            "Uploaded file metadata does not match the authorized upload.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    /**
     * Ensure the selected material classification matches
     * the original filename.
     */
    const expectedMaterialType = getMaterialTypeFromFilename(
        originalName
    );

    if (materialType !== expectedMaterialType) {
        throw createCourseMaterialError(
            "Material type does not match the uploaded file format."
        );
    }

    /**
     * Verify the actual Cloudinary resource.
     *
     * The browser's metadata is not trusted as proof that
     * an upload has completed successfully.
     */
    const verifiedFile = await verifyCourseMaterialUpload({
        publicId: intent.publicId,
        resourceType: intent.resourceType,
        orgId,
        courseId,
        expectedSize: intent.size,
        mimeType: intent.mimeType,
        originalName: intent.originalName
    });

    /**
     * Consume the upload intent and create the material record
     * atomically so the intent cannot be reused.
     */
    const session = await mongoose.startSession();

    let createdMaterial = null;

    try {
        await session.withTransaction(async () => {
            const consumedIntent =
                await consumeCourseMaterialUploadIntent(
                    {
                        orgId,
                        courseId,
                        userId,
                        publicId: intent.publicId
                    },
                    { session }
                );

            if (!consumedIntent) {
                throw createCourseMaterialError(
                    "This upload has already been confirmed or has expired.",
                    HTTP_STATUS.CONFLICT,
                    ERROR_CODES.RESOURCE_CONFLICT
                );
            }

            createdMaterial = await insertCourseMaterial(
                {
                    org: orgId,
                    course: courseId,
                    title: title.trim(),
                    description: description.trim(),
                    materialType,
                    file: verifiedFile,
                    uploadedBy: userId,
                    displayOrder,
                    status: "active"
                },
                { session }
            );
        });

        return createdMaterial;
    } catch (error) {
        if (error?.code === 11000) {
            throw createCourseMaterialError(
                "This uploaded file has already been registered.",
                HTTP_STATUS.CONFLICT,
                ERROR_CODES.RESOURCE_CONFLICT
            );
        }

        throw error;
    } finally {
        await session.endSession();
    }
};


/**
 * Retrieves one course material.
 *
 * Trainees can only retrieve active materials.
 * Trainers and organisation administrators can retrieve
 * active or archived materials.
 *
 * @param {Object} options - Retrieval parameters.
 * @param {string} options.orgId - Organisation ID.
 * @param {string} options.courseId - Course ID.
 * @param {string} options.materialId - Material ID.
 * @param {string} options.userId - Requesting user ID.
 * @param {string} options.role - Organisation membership role.
 * @returns {Promise<Object>} Course material.
 */
export const getCourseMaterial = async ({
    orgId,
    courseId,
    materialId,
    userId,
    role
}) => {
    await ensureCourseAccess({
        orgId,
        courseId,
        userId,
        role
    });

    if (!isValidObjectId(materialId)) {
        throw createCourseMaterialError(
            "Invalid course material identifier."
        );
    }

    const material = await getCourseMaterialById({
        orgId,
        courseId,
        materialId
    });

    if (
        !material ||
        (role === "trainee" && material.status !== "active")
    ) {
        throw createCourseMaterialError(
            "Course material not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    return material;
};


/**
 * Retrieves a paginated list of course materials.
 *
 * Supports both structured filters/pagination/sort objects
 * and the flat query parameters provided by the controller.
 *
 * Trainees are restricted to active materials regardless
 * of the status supplied in their query parameters.
 *
 * @param {Object} options - Listing parameters.
 * @param {string} options.orgId - Organisation ID.
 * @param {string} options.courseId - Course ID.
 * @param {string} options.userId - Requesting user ID.
 * @param {string} options.role - Organisation membership role.
 * @param {Object} [options.filters] - Material filters.
 * @param {Object} [options.pagination] - Pagination settings.
 * @param {Object} [options.sort] - Sorting settings.
 * @param {string} [options.status] - Material status.
 * @param {number} [options.page] - Page number.
 * @param {number} [options.limit] - Page size.
 * @param {string} [options.sortBy] - Sorting field.
 * @param {string} [options.sortOrder] - Sorting direction.
 * @returns {Promise<Object>} Materials and pagination metadata.
 */
export const listCourseMaterials = async ({
    orgId,
    courseId,
    userId,
    role,
    filters = {},
    pagination = {},
    sort = {},
    status,
    page,
    limit,
    sortBy,
    sortOrder
}) => {
    await ensureCourseAccess({
        orgId,
        courseId,
        userId,
        role
    });

    const safeFilters = {
        ...filters,
        ...(status !== undefined ? { status } : {})
    };

    if (role === "trainee") {
        safeFilters.status = "active";
    }

    const result = await getCourseMaterials({
        orgId,
        courseId,
        filters: safeFilters,
        pagination: {
            ...pagination,
            ...(page !== undefined ? { page } : {}),
            ...(limit !== undefined ? { limit } : {})
        },
        sort: {
            ...sort,
            ...(sortBy !== undefined ? { sortBy } : {}),
            ...(sortOrder !== undefined ? { sortOrder } : {})
        }
    });

    return result;
};


/**
 * Updates editable course material metadata.
 *
 * File replacement is deliberately handled through a separate
 * upload workflow to avoid accidentally overwriting stored assets.
 *
 * Only the owning trainer or an organisation administrator
 * may update course material metadata.
 *
 * @param {Object} options - Update parameters.
 * @param {string} options.orgId - Organisation ID.
 * @param {string} options.courseId - Course ID.
 * @param {string} options.materialId - Material ID.
 * @param {string} options.userId - Requesting user ID.
 * @param {string} options.role - Organisation membership role.
 * @param {string} [options.title] - Updated title.
 * @param {string} [options.description] - Updated description.
 * @param {number} [options.displayOrder] - Updated display order.
 * @param {Object} [options.updates] - Additional update fields.
 * @returns {Promise<Object>} Updated course material.
 */
export const editCourseMaterial = async ({
    orgId,
    courseId,
    materialId,
    userId,
    role,
    title,
    description,
    displayOrder,
    updates = {}
}) => {
    await ensureCourseAccess({
        orgId,
        courseId,
        userId,
        role
    });

    ensureCourseMaterialManagementAccess(role);

    if (!isValidObjectId(materialId)) {
        throw createCourseMaterialError(
            "Invalid course material identifier."
        );
    }

    const existingMaterial = await getCourseMaterialById({
        orgId,
        courseId,
        materialId
    });

    if (!existingMaterial || existingMaterial.status !== "active") {
        throw createCourseMaterialError(
            "Active course material not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    /**
     * Only explicitly supported metadata fields can be updated.
     */
    const allowedUpdates = {};

    const requestedUpdates = {
        ...updates,
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(displayOrder !== undefined ? { displayOrder } : {})
    };

    if (requestedUpdates.title !== undefined) {
        allowedUpdates.title = requestedUpdates.title;
    }

    if (requestedUpdates.description !== undefined) {
        allowedUpdates.description = requestedUpdates.description;
    }

    if (requestedUpdates.displayOrder !== undefined) {
        allowedUpdates.displayOrder = requestedUpdates.displayOrder;
    }

    if (Object.keys(allowedUpdates).length === 0) {
        throw createCourseMaterialError(
            "At least one valid course material field must be provided."
        );
    }

    const updatedMaterial = await updateCourseMaterial({
        orgId,
        courseId,
        materialId,
        updates: allowedUpdates
    });

    if (!updatedMaterial) {
        throw createCourseMaterialError(
            "Course material could not be updated.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    return updatedMaterial;
};


/**
 * Archives a course material.
 *
 * The external file is retained so that archiving does not
 * permanently destroy learning content.
 *
 * Only the owning trainer or an organisation administrator
 * may archive course materials.
 *
 * @param {Object} options - Archive parameters.
 * @param {string} options.orgId - Organisation ID.
 * @param {string} options.courseId - Course ID.
 * @param {string} options.materialId - Material ID.
 * @param {string} options.userId - Requesting user ID.
 * @param {string} options.role - Organisation membership role.
 * @returns {Promise<Object>} Archived course material.
 */
export const archiveCourseMaterialRecord = async ({
    orgId,
    courseId,
    materialId,
    userId,
    role
}) => {
    await ensureCourseAccess({
        orgId,
        courseId,
        userId,
        role
    });

    ensureCourseMaterialManagementAccess(role);

    if (!isValidObjectId(materialId)) {
        throw createCourseMaterialError(
            "Invalid course material identifier."
        );
    }

    const archivedMaterial = await archiveCourseMaterial({
        orgId,
        courseId,
        materialId
    });

    if (!archivedMaterial) {
        throw createCourseMaterialError(
            "Active course material not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    return archivedMaterial;
};


/**
 * Generates a temporary authorized access URL for a course material.
 *
 * Every request is checked against the organisation, course,
 * enrollment and material record before an access URL is generated.
 *
 * Only active materials can receive a new access URL.
 *
 * @param {Object} options - Access URL parameters.
 * @param {string} options.orgId - Organisation ID.
 * @param {string} options.courseId - Course ID.
 * @param {string} options.materialId - Material ID.
 * @param {string} options.userId - Requesting user ID.
 * @param {string} options.role - Organisation membership role.
 * @returns {Promise<Object>} Material details and temporary access URL.
 */
export const getCourseMaterialAccessUrl = async ({
    orgId,
    courseId,
    materialId,
    userId,
    role
}) => {
    await ensureCourseAccess({
        orgId,
        courseId,
        userId,
        role
    });

    if (!isValidObjectId(materialId)) {
        throw createCourseMaterialError(
            "Invalid course material identifier."
        );
    }

    const material = await getCourseMaterialById({
        orgId,
        courseId,
        materialId
    });

    if (!material || material.status !== "active") {
        throw createCourseMaterialError(
            "Active course material not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    if (material.file.storageProvider !== "cloudinary") {
        throw createCourseMaterialError(
            "This material does not use Cloudinary storage.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    const access = await createCourseMaterialAccessUrl({
        storageKey: material.file.storageKey,
        format: material.file.format
    });

    return {
        material: {
            id: material._id,
            title: material.title,
            materialType: material.materialType,
            mimeType: material.file.mimeType,
            size: material.file.size
        },
        access
    };
};