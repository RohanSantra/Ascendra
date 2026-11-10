
import { z } from "zod";

/**
 * @name objectIdSchema
 * @description Validates MongoDB ObjectId strings.
 */
const objectIdSchema = z
    .string()
    .regex(/^[a-fA-F0-9]{24}$/, "Invalid ID format.");

/**
 * @name evidenceTypeSchema
 * @description Defines the supported competency evidence types.
 */
const evidenceTypeSchema = z.enum([
    "qualification",
    "certification",
    "experience",
    "teaching",
    "assessment"
]);

/**
 * @name evidenceDetailsSchema
 * @description Validates the available type-specific evidence details.
 */
const evidenceDetailsSchema = z.object({
    // Qualification details
    qualificationName: z.string().trim().min(2).max(200).optional(),
    institution: z.string().trim().min(2).max(200).optional(),
    fieldOfStudy: z.string().trim().max(150).optional(),
    issuedAt: z.coerce.date().optional(),

    // Certification details
    certificateName: z.string().trim().min(2).max(200).optional(),
    issuer: z.string().trim().min(2).max(200).optional(),
    credentialNumber: z.string().trim().max(150).optional(),
    expiresAt: z.coerce.date().optional(),

    // Professional experience details
    organizationName: z.string().trim().min(2).max(200).optional(),
    designation: z.string().trim().min(2).max(150).optional(),
    industry: z.string().trim().max(150).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    isOngoing: z.boolean().optional(),

    // Teaching experience details
    subject: z.string().trim().min(2).max(150).optional(),
    teachingStartDate: z.coerce.date().optional(),
    teachingEndDate: z.coerce.date().optional(),
    isTeachingOngoing: z.boolean().optional(),

    // Assessment evidence details
    assessmentName: z.string().trim().min(2).max(200).optional(),
    score: z.number().min(0).optional(),
    maximumScore: z.number().positive().optional(),
    takenAt: z.coerce.date().optional()
}).strict();

/**
 * @name evidenceDetailFields
 * @description Defines the fields permitted for each evidence type.
 */
const evidenceDetailFields = {
    qualification: [
        "qualificationName",
        "institution",
        "fieldOfStudy",
        "issuedAt"
    ],
    certification: [
        "certificateName",
        "issuer",
        "credentialNumber",
        "expiresAt"
    ],
    experience: [
        "organizationName",
        "designation",
        "industry",
        "startDate",
        "endDate",
        "isOngoing"
    ],
    teaching: [
        "subject",
        "teachingStartDate",
        "teachingEndDate",
        "isTeachingOngoing"
    ],
    assessment: [
        "assessmentName",
        "score",
        "maximumScore",
        "takenAt"
    ]
};

/**
 * @name validateEvidenceDetails
 * @description Enforces evidence-type-specific fields and
 * validates related values.
 *
 * @param {Object} data - Evidence request data.
 * @param {Object} context - Zod refinement context.
 */
const validateEvidenceDetails = (data, context) => {
    const details = data.details || {};

    const requiredFields = {
        qualification: [
            "qualificationName",
            "institution"
        ],
        certification: [
            "certificateName",
            "issuer"
        ],
        experience: [
            "organizationName",
            "designation",
            "startDate"
        ],
        teaching: [
            "subject",
            "teachingStartDate"
        ],
        assessment: [
            "assessmentName",
            "score",
            "maximumScore",
            "takenAt"
        ]
    };

    const allowedFields = evidenceDetailFields[data.type];

    for (const field of requiredFields[data.type]) {
        if (details[field] === undefined) {
            context.addIssue({
                code: "custom",
                path: ["details", field],
                message: `${field} is required for ${data.type} evidence.`
            });
        }
    }

    for (const field of Object.keys(details)) {
        if (!allowedFields.includes(field)) {
            context.addIssue({
                code: "custom",
                path: ["details", field],
                message: `${field} is not allowed for ${data.type} evidence.`
            });
        }
    }

    if (data.type === "experience") {
        const {
            startDate,
            endDate,
            isOngoing
        } = details;

        if (isOngoing && endDate) {
            context.addIssue({
                code: "custom",
                path: ["details", "endDate"],
                message: "An ongoing experience cannot have an end date."
            });
        }

        if (!isOngoing && !endDate) {
            context.addIssue({
                code: "custom",
                path: ["details", "endDate"],
                message: "End date is required for completed experience."
            });
        }

        if (
            startDate &&
            endDate &&
            endDate < startDate
        ) {
            context.addIssue({
                code: "custom",
                path: ["details", "endDate"],
                message: "End date cannot be earlier than start date."
            });
        }
    }

    if (data.type === "teaching") {
        const {
            teachingStartDate,
            teachingEndDate,
            isTeachingOngoing
        } = details;

        if (isTeachingOngoing && teachingEndDate) {
            context.addIssue({
                code: "custom",
                path: ["details", "teachingEndDate"],
                message: "Ongoing teaching cannot have an end date."
            });
        }

        if (!isTeachingOngoing && !teachingEndDate) {
            context.addIssue({
                code: "custom",
                path: ["details", "teachingEndDate"],
                message: "Teaching end date is required."
            });
        }

        if (
            teachingStartDate &&
            teachingEndDate &&
            teachingEndDate < teachingStartDate
        ) {
            context.addIssue({
                code: "custom",
                path: ["details", "teachingEndDate"],
                message: "Teaching end date cannot be earlier than start date."
            });
        }
    }

    if (data.type === "assessment") {
        const {
            score,
            maximumScore
        } = details;

        if (
            score !== undefined &&
            maximumScore !== undefined &&
            score > maximumScore
        ) {
            context.addIssue({
                code: "custom",
                path: ["details", "score"],
                message: "Score cannot exceed maximum score."
            });
        }
    }
};

/**
 * @name evidenceReferencesSchema
 * @description Validates competency and skill associations.
 */
const evidenceReferencesSchema = z
    .array(objectIdSchema)
    .max(50)
    .refine(
        (ids) => new Set(ids).size === ids.length,
        "Duplicate IDs are not allowed."
    )
    .default([]);

/**
 * @name createEvidenceSchema
 * @description Validates trainer evidence submission requests.
 *
 * Organization, user, trainer profile and verification
 * fields are assigned by the server and cannot be supplied
 * by the client.
 */
export const createEvidenceSchema = z.object({
    body: z.object({
        type: evidenceTypeSchema,

        competencies: evidenceReferencesSchema,

        skills: evidenceReferencesSchema,

        title: z.string()
            .trim()
            .min(2)
            .max(200),

        description: z.string()
            .trim()
            .max(2000)
            .optional(),

        details: evidenceDetailsSchema
            .default({})
    })
        .strict()
        .superRefine(validateEvidenceDetails)
});

/**
 * @name evidenceIdParamsSchema
 * @description Validates evidence ID route parameters.
 */
export const evidenceIdParamsSchema = z.object({
    params: z.object({
        id: objectIdSchema
    }).strict()
});

/**
 * @name evidenceListQuerySchema
 * @description Validates evidence listing filters and pagination.
 */
export const evidenceListQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number()
            .int()
            .min(1)
            .default(1),

        limit: z.coerce.number()
            .int()
            .min(1)
            .max(100)
            .default(20),

        type: evidenceTypeSchema.optional(),

        verificationStatus: z.enum([
            "self_reported",
            "verified",
            "rejected",
            "all"
        ]).default("all"),

        search: z.string()
            .trim()
            .max(200)
            .optional()
    }).strict()
});

/**
 * @name pendingEvidenceQuerySchema
 * @description Validates pending evidence verification queue filters.
 */
export const pendingEvidenceQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number()
            .int()
            .min(1)
            .default(1),

        limit: z.coerce.number()
            .int()
            .min(1)
            .max(100)
            .default(20),

        type: evidenceTypeSchema.optional(),

        search: z.string()
            .trim()
            .max(200)
            .optional()
    }).strict()
});

/**
 * @name rejectEvidenceSchema
 * @description Validates evidence rejection requests.
 */
export const rejectEvidenceSchema = z.object({
    params: z.object({
        id: objectIdSchema
    }).strict(),

    body: z.object({
        reason: z.string()
            .trim()
            .min(3)
            .max(1000)
    }).strict()
});
