
import mongoose from "mongoose";
import { z } from "zod";


/**
 * Validates MongoDB ObjectId route parameters.
 */
const objectIdSchema = z.string().refine(
    (value) => mongoose.isValidObjectId(value),
    "Invalid organization identifier."
);


/**
 * Validates organisation slugs.
 *
 * Slugs:
 * - Contain lowercase letters and numbers.
 * - May contain single hyphens between segments.
 * - Cannot start or end with a hyphen.
 * - Cannot contain consecutive hyphens.
 */
const organizationSlugSchema = z.string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(160)
    .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Organization slug must contain only lowercase letters, numbers, and single hyphens."
    );


/**
 * Validates organisation names.
 */
const organizationNameSchema = z.string()
    .trim()
    .min(2)
    .max(150);


/**
 * Validates optional organisation descriptions.
 */
const organizationDescriptionSchema = z.string()
    .trim()
    .max(2000)
    .optional();


/**
 * Validates optional organisation contact email addresses.
 */
const organizationContactEmailSchema = z.string()
    .trim()
    .toLowerCase()
    .email()
    .max(254)
    .optional();


/**
 * Validates optional organisation contact phone numbers.
 */
const organizationContactPhoneSchema = z.string()
    .trim()
    .min(7)
    .max(20)
    .optional();


/**
 * Validates optional organisation addresses.
 */
const organizationAddressSchema = z.string()
    .trim()
    .max(1000)
    .optional();


/**
 * Shared pagination and search query validation.
 *
 * Used by public discovery and Platform Administrator
 * application listing.
 */
const organizationListingQuerySchema = z.object({
    page: z.coerce.number()
        .int()
        .min(1)
        .default(1),

    limit: z.coerce.number()
        .int()
        .min(1)
        .max(100)
        .default(20),

    search: z.string()
        .trim()
        .max(120)
        .optional()
}).strict();


/**
 * Validates public organisation discovery query parameters.
 *
 * @route GET /api/v1/organizations
 */
export const discoverOrganizationsQuerySchema = z.object({
    query: organizationListingQuerySchema
});


/**
 * Validates pending organisation application listing.
 *
 * @route GET /api/v1/organizations/applications/pending
 * @access Platform Administrator
 */
export const pendingOrganizationApplicationsQuerySchema = z.object({
    query: organizationListingQuerySchema
});


/**
 * Validates organisation application submission.
 *
 * Applicants can submit basic organisation details only.
 * Organisation settings and logo uploads are managed separately.
 *
 * The applicant's identity is obtained from the authenticated
 * request and must never be accepted from the request body.
 *
 * @route POST /api/v1/organizations/applications
 */
export const createOrganizationApplicationSchema = z.object({
    body: z.object({
        name: organizationNameSchema,

        slug: organizationSlugSchema,

        description: organizationDescriptionSchema,

        contactEmail: organizationContactEmailSchema,

        contactPhone: organizationContactPhoneSchema,

        address: organizationAddressSchema
    }).strict()
});


/**
 * Validates organisation ID route parameters.
 *
 * @route PATCH /api/v1/organizations/:id
 */
export const organizationIdParamsSchema = z.object({
    params: z.object({
        id: objectIdSchema
    }).strict()
});


/**
 * Validates organisation application rejection.
 *
 * A rejection reason is required for auditability.
 *
 * @route PATCH /api/v1/organizations/applications/:id/reject
 */
export const rejectOrganizationApplicationSchema = z.object({
    params: z.object({
        id: objectIdSchema
    }).strict(),

    body: z.object({
        reason: z.string()
            .trim()
            .min(3)
            .max(500)
    }).strict()
});


/**
 * Validates organisation suspension.
 *
 * @route PATCH /api/v1/organizations/:id/suspend
 */
export const suspendOrganizationSchema = z.object({
    params: z.object({
        id: objectIdSchema
    }).strict(),

    body: z.object({
        reason: z.string()
            .trim()
            .min(3)
            .max(500)
    }).strict()
});


/**
 * Validates organisation reactivation.
 *
 * @route PATCH /api/v1/organizations/:id/reactivate
 */
export const reactivateOrganizationSchema = z.object({
    params: z.object({
        id: objectIdSchema
    }).strict(),

    body: z.object({
        reason: z.string()
            .trim()
            .min(3)
            .max(500)
    }).strict()
});
