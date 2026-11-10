import { z } from "zod";


/**
 * Validates MongoDB ObjectId route and query parameters.
 *
 * @name objectIdSchema
 */
const objectIdSchema = z.string().regex(
    /^[a-f\d]{24}$/i,
    "Invalid ID"
);


/**
 * Validates course ID route parameters.
 *
 * @name courseIdSchema
 */
const courseIdSchema = objectIdSchema;


/**
 * Validates enrollment ID route parameters.
 *
 * @name enrollmentIdSchema
 */
const enrollmentIdSchema = objectIdSchema;


/**
 * Validates trainee ID values.
 *
 * @name traineeIdSchema
 */
const traineeIdSchema = objectIdSchema;


/**
 * Validates enrollment creation.
 *
 * Trainees may enroll themselves without supplying traineeId.
 * Organisation administrators must supply the trainee ID
 * of the person they are enrolling.
 *
 * The service and controller enforce this role-specific rule.
 *
 * @name createEnrollmentSchema
 */
export const createEnrollmentSchema = z.object({
    params: z.object({
        courseId: courseIdSchema
    }).strict(),

    body: z.object({
        traineeId: traineeIdSchema.optional()
    }).strict()
});


/**
 * Validates enrollment ID route parameters.
 *
 * @name enrollmentIdParamsSchema
 */
export const enrollmentIdParamsSchema = z.object({
    params: z.object({
        enrollmentId: enrollmentIdSchema
    }).strict()
});


/**
 * Validates enrollment listing query parameters.
 *
 * Supports filtering by course, trainee and enrollment status,
 * along with pagination and sorting.
 *
 * @name listEnrollmentsQuerySchema
 */
export const listEnrollmentsQuerySchema = z.object({
    query: z.object({
        courseId: courseIdSchema.optional(),

        traineeId: traineeIdSchema.optional(),

        status: z.enum([
            "enrolled",
            "in_progress",
            "completed",
            "withdrawn",
            "cancelled"
        ]).optional(),

        page: z.coerce.number()
            .int()
            .min(1)
            .default(1),

        limit: z.coerce.number()
            .int()
            .min(1)
            .max(100)
            .default(20),

        sortBy: z.enum([
            "enrolledAt",
            "createdAt",
            "updatedAt",
            "startedAt",
            "completedAt"
        ]).default("enrolledAt"),

        sortOrder: z.enum([
            "asc",
            "desc"
        ]).default("desc")
    }).strict()
});


/**
 * Validates enrollment lifecycle transition requests.
 *
 * The service determines whether the requested transition
 * is permitted from the enrollment's current status.
 *
 * @name updateEnrollmentStatusSchema
 */
export const updateEnrollmentStatusSchema = z.object({
    params: z.object({
        enrollmentId: enrollmentIdSchema
    }).strict(),

    body: z.object({
        status: z.enum([
            "in_progress",
            "completed",
            "withdrawn",
            "cancelled"
        ])
    }).strict()
});