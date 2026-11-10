import { z } from "zod";


/**
 * Supported MongoDB ObjectId format.
 */
const objectIdSchema = z
    .string()
    .regex(/^[a-f\d]{24}$/i, "Invalid identifier.");


/**
 * Supported course material MIME types.
 */
const supportedMimeTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-msvideo"
];


/**
 * Supported Cloudinary resource types.
 */
const resourceTypeSchema = z.enum([
    "raw",
    "video"
]);


/**
 * Supported course material classifications.
 */
const materialTypeSchema = z.enum([
    "pdf",
    "document",
    "presentation",
    "video",
    "other"
]);


/**
 * Validates course ID route parameters.
 */
const courseIdParams = z.object({
    courseId: objectIdSchema
}).strict();


/**
 * Validates course and material ID route parameters.
 */
const courseMaterialIdParams = z.object({
    courseId: objectIdSchema,
    materialId: objectIdSchema
}).strict();


/**
 * Validates upload initiation requests.
 *
 * The browser supplies file metadata only.
 * The file itself is uploaded directly to Cloudinary.
 */
export const initiateCourseMaterialUploadSchema = z.object({
    params: courseIdParams,

    body: z.object({
        originalName: z
            .string()
            .trim()
            .min(1)
            .max(255),

        mimeType: z.enum(supportedMimeTypes),

        size: z
            .number()
            .int()
            .min(1)
            .max(500 * 1024 * 1024)
    }).strict()
}).strict();


/**
 * Validates upload confirmation requests.
 *
 * The public ID and resource type are checked against the
 * server-created upload intent before a database record is created.
 */
export const confirmCourseMaterialUploadSchema = z.object({
    params: courseIdParams,

    body: z.object({
        publicId: z
            .string()
            .trim()
            .min(1)
            .max(500),

        resourceType: resourceTypeSchema,

        originalName: z
            .string()
            .trim()
            .min(1)
            .max(255),

        mimeType: z.enum(supportedMimeTypes),

        size: z
            .number()
            .int()
            .min(1)
            .max(500 * 1024 * 1024),

        title: z
            .string()
            .trim()
            .min(2)
            .max(200),

        description: z
            .string()
            .max(1500)
            .optional()
            .default(""),

        materialType: materialTypeSchema,

        displayOrder: z
            .number()
            .int()
            .min(0)
            .optional()
            .default(0)
    }).strict()
}).strict();


/**
 * Validates course material ID route parameters.
 *
 * Includes both courseId and materialId because every material
 * operation is scoped to its parent course.
 */
export const courseMaterialIdParamsSchema = z.object({
    params: courseMaterialIdParams
}).strict();


/**
 * Validates course material listing requests.
 */
export const listCourseMaterialsQuerySchema = z.object({
    params: courseIdParams,

    query: z.object({
        status: z
            .enum(["active", "archived"])
            .optional(),

        page: z.coerce
            .number()
            .int()
            .min(1)
            .optional()
            .default(1),

        limit: z.coerce
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .default(20),

        sortBy: z
            .enum([
                "displayOrder",
                "createdAt",
                "updatedAt",
                "title"
            ])
            .optional()
            .default("displayOrder"),

        sortOrder: z
            .enum(["asc", "desc"])
            .optional()
            .default("asc")
    }).strict()
}).strict();


/**
 * Validates course material metadata update requests.
 *
 * At least one editable field must be provided.
 * File metadata and storage references cannot be modified here.
 */
export const updateCourseMaterialSchema = z.object({
    params: courseMaterialIdParams,

    body: z.object({
        title: z
            .string()
            .trim()
            .min(2)
            .max(200)
            .optional(),

        description: z
            .string()
            .max(1500)
            .optional(),

        displayOrder: z
            .number()
            .int()
            .min(0)
            .optional()
    })
        .strict()
        .refine(
            (data) => Object.keys(data).length > 0,
            {
                message: "At least one editable field must be provided."
            }
        )
}).strict();


/**
 * Legacy course material creation schema.
 *
 * Direct Cloudinary uploads should use the initiate and confirm
 * schemas instead of accepting a file through the application server.
 */
export const createCourseMaterialSchema = z.object({
    params: courseIdParams,

    body: z.object({
        title: z
            .string()
            .trim()
            .min(2)
            .max(200),

        description: z
            .string()
            .max(1500)
            .optional()
            .default(""),

        materialType: materialTypeSchema,

        displayOrder: z
            .number()
            .int()
            .min(0)
            .optional()
            .default(0)
    }).strict()
}).strict();


/**
 * Validates course material archive requests.
 */
export const archiveCourseMaterialSchema =
    courseMaterialIdParamsSchema;